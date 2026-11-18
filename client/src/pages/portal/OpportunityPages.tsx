import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Activity,
  ArrowDownToLine,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  FileSearch,
  Heart,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  SlidersHorizontal,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { brazilGreeting, date, dateTime, money, Loading, ErrorState, statusLabel } from "./common";
import type { AnyOpportunity } from "./common";

const HISTORY_FIELD_LABELS: Record<string, string> = {
  procurementNumber: "Número da licitação",
  processNumber: "Número do processo",
  year: "Ano",
  modality: "Modalidade",
  procurementType: "Tipo de contratação",
  title: "Objeto",
  description: "Descrição",
  summary: "Resumo",
  agencyName: "Órgão responsável",
  unitName: "Unidade compradora",
  agencyCnpj: "CNPJ do órgão",
  state: "Estado",
  municipality: "Município",
  address: "Endereço",
  publicationDate: "Data de publicação",
  openingDate: "Data de abertura",
  sessionAt: "Data da sessão",
  proposalDeadline: "Prazo de propostas",
  estimatedValue: "Valor estimado",
  awardedValue: "Valor homologado",
  status: "Situação",
  judgmentCriterion: "Critério de julgamento",
  disputeMode: "Modo de disputa",
  sourceUrl: "Link da fonte",
  noticeUrl: "Link do edital",
  documents: "Documentos do edital",
  itemCount: "Quantidade de itens",
  lastSourceUpdateAt: "Última atualização informada pela fonte",
  descriptionItem: "Descrição do item",
  catalogCode: "Código de catálogo",
  catalogSystem: "Sistema de catálogo",
  quantity: "Quantidade",
  unit: "Unidade de fornecimento",
  estimatedUnitValue: "Valor estimado unitário",
  estimatedTotalValue: "Valor estimado total",
  specifications: "Especificações",
};

function riskLevel(description: string): { label: string; className: string } {
  if (/2 horas?|24 horas?|multa|impedimento|inabilita|desclassifica|penalidade|sanção|recusa/i.test(description)) return { label: "Alto · triagem automática", className: "bg-rose-100 text-rose-800" };
  if (/prazo|exigência|comprovação|atestado|garantia|entrega|recurso|assinatura/i.test(description)) return { label: "Médio · triagem automática", className: "bg-amber-100 text-amber-800" };
  return { label: "A revisar · triagem automática", className: "bg-slate-100 text-slate-700" };
}

function historyValue(field: string, value: unknown) {
  if (value == null || value === "") return "Não informado";
  if (field === "status" && typeof value === "string") return statusLabel(value);
  if (["estimatedValue", "awardedValue", "estimatedUnitValue", "estimatedTotalValue"].includes(field)) {
    return money(typeof value === "string" || typeof value === "number" ? value : null);
  }
  if (["publicationDate", "openingDate", "sessionAt", "proposalDeadline", "lastSourceUpdateAt"].includes(field)) {
    const parsed = new Date(String(value));
    if (Number.isFinite(parsed.getTime())) return dateTime(parsed);
  }
  if (Array.isArray(value)) return value.length ? value.map(entry => typeof entry === "string" ? entry : JSON.stringify(entry)).join("; ") : "Nenhum";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function historyFieldLabel(field: string) {
  return HISTORY_FIELD_LABELS[field] ?? field;
}

function formatPncpHistoryDate(value: string) {
  const localTimestamp = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localTimestamp) {
    const [, year, month, day, hour, minute, second = "00"] = localTimestamp;
    return `${day}/${month}/${year} - ${hour}:${minute}:${second}`;
  }
  return dateTime(value);
}

