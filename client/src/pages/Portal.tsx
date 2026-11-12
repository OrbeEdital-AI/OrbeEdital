import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  Activity,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  FileSearch,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Shield,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import BrandMark from "@/components/BrandMark";
import type { AnyOpportunity } from "./portal/common";
import { AdminOverview, AdminOpportunitiesPage, AuditPage, FinancePage, SourcesPage, UsersPage } from "./portal/AdminPages";
import { ProfilePage, SavedSearches } from "./portal/AccountPages";
import {
  Dashboard,
  OpportunityDetailPage,
  OpportunityList,
  SearchPanel,
} from "./portal/OpportunityPages";

export default function Portal() {
  const auth = useAuth();
  const [path, navigate] = useLocation();
  const [query, setQueryState] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState<"" | "pncp" | "compras.gov.br">("");
  const [page, setPage] = useState(1);
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);
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
  const summary = trpc.dashboard.summary.useQuery(undefined, {
    enabled: !!auth.user && emailVerified,
    retry: false,
  });
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
        !!auth.user && emailVerified && (path === "/app/opportunities" || path === "/app"),
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
  const isAdminShell = path.startsWith("/app/admin");
  const canManageSources = ["superadmin", "admin", "source_operator"].includes(
    me?.role ?? ""
  );
  const canViewFinance = ["superadmin", "admin", "finance"].includes(
    me?.role ?? ""
  );
  const canViewAdmin = ["superadmin", "admin", "source_operator"].includes(
    me?.role ?? ""
  );
  const canManageUsers = ["superadmin", "admin"].includes(me?.role ?? "");
  const sections = useMemo(
    () => [
      { label: "Visão geral", href: "/app", icon: LayoutDashboard },
      { label: "Oportunidades", href: "/app/opportunities", icon: FileSearch },
      { label: "Favoritos", href: "/app/favorites", icon: Heart },
      {
        label: "Pesquisas salvas",
        href: "/app/saved-searches",
        icon: Bookmark,
      },
      ...(canViewAdmin
        ? [
            { label: "Administração", href: "/app/admin", icon: Shield },
            { label: "Usuários", href: "/app/admin/users", icon: Users },
            { label: "Editais", href: "/app/admin/opportunities", icon: FileSearch },
            { label: "Auditoria", href: "/app/admin/audit", icon: ScrollText },
          ]
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
  const displayedSections = isAdminShell
    ? sections.filter(item => item.href.startsWith("/app/admin"))
    : sections;

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
            href={isAdminShell ? `/login?next=${encodeURIComponent(path)}` : "/login"}
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
    (path === "/app/profile"
      ? "Perfil da empresa"
      : path.includes("users")
        ? "Usuários"
        : path.includes("admin/opportunities")
          ? "Editais"
          : path.includes("audit")
            ? "Auditoria"
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
    <div className={`${isAdminShell ? "bg-[#eef4f8]" : "bg-[#f5f7fa]"} min-h-screen text-slate-800 md:flex`}>
      <aside className={isAdminShell
        ? `fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-[#071b35] text-white shadow-2xl transition-transform duration-200 ${adminMenuOpen ? "translate-x-0" : "-translate-x-full"}`
        : "flex flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r"}>
        <div className={`flex items-center justify-between px-5 py-5 ${isAdminShell ? "border-b border-white/10" : ""}`}>
          <BrandMark showWordmark={!isAdminShell} />
          {isAdminShell ? <span className="rounded-full bg-[#12375d] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6ce5ed]">Admin</span> : <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-800">Portal</span>}
        </div>
        <nav
          aria-label={isAdminShell ? "Navegação administrativa" : "Navegação do portal"}
          className={`flex flex-col gap-1 px-3 pb-4 ${isAdminShell ? "flex-1 overflow-y-auto pt-4" : "md:flex-1 md:overflow-y-auto md:space-y-1"}`}
        >
          {displayedSections.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => isAdminShell && setAdminMenuOpen(false)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${path === href ? (isAdminShell ? "bg-[#1b567d] text-white" : "bg-[#eaf5fa] text-[#075e7f]") : (isAdminShell ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className={`mt-auto border-t p-3 sm:p-4 ${isAdminShell ? "border-white/10" : "border-slate-100"}`}>
          {!isAdminShell && <Link href="/app/profile" className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${path === "/app/profile" ? "bg-[#eaf5fa] text-[#075e7f]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Building2 size={18} />Perfil da empresa</Link>}
          <div className="flex items-center gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold text-white ${isAdminShell ? "bg-[#1595ae]" : "bg-[#102B4E]"}`}>
              {me?.name?.slice(0, 1).toUpperCase() ?? "C"}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${isAdminShell ? "text-white" : ""}`}>{me?.name}</p>
              <p className={`truncate text-xs ${isAdminShell ? "text-slate-300" : "text-slate-500"}`}>{me?.email}</p>
            </div>
          </div>
          <button
            className={`mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${isAdminShell ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            onClick={() => logout.mutate()}
            type="button"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
      {isAdminShell && adminMenuOpen && <button aria-label="Fechar menu administrativo" className="fixed inset-0 z-20 bg-slate-950/40 md:hidden" onClick={() => setAdminMenuOpen(false)} type="button" />}
      <main className={`min-w-0 flex-1 ${isAdminShell ? "md:pl-0" : ""}`}>
        <header className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur sm:px-8 ${isAdminShell ? "border-[#c8d8e6] bg-[#f7fbfd]/95" : "border-slate-200 bg-white/95"}`}>
          <div>
            {isAdminShell && <button aria-label={adminMenuOpen ? "Fechar menu" : "Abrir menu"} className="mr-3 inline-flex rounded-lg border border-[#bad0df] p-2 text-[#0b2442] md:mr-4" onClick={() => setAdminMenuOpen(value => !value)} type="button">{adminMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>}
            <p className="inline text-xs font-semibold uppercase tracking-wider text-cyan-800">
              {isAdminShell ? "Controle central da plataforma" : "OrbeEdital / Portal"}
            </p>
            <h1 className="mt-1 text-xl font-bold text-[#102B4E]">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdminShell ? <span className="hidden rounded-full border border-[#b9dce4] bg-[#e7f8fa] px-3 py-1.5 text-xs font-medium text-[#0b6377] sm:inline">Sessão administrativa verificada</span> : <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 sm:inline">Plano e pagamentos: configuração pendente</span>}
          </div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
          <Switch>
            <Route path="/app/admin/users">
              <UsersPage isAdmin={canViewAdmin} canManageUsers={canManageUsers} />
            </Route>
            <Route path="/app/admin/opportunities">
              <AdminOpportunitiesPage isAdmin={canViewAdmin} />
            </Route>
            <Route path="/app/admin/audit">
              <AuditPage isAdmin={canViewAdmin} />
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
            <Route path="/app/saved-searches">
              <SavedSearches />
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
