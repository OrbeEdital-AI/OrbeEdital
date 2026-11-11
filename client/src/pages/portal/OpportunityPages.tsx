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
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { date, money, Loading, ErrorState, statusLabel } from "./common";
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
  if (loading) return <Loading label="Carregando indicadores do PostgreSQL…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#102B4E]">
            Bom dia. Vamos encontrar oportunidades?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Indicadores calculados a partir dos registros atualmente coletados.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-lg bg-[#087eaa] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#066b92]"
          href="/app/opportunities"
        >
          <Search size={16} />
          Buscar licitações
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <article
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${card.color}`}
              >
                <card.icon size={18} />
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold text-[#102B4E]">
              {card.value.toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="font-semibold text-[#102B4E]">
                Oportunidades recentes
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Publicações mais recentes nas fontes conectadas
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-cyan-800 hover:underline"
              href="/app/opportunities"
            >
              Ver todas
            </Link>
          </div>
          <OpportunityList
            items={recent}
            loading={false}
            empty="Ainda não há registros coletados."
            compact
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Database className="text-cyan-700" size={18} />
            <h3 className="font-semibold text-[#102B4E]">Fontes de dados</h3>
          </div>
          <div className="mt-4 space-y-3">
            {(summary?.sources ?? []).map((s: any) => (
              <div
                key={s.code}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.code === "pncp" ? "PNCP" : "Compras.gov.br"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.lastRunAt
                      ? `Última coleta: ${date(s.lastRunAt)}`
                      : "Ainda não sincronizada"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${s.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                >
                  {s.status === "active" ? "Ativa" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            O status do agendamento de produção não é confirmado nesta tela.
            Fontes disponíveis podem ser sincronizadas manualmente por
            operadores autorizados; confira uma execução agendada bem-sucedida
            antes de depender de atualização recorrente.
          </p>
        </section>
      </div>
    </>
  );
}

export function SearchPanel({
  query,
  setQuery,
  state,
  setState,
  source,
  setSource,
}: {
  query: string;
  setQuery: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  source: "" | "pncp" | "compras.gov.br";
  setSource: (v: "" | "pncp" | "compras.gov.br") => void;
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
}: {
  items: AnyOpportunity[];
  loading: boolean;
  error?: string;
  empty: string;
  onRetry?: () => void;
  compact?: boolean;
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
    <div className={compact ? "divide-y" : "space-y-3"}>
      {items.map(item => (
        <article
          key={item.id}
          className={
            compact
              ? "px-5 py-4"
              : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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