export function Dashboard({
  summary, loading, error, cards, recent, favorites = [], recommendations, favoriteChanges = [], savedSearches = [], onRetry,
}: {
  summary: any;
  loading: boolean;
  error?: string;
  cards: { label: string; value: number; icon: any; color: string }[];
  recent: AnyOpportunity[];
  favorites?: AnyOpportunity[];
  recommendations?: { configured: boolean; items: (AnyOpportunity & { matchReasons: string[]; matchBasis: string; matchScore: number })[] };
  favoriteChanges?: { id: string; opportunityId: string; title: string; happenedAt: Date | string; description: string; origin: string }[];
  savedSearches?: { id: string; name: string; criteria: Record<string, unknown> | null }[];
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [term, setTerm] = useState("");
  const [uf, setUf] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (loading) return <Loading label="Carregando indicadores…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const deadline = (item: AnyOpportunity) => item.proposalDeadline ? new Date(item.proposalDeadline).getTime() : Infinity;
  const urgentLimit = summary?.dashboardFilters?.favoriteUrgent?.deadlineTo
    ? new Date(summary.dashboardFilters.favoriteUrgent.deadlineTo).getTime()
    : now.getTime() + 7 * 86400000;
  const urgentFavorites = favorites
    .filter(item => deadline(item) >= now.getTime() && deadline(item) < urgentLimit)
    .sort((a,b) => deadline(a)-deadline(b));
  const metricLink = (params?: Record<string, string>) => `/app/opportunities?${new URLSearchParams(params ?? {}).toString()}`;
  const metrics = [
    { label: "Encerram hoje", value: summary.closingToday, icon: CalendarDays, href: metricLink(summary.dashboardFilters?.today) },
    { label: "Próximos 1–3 dias", value: summary.closing1to3, icon: Activity, href: metricLink(summary.dashboardFilters?.days1to3) },
    { label: "De 4 a 7 dias", value: summary.closing4to7, icon: CalendarDays, href: metricLink(summary.dashboardFilters?.days4to7) },
    { label: "Novas na base (24h)", value: summary.new24h, icon: Sparkles, href: metricLink(summary.dashboardFilters?.new24h) },
    { label: "Favoritos próximos", value: urgentFavorites.length, icon: Heart, href: `/app/favorites?${new URLSearchParams(summary.dashboardFilters?.favoriteUrgent ?? {}).toString()}` },
  ];
  const savedSearchHref = (saved: { name: string; criteria: Record<string, unknown> | null }) => {
    const criteria = saved.criteria ?? {};
    const params = new URLSearchParams();
    params.set("query", typeof criteria.query === "string" && criteria.query.trim() ? criteria.query : saved.name);
    const state = typeof criteria.state === "string" ? criteria.state : Array.isArray(criteria.states) && typeof criteria.states[0] === "string" ? criteria.states[0] : "";
    if (state) params.set("state", state);
    if (criteria.source === "pncp" || criteria.source === "compras.gov.br") params.set("source", criteria.source);
    return `/app/opportunities?${params.toString()}`;
  };
  const states = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  const sources = summary?.sources ?? [];
  const lastUpdate = sources.map((s: any) => s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0).filter((t: number) => Number.isFinite(t) && t > 0);
  const lastSync = lastUpdate.length ? new Date(Math.max(...lastUpdate)) : null;
  const searchUrl = "/app/opportunities?" + new URLSearchParams({ ...(term.trim() ? { query: term.trim() } : {}), ...(uf ? { state: uf } : {}) }).toString();

  return (
    <div className="space-y-6 rounded-2xl bg-gradient-to-br from-[#e8f2fa] via-[#edf5f8] to-[#dcecf1] p-3 sm:p-5">
      <section className="rounded-2xl bg-gradient-to-br from-[#102B4E] via-[#123d65] to-[#087eaa] px-5 py-6 text-white sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-100">Seu painel de oportunidades</p>
        <h2 className="orbe-welcome-heading mt-2 text-2xl font-bold text-white sm:text-3xl">{brazilGreeting(now)}! O que merece sua atenção hoje?</h2>
        <p className="mt-2 text-sm text-blue-100">Pesquise, acompanhe prazos e descubra oportunidades para sua empresa.</p>
        <form className="mt-5 grid gap-2 rounded-xl bg-white p-3 text-slate-900 sm:grid-cols-[1fr_125px_auto]" onSubmit={e => { e.preventDefault(); window.location.assign(searchUrl); }}>
          <label className="sr-only" htmlFor="dashboard-query">Termos da pesquisa</label>
          <input id="dashboard-query" value={term} onChange={e => setTerm(e.target.value)} placeholder="Produto, serviço, órgão ou palavra-chave" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <label className="sr-only" htmlFor="dashboard-state">Estado</label>
          <select id="dashboard-state" value={uf} onChange={e => setUf(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2.5 text-sm">
            <option value="">Todo o Brasil</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-[#102B4E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173b65]">Buscar</button>
        </form>
        <Link href="/app/opportunities" className="mt-3 inline-block text-xs font-semibold text-cyan-100 underline">Abrir busca completa</Link>
        {savedSearches.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Atalhos de pesquisas salvas">
            <span className="text-xs font-semibold text-blue-100">Pesquisas salvas:</span>
            {savedSearches.slice(0, 4).map(saved => (
              <Link key={saved.id} href={savedSearchHref(saved)} className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
                {saved.name}
              </Link>
            ))}
            <Link href="/app/opportunities/saved-searches" className="text-xs font-semibold text-blue-100 underline">Gerenciar</Link>
          </div>
        )}
      </section>

      <section aria-labelledby="dashboard-priorities">
        <h3 id="dashboard-priorities" className="mb-3 font-bold text-[#102B4E]">Prazos e indicadores</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(m => <Link key={m.label} href={m.href} className="rounded-xl border border-[#cbdce8] bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-cyan-700">
            <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">{m.label}</p><m.icon size={19} className="text-cyan-800" /></div>
            <p className="mt-3 text-3xl font-bold text-[#102B4E]">{m.value == null ? "—" : m.value.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs font-medium text-cyan-800">Ver oportunidades →</p>
          </Link>)}
        </div>
        <p className="mt-2 text-xs text-slate-500">As faixas de vencimento não se sobrepõem. “Novas na base” significa registros adicionados ao OrbeEdital nas últimas 24h, não necessariamente publicados hoje.</p>
      </section>

      <section className="rounded-2xl border border-[#c5d9e7] bg-white p-5 shadow-sm" aria-labelledby="dashboard-actions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="dashboard-actions" className="font-bold text-[#102B4E]">Prioridades para você</h3>
          <Link href="/app/agenda" className="text-sm font-semibold text-cyan-800">Abrir agenda →</Link>
        </div>
        {urgentFavorites.length ? <div className="mt-3 space-y-2">{urgentFavorites.slice(0,5).map(item =>
          <Link key={item.id} href={`/app/opportunities/${item.id}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100">
            <span className="font-semibold text-[#102B4E]">{item.title}</span><span className="text-amber-900">Prazo: {date(item.proposalDeadline)}</span>
          </Link>)}</div> : <p className="mt-3 text-sm text-slate-600">Nenhum favorito com prazo nos próximos 7 dias. Salve oportunidades para acompanhar seus vencimentos aqui.</p>}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-[#102B4E]">Alterações registradas nos favoritos</h4>
          {favoriteChanges.length ? (
            <div className="mt-2 space-y-2">
              {favoriteChanges.slice(0, 5).map(change => (
                <Link key={change.id} href={`/app/opportunities/${change.opportunityId}`} className="block rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 hover:bg-cyan-100">
                  <p className="text-sm font-semibold text-[#102B4E]">{change.title}</p>
                  <p className="mt-1 text-xs text-slate-700">{change.description} · {dateTime(change.happenedAt)}</p>
                  <p className="text-xs text-slate-500">{change.origin} — confira o histórico e o edital oficial</p>
                </Link>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-slate-600">Nenhuma alteração de conteúdo registrada nos seus favoritos nos últimos 30 dias.</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/app/favorites" className="text-cyan-800">Meus favoritos →</Link><Link href="/app/notifications" className="text-cyan-800">Notificações →</Link></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#c5d9e7] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div><h3 className="font-bold text-[#102B4E]">Publicações recentes</h3><p className="mt-1 text-xs text-slate-500">Licitações abertas ordenadas pela data de publicação oficial, da mais recente para a mais antiga.</p></div>
          <Link href="/app/opportunities" className="text-sm font-semibold text-cyan-800">Ver todas →</Link>
        </div>
        {recommendations?.items?.length ? <><div className="space-y-2 px-5 pt-4">{recommendations.items.map(item => <div key={item.id} className="text-xs text-cyan-900"><Link href={`/app/opportunities/${item.id}`} className="font-semibold hover:underline">{item.title}</Link><p className="mt-1 text-slate-600">Correspondência: {item.matchReasons.length ? item.matchReasons.join(", ") : item.matchBasis} · {item.state ?? "UF não informada"} · Prazo: {date(item.proposalDeadline)}</p></div>)}</div></> : <div className="p-5 text-sm text-slate-600">{recommendations?.configured ? "Nenhuma oportunidade compatível identificada na base sincronizada." : <Link href="/app/profile" className="font-semibold text-cyan-800">Configurar perfil da empresa →</Link>}</div>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
        <span>Base nacional: {Number(summary?.open ?? 0).toLocaleString("pt-BR")} oportunidades abertas</span>
        <span>Última sincronização registrada: {lastSync ? dateTime(lastSync) : "não informada"}</span>
      </div>
    </div>
  );
}

export function SearchPanel({
  query,
  setQuery,
  state,
  setState,
  source,
  setSource,
  onSearch,
}: {
  query: string;
  setQuery: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  source: "" | "pncp" | "compras.gov.br";
  setSource: (v: "" | "pncp" | "compras.gov.br") => void;
  onSearch: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(query);
  const [searchName, setSearchName] = useState("");
  const utils = trpc.useUtils();
  const save = trpc.savedSearches.create.useMutation({
    onSuccess: async () => {
      setSearchName("");
      await utils.savedSearches.list.invalidate();
      toast.success("Pesquisa salva.");
    },
    onError: e => toast.error(e.message),
  });
  useEffect(() => setDraft(query), [query]);
  return (
    <section className="rounded-xl border border-[#bfd2e0] bg-gradient-to-br from-[#eaf2f8] to-[#dce9f2] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="text-cyan-800" size={18} />
        <h2 className="font-semibold text-[#102B4E]">
          Pesquisar oportunidades abertas
        </h2>
      </div>
      <form
        className="grid gap-3 md:grid-cols-[1fr_150px_190px_auto]"
        onSubmit={async e => {
          e.preventDefault();
          try {
            setQuery(draft);
            await onSearch();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível registrar a pesquisa.");
          }
        }}
      >
        <label className="relative">
          <span className="sr-only">Palavra-chave</span>
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
            placeholder="Objeto, órgão, CNPJ ou processo"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
        </label>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          aria-label="Estado"
          value={state}
          onChange={e => setState(e.target.value)}
        >
          <option value="">Todos os estados</option>
          {[
            "AC",
            "AL",
            "AP",
            "AM",
            "BA",
            "CE",
            "DF",
            "ES",
            "GO",
            "MA",
            "MT",
            "MS",
            "MG",
            "PA",
            "PB",
            "PR",
            "PE",
            "PI",
            "RJ",
            "RN",
            "RS",
            "RO",
            "RR",
            "SC",
            "SP",
            "SE",
            "TO",
          ].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          aria-label="Fonte"
          value={source}
          onChange={e => setSource(e.target.value as typeof source)}
        >
          <option value="">Todas as fontes</option>
          <option value="pncp">PNCP</option>
          <option value="compras.gov.br">Compras.gov.br</option>
        </select>
        <button className="rounded-lg bg-[#102B4E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173b65]">
          Buscar
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          aria-label="Nome da pesquisa salva"
          className="max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome para salvar esta busca"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
        />
        <button
          disabled={!searchName.trim() || save.isPending}
          className="rounded-lg border border-cyan-800 px-3 py-2 text-sm font-semibold text-cyan-900 disabled:opacity-50"
          onClick={() =>
            save.mutate({
              name: searchName.trim(),
              criteria: {
                query: draft.trim() || query.trim() || searchName.trim(),
                state: state || undefined,
                source: source || undefined,
                onlyOpen: true,
              },
            })
          }
        >
          {save.isPending ? "Salvando…" : "Salvar pesquisa"}
        </button>
        <Link href="/app/opportunities/saved-searches" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#102B4E] hover:bg-white">Pesquisas salvas</Link>
        <p className="text-xs text-slate-500">
          Os resultados refletem apenas a janela sincronizada; confirme os
          detalhes no edital oficial.
        </p>
      </div>
    </section>
  );
}

export function OpportunityList({
  items,
  loading,
  error,
  empty,
  onRetry,
  compact = false,
  pagination,
}: {
  items: AnyOpportunity[];
  loading: boolean;
  error?: string;
  empty: string;
  onRetry?: () => void;
  compact?: boolean;
  pagination?: { page: number; totalPages: number; total: number; onPageChange: (page: number) => void };
}) {
  const utils = trpc.useUtils();
  const toggle = trpc.favorites.toggle.useMutation({
    onSuccess: async () => {
      await utils.favorites.list.invalidate();
      await utils.opportunities.search.invalidate();
      toast.success("Favoritos atualizados.");
    },
    onError: e => toast.error(e.message),
  });
  if (loading) return <Loading label="Carregando oportunidades…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!items.length)
    return (
      <div className="p-8 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
          <FileSearch size={20} />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">{empty}</p>
        <p className="mt-1 text-xs text-slate-500">
          Nenhum dado demonstrativo está sendo usado como dado real.
        </p>
      </div>
    );
  return (
    <>
    <div className={compact ? "divide-y" : "space-y-3"}>
      {items.map(item => (
        <article
          key={item.id}
          className={
            compact
              ? "px-5 py-4"
              : "rounded-xl border border-[#bfd2e0] bg-gradient-to-br from-[#f0f6fa] to-[#e1edf4] p-5 shadow-sm"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                  {statusLabel(item.status)}
                </span>
                <span className="text-xs text-slate-500">
                  {item.sourceName ?? "Fonte oficial"}
                </span>
              </div>
              <Link
                className="mt-2 block font-semibold leading-6 text-[#102B4E] hover:text-cyan-800"
                href={`/app/opportunities/${item.id}`}
              >
                {item.title}
              </Link>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                <Building2 size={14} />
                {item.agencyName ?? "Órgão não informado"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} />
                  {[item.municipality, item.state]
                    .filter(Boolean)
                    .join(" / ") || "Local não informado"}
                </span>
                <span>Valor: {money(item.estimatedValue)}</span>
                <span>Prazo: {date(item.proposalDeadline)}</span>
                <span className="inline-flex items-center gap-1 font-medium text-cyan-900"><RefreshCw size={12} /> Extraída em: {dateTime(item.lastSyncedAt)}</span>
              </div>
            </div>
            <button
              aria-label="Alternar favorito"
              className={`rounded-lg border p-2 ${item.isFavorite ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:text-rose-600"}`}
              onClick={() => toggle.mutate({ opportunityId: item.id })}
            >
              <Heart
                size={17}
                fill={item.isFavorite ? "currentColor" : "none"}
              />
            </button>
          </div>
          {item.sourceUrl && (
            <a
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 hover:underline"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no PNCP <ExternalLink size={13} />
            </a>
          )}
        </article>
      ))}
    </div>
    {pagination && pagination.totalPages > 1 && (
      <nav aria-label="Paginação de oportunidades" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <span className="text-slate-600">Página {pagination.page} de {pagination.totalPages} · {pagination.total.toLocaleString("pt-BR")} resultados</span>
        <div className="flex items-center gap-1">
          <button aria-label="Primeira página" disabled={pagination.page === 1} onClick={() => pagination.onPageChange(1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronsLeft size={16} /></button>
          <button aria-label="Página anterior" disabled={pagination.page === 1} onClick={() => pagination.onPageChange(pagination.page - 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="px-2 font-semibold text-[#102B4E]">{pagination.page}</span>
          <button aria-label="Próxima página" disabled={pagination.page === pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
          <button aria-label="Última página" disabled={pagination.page === pagination.totalPages} onClick={() => pagination.onPageChange(pagination.totalPages)} className="rounded-md border p-2 disabled:opacity-40"><ChevronsRight size={16} /></button>
        </div>
      </nav>
    )}
    </>
  );
}

export function OpportunityDetailPage() {
  const [, params] = useRoute("/app/opportunities/:id");
  const id = params?.id;
  const [checkedDocuments, setCheckedDocuments] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setCheckedDocuments(JSON.parse(localStorage.getItem("orbe-edital-checklist:" + id) || "{}")); }
    catch { setCheckedDocuments({}); }
  }, [id]);
  useEffect(() => {
    if (id) try { localStorage.setItem("orbe-edital-checklist:" + id, JSON.stringify(checkedDocuments)); } catch { /* Storage unavailable. */ }
  }, [id, checkedDocuments]);
  const query = trpc.opportunities.detail.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id), retry: false }
  );
  const utils = trpc.useUtils();
  const favorite = trpc.favorites.toggle.useMutation({
    onSuccess: async () => {
      await utils.opportunities.detail.invalidate();
      await utils.favorites.list.invalidate();
      toast.success("Favoritos atualizados.");
    },
    onError: error => toast.error(error.message),
  });
  const editalAnalysis = trpc.opportunities.analyzeEdital.useMutation({
    onError: error => toast.error(error.message),
  });
  if (query.isLoading)
    return <Loading label="Carregando dados da oportunidade…" />;
  if (query.error?.data?.code === "NOT_FOUND") return <NotFound />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  const item = query.data!;
  const pncpHistory = item.pncpHistory;
  const isPncpHistory = pncpHistory !== undefined;
  return (
    <div className="space-y-5">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:underline"
        href="/app/opportunities"
      >
        ← Voltar à busca
      </Link>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
              {item.status === "unknown"
                ? "Situação não informada"
                : item.status}
            </span>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-[#102B4E]">
              {item.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {item.agencyName ?? "Órgão não informado"} ·{" "}
              {item.unitName ?? "Unidade não informada"}
            </p>
          </div>
          <button
            aria-label="Alternar favorito"
            className={`rounded-lg border p-2.5 ${item.isFavorite ? "border-rose-200 bg-rose-50 text-rose-600" : "text-slate-500"}`}
            onClick={() => favorite.mutate({ opportunityId: item.id })}
          >
            <Heart size={19} fill={item.isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Modalidade", item.modality],
            ["Processo", item.processNumber],
            ["CNPJ do órgão", item.agencyCnpj],
            [
              "Localização",
              [item.municipality, item.state].filter(Boolean).join(" / "),
            ],
            ["Valor estimado", money(item.estimatedValue)],
            ["Publicação", date(item.publicationDate)],
            ["Abertura", date(item.openingDate)],
            ["Prazo de propostas", date(item.proposalDeadline)],
            ["Extraída em", dateTime(item.lastSyncedAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 break-words text-sm font-medium text-slate-800">
                {value || "Não informado"}
              </p>
            </div>
          ))}
        </div>
        {item.description && (
          <div className="mt-5 border-t pt-5">
            <h3 className="font-semibold text-[#102B4E]">Descrição</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {item.description}
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3 border-t pt-5">
          {item.sourceUrl && (
            <a
              className="inline-flex items-center gap-2 rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Consultar edital no PNCP <ExternalLink size={15} />
            </a>
          )}
          {item.noticeUrl && (
            <a
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold"
              href={item.noticeUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir edital <ArrowDownToLine size={15} />
            </a>
          )}
          <span className="self-center text-xs text-slate-500">
            Fonte: {item.sourceName}. Confira datas e condições no documento
            oficial.
          </span>
        </div>
      </section>
      <section className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-xl bg-cyan-100 text-cyan-900"><Sparkles size={20} /></span>
            <div>
              <h3 className="font-semibold text-[#102B4E]">Análise inteligente do edital</h3>
              <p className="text-xs text-slate-600">Exigências, checklist, riscos e evidências do edital — sem repetir os dados do cadastro</p>
            </div>
          </div>
          <button
            type="button"
            disabled={editalAnalysis.isPending}
            onClick={() => editalAnalysis.mutate({ id: item.id })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Sparkles size={16} />
            {editalAnalysis.isPending ? "Analisando documento…" : editalAnalysis.data ? "Analisar novamente" : "Analisar edital com IA"}
          </button>
        </div>
        {editalAnalysis.data && (
          <div className="mt-5 space-y-4 border-t border-cyan-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${editalAnalysis.data.analysis.documentAnalyzed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {editalAnalysis.data.analysis.documentAnalyzed ? "Documento oficial analisado" : "Análise limitada aos dados cadastrados"}
              </span>
              <span className="text-xs text-slate-500">Gerada em {dateTime(editalAnalysis.data.generatedAt)}</span>
            </div>
            {editalAnalysis.data.analysis.documentsAnalyzed?.length > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <h4 className="text-sm font-semibold text-emerald-900">Documentos efetivamente analisados</h4>
                <ul className="mt-1 list-disc pl-5 text-xs text-emerald-900">
                  {editalAnalysis.data.analysis.documentsAnalyzed.map((name: string, index: number) => <li key={index}>{name}</li>)}
                </ul>
              </div>
            )}
            {editalAnalysis.data.analysis.documentsNotProcessed?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="text-sm font-semibold text-amber-900">Documentos localizados, mas não analisados</h4>
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                  {editalAnalysis.data.analysis.documentsNotProcessed.map((name: string, index: number) => <li key={index}>{name}</li>)}
                </ul>
              </div>
            )}
            {editalAnalysis.data.analysis.documentChecklist?.length > 0 && (
              <div className="rounded-lg border border-cyan-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-[#102B4E]">Preparação documental · checklist interativo</h4>
                <p className="mt-1 text-xs text-slate-500">Marque os itens providenciados. Progresso salvo neste navegador para esta licitação.</p>
                <p className="mt-2 text-xs font-semibold text-cyan-900">{editalAnalysis.data.analysis.documentChecklist.filter((entry: string) => checkedDocuments[entry]).length} de {editalAnalysis.data.analysis.documentChecklist.length} concluídos</p>
                <div className="mt-3 space-y-2">
                  {editalAnalysis.data.analysis.documentChecklist.map((entry: string, index: number) => (
                    <label key={index} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="mt-1 accent-cyan-700" checked={Boolean(checkedDocuments[entry])} onChange={event => setCheckedDocuments(previous => ({ ...previous, [entry]: event.target.checked }))} />
                      <span className={checkedDocuments[entry] ? "text-slate-400 line-through" : ""}>{entry}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {editalAnalysis.data.analysis.risks?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#102B4E]">Riscos priorizados</h4>
                <p className="mt-1 text-xs text-slate-500">Classificação preliminar por palavras-chave; confirme a gravidade no edital.</p>
                <ul className="mt-2 space-y-2">
                  {editalAnalysis.data.analysis.risks.map((entry: string, index: number) => {
                    const level = riskLevel(entry);
                    return <li key={index} className="rounded-lg border bg-white p-3 text-sm text-slate-700"><span className={`mb-2 inline-block rounded px-2 py-1 text-xs font-semibold ${level.className}`}>{level.label}</span><p>{entry}</p></li>;
                  })}
                </ul>
              </div>
            )}
            {[
              ["Exigências de habilitação", editalAnalysis.data.analysis.qualificationRequirements],
              ["Pontos de atenção", editalAnalysis.data.analysis.attentionPoints],
              ["Informações não localizadas", editalAnalysis.data.analysis.missingInformation],
            ].map(([title, entries]) => Array.isArray(entries) && entries.length > 0 && (
              <div key={String(title)}>
                <h4 className="text-sm font-semibold text-[#102B4E]">{title}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {entries.map((entry: string, index: number) => <li key={index}>{entry}</li>)}
                </ul>
              </div>
            ))}
            {editalAnalysis.data.analysis.evidence.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#102B4E]">Evidências encontradas no documento</h4>
                <div className="mt-2 space-y-2">
                  {editalAnalysis.data.analysis.evidence.map((evidence, index) => (
                    <blockquote key={index} className="rounded-lg border-l-2 border-cyan-500 bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold">{evidence.topic}{evidence.page ? ` · Página ${evidence.page}` : ""}</p>
                      {evidence.document && <p className="mt-0.5 text-xs text-slate-500">Documento: {evidence.document}</p>}
                      <p className="mt-1">“{evidence.excerpt}”</p>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
            <p className="rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-600">
              A análise é assistiva e não substitui a leitura do edital nem a avaliação jurídica. Confira cada exigência e prazo diretamente na publicação oficial antes de tomar decisões.
            </p>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-[#102B4E]">Itens e quantidades</h3>
        {item.items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Descrição</th>
                  <th>Quantidade</th>
                  <th>Unidade</th>
                  <th>Valor estimado</th>
                </tr>
              </thead>
              <tbody>
                {item.items.map((row: any) => (
                  <tr className="border-t" key={row.id}>
                    <td className="py-2">{row.itemNumber ?? "—"}</td>
                    <td>{row.description}</td>
                    <td>{row.quantity ?? "Não informado"}</td>
                    <td>{row.unit ?? "—"}</td>
                    <td>{money(row.estimatedTotalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            A fonte não forneceu itens nesta consulta.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-[#102B4E]">Histórico de atualizações</h3>
        <p className="mt-1 text-xs text-slate-500">{isPncpHistory ? "Eventos oficiais registrados no PNCP." : "Alterações registradas para esta oportunidade."}</p>
        {isPncpHistory ? pncpHistory === null ? (
          <p className="mt-3 text-sm text-amber-800" role="status">
            Não foi possível carregar o histórico oficial do PNCP agora. Consulte o edital na fonte oficial e tente novamente mais tarde.
          </p>
        ) : pncpHistory.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 font-semibold" scope="col">Evento</th>
                  <th className="px-3 py-2.5 font-semibold" scope="col">Nome</th>
                  <th className="px-3 py-2.5 font-semibold" scope="col">Data/Hora do Evento</th>
                  <th className="px-3 py-2.5 font-semibold" scope="col">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {pncpHistory.map((event: any) => (
                  <tr className="border-b border-slate-100 align-top last:border-0" key={event.id}>
                    <td className="px-3 py-3 font-medium text-slate-800">{event.event}</td>
                    <td className="max-w-sm break-words px-3 py-3 text-slate-700">{event.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatPncpHistoryDate(event.happenedAt)}</td>
                    <td className="min-w-56 break-words px-3 py-3 text-slate-700">{event.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">O PNCP ainda não registrou eventos para esta contratação.</p>
        ) : item.history.length ? (
          <ul className="mt-4 space-y-3">
            {item.history.map((event: any) => {
              const previousValues = event.previousValues ?? {};
              const newValues = event.newValues ?? {};
              const previousItems = previousValues.items ?? {};
              const newItems = newValues.items ?? {};
              const isItemUpdate = event.eventType === "source_items_update";
              const changedFields = Object.keys(newValues).filter(field => field !== "items");
              const eventLabel = event.eventType === "source_update"
                ? "Atualização da fonte oficial"
                : event.eventType === "source_items_update"
                  ? "Alteração nos itens do edital"
                  : event.eventType;
              return (
                <li className="border-l-2 border-cyan-300 pl-4" key={event.id}>
                  <p className="text-xs font-medium text-slate-500">{dateTime(event.happenedAt)} · {eventLabel}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{event.summary ?? "Atualização registrada pela fonte oficial."}</p>
                  {!isItemUpdate && changedFields.length > 0 && (
                    <dl className="mt-3 space-y-2">
                      {changedFields.map(field => (
                        <div key={field} className="grid gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:grid-cols-[minmax(130px,0.7fr)_1fr_1fr]">
                          <dt className="font-semibold text-slate-700">{historyFieldLabel(field)}</dt>
                          <dd className="break-words"><span className="font-medium text-slate-500">Antes: </span>{historyValue(field, previousValues[field])}</dd>
                          <dd className="break-words"><span className="font-medium text-slate-500">Agora: </span>{historyValue(field, newValues[field])}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {isItemUpdate && (
                    <div className="mt-3 space-y-2">
                      {(newItems.altered ?? []).map((current: any, index: number) => {
                        const previous = previousItems.altered?.[index];
                        return (
                          <div key={`altered-${current.itemNumber ?? index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold text-slate-700">Item {current.itemNumber ?? "—"}: {current.description}</p>
                            <dl className="mt-2 space-y-1">
                              {Object.keys(current.fields ?? {}).map(field => (
                                <div key={field} className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[140px_1fr_1fr]">
                                  <dt className="font-medium text-slate-600">{historyFieldLabel(field === "description" ? "descriptionItem" : field)}</dt>
                                  <dd className="break-words"><span className="text-slate-500">Antes: </span>{historyValue(field, previous?.fields?.[field])}</dd>
                                  <dd className="break-words"><span className="text-slate-500">Agora: </span>{historyValue(field, current.fields[field])}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        );
                      })}
                      {(newItems.added ?? []).map((added: any, index: number) => (
                        <p key={`added-${added.itemNumber ?? index}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><span className="font-semibold">Item incluído {added.itemNumber ? `(${added.itemNumber})` : ""}:</span> {added.description}</p>
                      ))}
                      {(previousItems.removed ?? []).map((removed: any, index: number) => (
                        <p key={`removed-${removed.itemNumber ?? index}`} className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-900"><span className="font-semibold">Item removido {removed.itemNumber ? `(${removed.itemNumber})` : ""}:</span> {removed.description}</p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Ainda não há histórico de alterações para esta oportunidade.
          </p>
        )}
      </section>
    </div>
  );
}