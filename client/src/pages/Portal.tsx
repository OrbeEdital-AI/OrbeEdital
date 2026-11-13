import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  FileSearch,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  X,
  Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import BrandMark from "@/components/BrandMark";
import type { AnyOpportunity } from "./portal/common";
import { AdminOverview, FinancePage, SourcesPage } from "./portal/AdminPages";
import { ProfilePage, SavedSearches } from "./portal/AccountPages";
import { BillingPage } from "./portal/BillingPage";
import {
  Dashboard,
  OpportunityDetailPage,
  OpportunityList,
  SearchPanel,
} from "./portal/OpportunityPages";

export default function Portal() {
  const auth = useAuth();
  const [path, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState<"" | "pncp" | "compras.gov.br">("");
  const [page, setPage] = useState(1);
  const [verificationFeedback, setVerificationFeedback] = useState("");
  const resendVerification = trpc.auth.requestEmailVerification.useMutation();
  const emailVerified = Boolean(auth.user?.emailVerifiedAt);
  useEffect(() => {
    const restore = (event: Event) => {
      const criteria =
        (event as CustomEvent<{ criteria: Record<string, unknown> }>).detail
          ?.criteria ?? {};
      setQueryState(typeof criteria.query === "string" ? criteria.query : "");
      setState(typeof criteria.state === "string" ? criteria.state : "");
      setSource(
        criteria.source === "pncp" || criteria.source === "compras.gov.br"
          ? criteria.source
          : ""
      );
      setPage(1);
    };
    window.addEventListener("orbeedital:restore-search", restore);
    return () =>
      window.removeEventListener("orbeedital:restore-search", restore);
  }, []);
  const setQuery = (value: string) => { setQueryState(value); setPage(1); };
  const setSearchState = (value: string) => { setState(value); setPage(1); };
  const setSearchSource = (value: "" | "pncp" | "compras.gov.br") => { setSource(value); setPage(1); };
  const planUsage = trpc.billing.usage.useQuery(undefined, { enabled: !!auth.user && emailVerified });
  const summary = trpc.dashboard.summary.useQuery(undefined, {
    enabled: !!auth.user && emailVerified,
    retry: false,
  });
  const recordSearch = trpc.opportunities.recordSearch.useMutation();
  const handleExplicitSearch = async () => { await recordSearch.mutateAsync(); };
  const searchQuery = trpc.opportunities.search.useQuery(
    {
      query: query || undefined,
      states: state ? [state] : undefined,
      source: source || undefined,
      onlyOpen: true,
      page,
      pageSize: 25,
    },
    {
      enabled:
        !!auth.user && emailVerified && path === "/app/opportunities",
    }
  );
  const favorites = trpc.favorites.list.useQuery(undefined, {
    enabled: !!auth.user && emailVerified && path === "/app/favorites",
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await auth.refresh();
      navigate("/");
    },
  });
  const me = auth.user as (typeof auth.user & { role?: string }) | null;
  const canManageSources = ["superadmin", "admin", "source_operator"].includes(
    me?.role ?? ""
  );
  const canViewFinance = ["superadmin", "admin", "finance"].includes(
    me?.role ?? ""
  );
  const canViewAdmin = ["superadmin", "admin", "source_operator"].includes(
    me?.role ?? ""
  );
  const sections = useMemo(
    () => [
      { label: "Visão geral", href: "/app", icon: LayoutDashboard },
      { label: "Oportunidades", href: "/app/opportunities", icon: FileSearch },
      { label: "Favoritos", href: "/app/favorites", icon: Heart },
      { label: "Planos e assinatura", href: "/app/billing", icon: Wallet },
      ...(canViewAdmin
        ? [{ label: "Administração", href: "/app/admin", icon: Shield }]
        : []),
      ...(canManageSources
        ? [
            {
              label: "Fontes de dados",
              href: "/app/admin/sources",
              icon: Database,
            },
          ]
        : []),
      ...(canViewFinance
        ? [{ label: "Financeiro", href: "/app/admin/finance", icon: Wallet }]
        : []),
    ],
    [canManageSources, canViewFinance, canViewAdmin]
  );

  if (auth.loading)
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        Verificando sua sessão…
      </div>
    );
  if (!auth.user)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <Shield className="mx-auto h-10 w-10 text-cyan-700" />
          <h1 className="mt-4 text-xl font-bold text-[#102B4E]">
            Entre para acessar o OrbeEdital
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua sessão não está autenticada. Faça login para continuar.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-[#102B4E] px-5 py-2.5 font-semibold text-white"
            href="/login"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );

  if (!emailVerified) {
    const resend = async () => {
      setVerificationFeedback("");
      try {
        const result = await resendVerification.mutateAsync({});
        setVerificationFeedback(
          result.sent
            ? "Link de confirmação enviado. Confira sua caixa de entrada e o spam."
            : "Não foi possível enviar um novo link agora ou já existe um envio recente. Aguarde um minuto e tente novamente."
        );
      } catch {
        setVerificationFeedback("Não foi possível solicitar o link agora. Tente novamente mais tarde.");
      }
    };
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg border border-amber-200 bg-white p-8 text-center shadow-sm">
          <Shield className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-4 text-2xl font-bold text-[#102B4E]">Confirme seu e-mail</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Para proteger sua conta, confirme o endereço <strong>{auth.user.email}</strong> antes de acessar o portal.
            Use o link enviado ou solicite um novo abaixo.
          </p>
          <button
            className="mt-6 w-full bg-[#087eaa] px-4 py-3 font-semibold text-white hover:bg-[#066b92] disabled:opacity-60"
            disabled={resendVerification.isPending}
            onClick={resend}
            type="button"
          >
            {resendVerification.isPending ? "Enviando…" : "Reenviar link de confirmação"}
          </button>
          {verificationFeedback && <p aria-live="polite" className="mt-4 text-sm text-slate-700">{verificationFeedback}</p>}
          <button className="mt-5 text-sm font-semibold text-slate-600 underline" onClick={() => logout.mutate()} type="button">Sair</button>
        </section>
      </main>
    );
  }

  const title =
    sections.find(item => item.href === path)?.label ??
    (path === "/app/billing"
      ? "Planos e assinatura"
      : path === "/app/profile"
      ? "Perfil da empresa"
      : path === "/app/opportunities/saved-searches"
        ? "Pesquisas salvas"
      : path.includes("sources")
        ? "Fontes de dados"
        : path.includes("finance")
          ? "Financeiro"
          : path.includes("opportunities/")
            ? "Detalhe da oportunidade"
            : "Visão geral");
  const cards = summary.data
    ? [
        {
          label: "Oportunidades",
          value: summary.data.total,
          icon: FileSearch,
          color: "text-blue-700 bg-blue-50",
        },
        {
          label: "Abertas",
          value: summary.data.open,
          icon: CheckCircle2,
          color: "text-emerald-700 bg-emerald-50",
        },
        {
          label: "Encerram em 7 dias",
          value: summary.data.closingSoon,
          icon: CalendarDays,
          color: "text-amber-700 bg-amber-50",
        },
        {
          label: "Encerram hoje",
          value: summary.data.closingToday,
          icon: CalendarDays,
          color: "text-rose-700 bg-rose-50",
        },
        {
          label: "Novas em 24 horas",
          value: summary.data.new24h,
          icon: Activity,
          color: "text-cyan-700 bg-cyan-50",
        },
        {
          label: "Sem prazo informado",
          value: summary.data.withoutDeadline,
          icon: Activity,
          color: "text-slate-700 bg-slate-100",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#e5edf4] text-slate-800 md:flex">
      {mobileMenuOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] md:hidden" onClick={() => setMobileMenuOpen(false)} type="button" />}
      <button aria-label="Abrir menu" className="fixed left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-[#102b4e] text-white shadow-lg md:hidden" onClick={() => setMobileMenuOpen(true)} type="button">
        <Menu size={21} />
      </button>
      <aside className={`${mobileMenuOpen ? "fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] shadow-2xl" : "hidden"} flex-col border-r border-[#173b5b] bg-gradient-to-b from-[#102b4e] to-[#173f60] text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:border-r`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <button aria-label="Fechar menu" className="ml-auto rounded-lg p-2 text-blue-100 hover:bg-white/10 md:hidden" onClick={() => setMobileMenuOpen(false)} type="button"><X size={20} /></button>
          <BrandMark />
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
            Portal
          </span>
        </div>
        <nav
          aria-label="Navegação do portal"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 md:space-y-1"
        >
          {sections.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${path === href ? "bg-[#1d6685] text-white shadow-inner" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/15 p-3 sm:p-4">
          <Link
            href="/app/profile"
            className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${path === "/app/profile" ? "bg-[#1d6685] text-white shadow-inner" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
          >
            <Building2 size={18} />
            Perfil da empresa
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-500 font-semibold text-white">
              {me?.name?.slice(0, 1).toUpperCase() ?? "C"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me?.name}</p>
              <p className="truncate text-xs text-blue-200">{me?.email}</p>
            </div>
          </div>
          <button
            className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-blue-100 hover:bg-white/10 hover:text-white"
            onClick={() => logout.mutate()}
            type="button"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="relative z-10 flex items-center justify-between border-b border-[#c4d5e2] bg-[#d9e7f0]/95 px-5 pb-4 pt-20 shadow-sm backdrop-blur sm:px-8 sm:pt-20 md:sticky md:top-0 md:py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
              OrbeEdital / Portal
            </p>
            <h1 className="mt-1 text-xl font-bold text-[#102B4E]">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-900 sm:inline">
              {planUsage.data?.plan ? `Plano: ${planUsage.data.plan.name}` : "Sem assinatura ativa"}
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
          {path === "/app" && !planUsage.isLoading && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Consumo da assinatura</p>
                  <h2 className="mt-1 text-lg font-bold text-[#102B4E]">{planUsage.data?.plan ? planUsage.data.plan.name : "Escolha seu plano"}</h2>
                </div>
                <Link href="/app/billing" className="rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173f60]">
                  {planUsage.data?.plan ? "Ver assinatura" : "Conhecer planos"}
                </Link>
              </div>
              {planUsage.data?.hasSubscription && planUsage.data.limits && planUsage.data.usage ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Pesquisas neste mês", used: planUsage.data.usage.searchesThisMonth, limit: Number(planUsage.data.limits.maxSearchesPerMonth ?? 0) },
                    { label: "Oportunidades favoritas", used: planUsage.data.usage.favorites, limit: Number(planUsage.data.limits.maxFavorites ?? 0) },
                    { label: "Pesquisas salvas", used: planUsage.data.usage.savedSearches, limit: Number(planUsage.data.limits.maxSavedSearches ?? 0) },
                  ].map(item => {
                    const percent = item.limit > 0 ? Math.min(100, Math.round(item.used / item.limit * 100)) : 0;
                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-700">{item.label}</span>
                          <span className="text-slate-500">{item.used.toLocaleString("pt-BR")} / {item.limit.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${percent >= 80 ? "bg-amber-500" : "bg-cyan-700"}`} style={{ width: `${percent}%` }} />
                        </div>
                        <p className="text-xs text-slate-500">Restam {Math.max(0, item.limit - item.used).toLocaleString("pt-BR")}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Sua empresa ainda não possui uma assinatura ativa. Escolha o Essencial ou o Profissional para começar a pesquisar licitações.</p>
              )}
            </section>
          )}
          <Switch>
            <Route path="/app/billing">
              <BillingPage />
            </Route>
            <Route path="/app/admin/sources">
              <SourcesPage isAdmin={canManageSources} />
            </Route>
            <Route path="/app/admin/finance">
              <FinancePage isAdmin={canViewFinance} />
            </Route>
            <Route path="/app/admin">
              <AdminOverview isAdmin={canViewAdmin} />
            </Route>
            <Route path="/app/profile">
              <ProfilePage />
            </Route>
            <Route path="/app/opportunities/saved-searches">
              <div className="space-y-4">
                <Link href="/app/opportunities" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:underline">← Voltar para oportunidades</Link>
                <SavedSearches />
              </div>
            </Route>
            <Route path="/app/opportunities/:id">
              <OpportunityDetailPage />
            </Route>
            <Route path="/app/favorites">
              <OpportunityList
                items={(favorites.data ?? []) as AnyOpportunity[]}
                loading={favorites.isLoading}
                error={favorites.error?.message}
                empty="Você ainda não salvou oportunidades."
              />
            </Route>
            <Route path="/app/opportunities">
              <>
                <SearchPanel
                  query={query}
                  setQuery={setQuery}
                  state={state}
                  setState={setSearchState}
                  source={source}
                  setSource={setSearchSource}
                  onSearch={handleExplicitSearch}
                />
                <OpportunityList
                  items={(searchQuery.data?.items ?? []) as AnyOpportunity[]}
                  loading={searchQuery.isLoading}
                  error={searchQuery.error?.message}
                  empty="Nenhuma oportunidade encontrada com estes filtros."
                onRetry={() => searchQuery.refetch()}
                pagination={searchQuery.data ? { page: searchQuery.data.page, totalPages: searchQuery.data.totalPages, total: searchQuery.data.total, onPageChange: setPage } : undefined}
                />
              </>
            </Route>
            <Route path="/app">
              <Dashboard
                summary={summary.data}
                loading={summary.isLoading}
                error={summary.error?.message}
                cards={cards}
                recent={(summary.data?.recent ?? []) as AnyOpportunity[]}
                onRetry={() => summary.refetch()}
              />
            </Route>
            <Route>
              <div className="rounded-xl border bg-white p-8 text-center">
                <h2 className="font-semibold">Módulo indisponível</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Use o menu para abrir uma área disponível.
                </p>
              </div>
            </Route>
          </Switch>
        </div>
      </main>
    </div>
  );
}
