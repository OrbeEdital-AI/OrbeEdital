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
export function Dashboard({
  summary,
  loading,
  error,
  cards,
  recent,
  onRetry,
}: {
  summary: any;
  loading: boolean;
  error?: string;
  cards: { label: string; value: number; icon: any; color: string }[];
  recent: AnyOpportunity[];
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (loading) return <Loading label="Carregando indicadores do PostgreSQL…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const sourceStatus = (status: string) => ({
    active: "Conectada",
    error: "Com atenção",
    disabled: "Pausada",
    pending: "Aguardando",
  } as Record<string, string>)[status] ?? "Aguardando";

  return (
    <div className="space-y-7 rounded-2xl bg-gradient-to-br from-[#e8f2fa] via-[#edf5f8] to-[#dcecf1] p-3 sm:p-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#102B4E] via-[#123d65] to-[#087eaa] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-24 h-64 w-64 rounded-full border-[28px] border-white/5" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Seu painel de oportunidades</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {brazilGreeting(now)}! Vamos encontrar novos negócios?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
              Acompanhe licitações, prazos e novas publicações em um só lugar.
              Encontre oportunidades alinhadas ao perfil da sua empresa.
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#102B4E] shadow-sm transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#123d65]"
            href="/app/opportunities"
          >
            <Search size={17} />
            Explorar oportunidades
          </Link>
        </div>
      </section>

      <section aria-labelledby="overview-metrics">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 id="overview-metrics" className="text-base font-bold text-[#102B4E]">Resumo do mercado</h3>
            <p className="mt-1 text-xs text-slate-500">Indicadores dos registros disponíveis no OrbeEdital</p>
          </div>
          <span className="hidden text-xs text-slate-400 sm:inline">Atualizado conforme as coletas das fontes</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={card.label}
              className={`group rounded-xl border bg-gradient-to-br from-[#f7fbff] to-[#e7f1f7] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${index === 0 ? "border-cyan-300 ring-1 ring-cyan-200" : "border-[#cbdce8]"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${card.color}`}>
                  <card.icon size={19} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-[#102B4E]">
                {card.value.toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#c5d9e7] bg-gradient-to-br from-[#e4f0f7] to-[#f2f7fa] p-5 shadow-sm sm:p-6" aria-labelledby="sources-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
              <Database size={19} />
            </span>
            <div>
              <h3 id="sources-heading" className="font-bold text-[#102B4E]">Bases de oportunidades</h3>
              <p className="mt-0.5 text-xs text-slate-500">Veja de onde vêm os registros disponíveis</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {(summary?.sources ?? []).length} fontes conectadas
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(summary?.sources ?? []).map((s: any) => (
            <article key={s.code} className="rounded-xl border border-[#cbdce8] bg-[#f5f9fc] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#102B4E]">
                    {s.code === "pncp" ? "PNCP" : "Compras.gov.br"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.lastRunAt ? `Última coleta em ${date(s.lastRunAt)}` : "Nenhuma coleta registrada"}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.status === "active" ? "bg-emerald-50 text-emerald-800" : s.status === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
                  {s.status === "error" ? <CircleAlert size={13} /> : <CheckCircle2 size={13} />}
                  {sourceStatus(s.status)}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-[#102B4E]">
                    {Number(s.importedCount ?? 0).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-slate-500">oportunidades importadas</p>
                </div>
                {Number(s.errorCount ?? 0) > 0 && (
                  <p className="text-xs font-medium text-rose-700">{Number(s.errorCount).toLocaleString("pt-BR")} falhas registradas</p>
                )}
              </div>
            </article>
          ))}
          {!(summary?.sources ?? []).length && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">As informações das fontes ainda não estão disponíveis.</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#c5d9e7] bg-[#eaf3f8] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold text-[#102B4E]">Oportunidades recentes</h3>
            <p className="mt-1 text-xs text-slate-500">Publicações mais recentes nas bases consultadas</p>
          </div>
          <Link
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
            href="/app/opportunities"
          >
            Ver todas <span aria-hidden="true">→</span>
          </Link>
        </div>
        <OpportunityList
          items={recent}
          loading={false}
          empty="Ainda não há oportunidades coletadas. Volte em breve para conferir novas publicações."
          compact
        />
      </section>
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
  onSearch: () => void;
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
        onSubmit={e => {
          e.preventDefault();
          setQuery(draft);
          onSearch();
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
                query: draft || undefined,
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
        <h3 className="font-semibold text-[#102B4E]">
          Histórico de atualizações
        </h3>
        {item.history.length ? (
          <ul className="mt-4 space-y-3">
            {item.history.map((event: any) => (
              <li className="border-l-2 border-cyan-300 pl-4" key={event.id}>
                <p className="text-xs text-slate-500">
                  {date(event.happenedAt)} · {event.eventType}
                </p>
                <p className="mt-1 text-sm">
                  {event.summary ?? "Atualização registrada pela fonte."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Ainda não há histórico de mudanças para este registro.
          </p>
        )}
      </section>
    </div>
  );
}
