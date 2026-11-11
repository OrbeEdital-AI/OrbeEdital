import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { date, Loading, ErrorState } from "./common";
export function SavedSearches() {
  const query = trpc.savedSearches.list.useQuery();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
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
                  Atualizada em {date(s.updatedAt)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="text-sm font-semibold text-cyan-800"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("licitahub:restore-search", {
                        detail: { criteria: s.criteria },
                      })
                    );
                    navigate("/app/opportunities");
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
    </section>
  );
}

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
      servedStates: csv(draft.servedStates, true) as any,
      servedMunicipalities: csv(draft.servedMunicipalities),
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
        {field("servedStates", "Estados atendidos", "SP, RJ, MG")}
        {field("servedMunicipalities", "Municípios atendidos", "Campinas, Niterói")}
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
