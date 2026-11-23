import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { date, Loading, ErrorState } from "./common";
import { OpportunityList } from "./OpportunityPages";
import type { AnyOpportunity } from "./common";

function savedFilters(criteria: Record<string, unknown>, name: string) {
  const state = typeof criteria.state === "string" ? criteria.state : Array.isArray(criteria.states) ? criteria.states[0] : undefined;
  return { query: typeof criteria.query === "string" && criteria.query.trim() ? criteria.query.trim() : name.trim(), state: typeof state === "string" ? state : "", source: criteria.source === "pncp" ? "pncp" as const : criteria.source === "compras.gov.br" ? "compras.gov.br" as const : undefined };
}

export function SavedSearches() {
  const [active, setActive] = useState<{ name: string; filters: ReturnType<typeof savedFilters> } | null>(null);
  const [page, setPage] = useState(1);
  const record = trpc.opportunities.recordSearch.useMutation();
  const results = trpc.opportunities.search.useQuery({ query: active?.filters.query || undefined, states: active?.filters.state ? [active.filters.state] : undefined, source: active?.filters.source, onlyOpen: true, page, pageSize: 25 }, { enabled: active !== null, staleTime: 0, refetchOnMount: "always" });
  const query = trpc.savedSearches.list.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.savedSearches.delete.useMutation({
    onSuccess: () => utils.savedSearches.list.invalidate(),
    onError: e => toast.error(e.message),
  });
  if (query.isLoading) return <Loading label="Carregando pesquisas salvas…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Pesquisas salvas</h2>
      {query.data?.length ? (
        <ul className="mt-4 divide-y">
          {query.data.map(s => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              key={s.id}
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">
                  Palavra-chave: {savedFilters((s.criteria ?? {}) as Record<string, unknown>, s.name).query || "Todas"} · Atualizada em {date(s.updatedAt)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="text-sm font-semibold text-cyan-800"
                  disabled={record.isPending}
                  onClick={async () => {
                    const filters = savedFilters((s.criteria ?? {}) as Record<string, unknown>, s.name);
                    try {
                      await record.mutateAsync();
                      setPage(1);
                      setActive({ name: s.name, filters });
                      if (active && JSON.stringify(active.filters) === JSON.stringify(filters) && page === 1) void results.refetch();
                    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir a pesquisa."); }
                  }}
                >
                  Abrir pesquisa
                </button>
                <button
                  className="text-sm text-rose-700"
                  onClick={() => remove.mutate({ id: s.id })}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Você ainda não salvou pesquisas.
        </p>
      )}
      {active && <div className="mt-6 space-y-4 border-t pt-5">
        <h2 className="font-bold">Resultados: {active.name}</h2>
        <p className="text-sm text-slate-600">Palavra-chave: {active.filters.query || "Todas"} · Estado: {active.filters.state || "Todos"} · Fonte: {active.filters.source || "Todas"} {results.data ? `· ${results.data.total} resultados` : ""}</p>
        <OpportunityList items={(results.data?.items ?? []) as AnyOpportunity[]} loading={results.isFetching} error={results.error?.message} empty="Nenhuma oportunidade aberta encontrada com estes filtros." onRetry={() => results.refetch()} pagination={results.data ? { page: results.data.page, totalPages: results.data.totalPages, total: results.data.total, onPageChange: setPage } : undefined} />
      </div>}
    </section>
  );
}

const ALL_UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const isAllCoverage = (value: string) => /^(todos?|todas?|todo o brasil|brasil inteiro)$/i.test(value.trim());

export function ProfilePage() {
  const query = trpc.account.profile.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.account.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.account.profile.invalidate();
      toast.success("Perfil da empresa atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const [allStates, setAllStates] = useState(false);
  const [allMunicipalities, setAllMunicipalities] = useState(false);
  const [draft, setDraft] = useState({
    legalName: "",
    cnpj: "",
    state: "",
    municipality: "",
    primarySegment: "",
    segments: "",
    products: "",
    services: "",
    keywords: "",
    servedStates: "",
    servedMunicipalities: "",
    catmatCodes: "",
    catserCodes: "",
    minimumValue: "",
    maximumValue: "",
  });
  useEffect(() => {
    const company = query.data;
    if (!company) return;
    const profile = company.profile;
    const list = (value: unknown) =>
      Array.isArray(value) ? value.join(", ") : "";
    setAllStates(Array.isArray(profile?.servedStates) && profile.servedStates.length === ALL_UFS.length);
    setAllMunicipalities(Array.isArray(profile?.servedMunicipalities) && profile.servedMunicipalities.length === 0);
    setDraft({
      legalName: company.legalName ?? "",
      cnpj: company.cnpj ?? "",
      state: company.state ?? "",
      municipality: company.municipality ?? "",
      primarySegment: company.primarySegment ?? "",
      segments: list(profile?.segments),
      products: list(profile?.products),
      services: list(profile?.services),
      keywords: list(profile?.keywords),
      servedStates: list(profile?.servedStates),
      servedMunicipalities: list(profile?.servedMunicipalities),
      catmatCodes: list(profile?.catmatCodes),
      catserCodes: list(profile?.catserCodes),
      minimumValue: profile?.minimumValue ?? "",
      maximumValue: profile?.maximumValue ?? "",
    });
  }, [query.data]);
  if (query.isLoading)
    return <Loading label="Carregando perfil empresarial…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  const change = (key: keyof typeof draft, value: string) =>
    setDraft(current => ({ ...current, [key]: value }));
  const csv = (value: string, upper = false) =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => (upper ? item.toUpperCase() : item));
  const field = (
    key: keyof typeof draft,
    label: string,
    placeholder: string,
    type = "text"
  ) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
        type={type}
        value={draft[key]}
        placeholder={placeholder}
        onChange={event => change(key, event.target.value)}
      />
    </label>
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({
      legalName: draft.legalName,
      cnpj: draft.cnpj,
      state: draft.state,
      municipality: draft.municipality,
      primarySegment: draft.primarySegment,
      segments: csv(draft.segments),
      products: csv(draft.products),
      services: csv(draft.services),
      keywords: csv(draft.keywords),
      servedStates: (allStates || isAllCoverage(draft.servedStates) ? ALL_UFS : csv(draft.servedStates, true)) as any,
      servedMunicipalities: allMunicipalities || isAllCoverage(draft.servedMunicipalities) ? [] : csv(draft.servedMunicipalities),
      catmatCodes: csv(draft.catmatCodes),
      catserCodes: csv(draft.catserCodes),
      minimumValue: draft.minimumValue ? Number(draft.minimumValue) : null,
      maximumValue: draft.maximumValue ? Number(draft.maximumValue) : null,
    });
  };
  const block = (title: string, description: string, children: React.ReactNode) => (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-[#102B4E]">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-5 sm:p-6">
        <h2 className="text-xl font-bold text-[#102B4E]">Perfil da empresa</h2>
        <p className="mt-1 text-sm text-slate-600">
          Estes dados são privados e ajudam a organizar futuras recomendações de compatibilidade. Listas podem ser separadas por vírgula.
        </p>
      </div>

      {block("Dados da empresa", "Informações cadastrais da sua organização.", <>
        {field("legalName", "Nome da empresa", "Razão social")}
        {field("cnpj", "CNPJ", "00.000.000/0000-00")}
        {field("state", "Estado", "UF")}
        {field("municipality", "Município", "Cidade")}
      </>)}

      {block("Atuação empresarial", "Descreva o que sua empresa vende e os termos associados.", <>
        {field("primarySegment", "Segmento principal", "Demonstração / teste")}
        {field("segments", "Outros segmentos", "Demonstração / teste")}
        {field("products", "Produtos comercializados", "Produto A, Produto B")}
        {field("services", "Serviços prestados", "Serviço A, Serviço B")}
        {field("keywords", "Palavras-chave", "termos relevantes")}
      </>)}

      {block("Cobertura de atendimento", "Informe onde sua empresa pode atender oportunidades.", <>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={allStates || isAllCoverage(draft.servedStates)} onChange={event => { setAllStates(event.target.checked); change("servedStates", event.target.checked ? "Todos" : ""); }} /> Todo o Brasil (27 UFs)</label>
          {!(allStates || isAllCoverage(draft.servedStates)) && field("servedStates", "Estados atendidos", "SP, RJ, MG ou Todos")}
          <p className="text-xs text-slate-500">Marcar todos envia as 27 UFs válidas ao cadastro, sem gerar erro de validação.</p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={allMunicipalities || isAllCoverage(draft.servedMunicipalities)} onChange={event => { setAllMunicipalities(event.target.checked); change("servedMunicipalities", event.target.checked ? "Todos" : ""); }} /> Todos os municípios</label>
          {!(allMunicipalities || isAllCoverage(draft.servedMunicipalities)) && field("servedMunicipalities", "Municípios atendidos", "Campinas, Niterói ou Todos")}
          <p className="text-xs text-slate-500">Todos os municípios = sem restrição municipal no perfil.</p>
        </div>
      </>)}

      {block("Códigos de catálogo", "Use códigos separados por vírgula quando forem conhecidos.", <>
        {field("catmatCodes", "Códigos CATMAT", "códigos separados por vírgula")}
        {field("catserCodes", "Códigos CATSER", "códigos separados por vírgula")}
      </>)}

      {block("Faixa de valores", "Faixa de valores das oportunidades que interessam à empresa.", <>
        {field("minimumValue", "Valor mínimo (R$)", "0", "number")}
        {field("maximumValue", "Valor máximo (R$)", "0", "number")}
      </>)}

      <div className="flex justify-end">
        <button
          disabled={save.isPending}
          className="rounded-lg bg-[#102B4E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {save.isPending ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
