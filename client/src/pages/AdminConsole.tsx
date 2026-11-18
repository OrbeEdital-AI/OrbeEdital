import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Database, LayoutDashboard, Sparkles,
  LogOut, Search, MessageCircle, ShieldCheck, Users, Wallet, RefreshCw, LockKeyhole, History, Menu, X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import BrandMark from "@/components/BrandMark";
import { toast } from "sonner";
import { AdminOverview, FinancePage, SourcesPage } from "@/pages/portal/AdminPages";
import AdminAuditPage from "@/pages/AdminAuditPage";
import { AdminSupportPage } from "@/pages/SupportPages";
import { AdminOrbeAIPage } from "@/pages/OrbeAIPage";

type Section = "radar" | "overview" | "customers" | "sources" | "finance" | "permissions" | "audit" | "settings" | "support" | "ia";

const navGroups: { title: string; items: { id: Section; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { title: "Operação", items: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "sources", label: "Fontes e sincronizações", icon: Database },
    { id: "radar", label: "OrbeRadar", icon: Database },
  ]},
  { title: "Pessoas e acesso", items: [
    { id: "customers", label: "Clientes e usuários", icon: Users },
    { id: "support", label: "Suporte ao cliente", icon: MessageCircle },
    { id: "permissions", label: "Papéis e permissões", icon: ShieldCheck },
  ]},
  { title: "Inteligência", items: [
    { id: "ia", label: "Orbe IA", icon: Sparkles },
  ]},
  { title: "Governança", items: [
    { id: "audit", label: "Auditoria e segurança", icon: History },
  ]},
  { title: "Gestão", items: [
    { id: "finance", label: "Planos e financeiro", icon: Wallet },
    { id: "settings", label: "Configurações gerais", icon: LockKeyhole },
  ]},
];
const nav = navGroups.flatMap(group => group.items);
const sectionDescriptions: Record<Section, string> = {
  overview: "Resumo operacional, indicadores e situação dos módulos da plataforma.",
  customers: "Consulte contas, verificação de e-mail, papéis e sessões dos usuários.",
  radar: "Piloto de descoberta de avisos oficiais, sem importação automática.",
  sources: "Acompanhe integrações ativas, fontes desativadas, agendamentos e execuções.",
  finance: "Consulte os registros financeiros disponíveis e identifique integrações pendentes.",
  permissions: "Entenda os papéis existentes e os limites de acesso aplicados no servidor.",
  audit: "Rastreie operações administrativas registradas e seus responsáveis.",
  support: "Gerencie a fila, prioridades, responsáveis, mensagens e histórico dos atendimentos.",
  ia: "Acompanhe o uso do Orbe IA, execuções do Radar e empresas atendidas pelo recurso Profissional.",
  settings: "Veja quais configurações já estão disponíveis e quais aguardam implementação.",
};

function date(value: string | Date | null | undefined) {
  if (!value) return "Nunca";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("pt-BR", { timeZone: "America/Recife" });
}

function AccessDenied() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-11 w-11 text-rose-600" />
        <h1 className="mt-4 text-2xl font-bold text-[#102B4E]">Acesso restrito</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta área é exclusiva do Administrador Geral do OrbeEdital. Seu acesso foi negado pelo controle de permissões.
        </p>
        <Link href="/app" className="mt-6 inline-flex rounded-lg bg-[#102B4E] px-5 py-2.5 text-sm font-semibold text-white">Voltar ao portal</Link>
      </section>
    </main>
  );
}

function CustomerDirectory() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const query = trpc.adminUsers.list.useQuery(
    { query: search.trim() || undefined, page, pageSize: 25 },
    { retry: false, placeholderData: previous => previous }
  );
  const data = query.data;
  const plansQuery = trpc.adminUsers.plans.useQuery();
  const utils = trpc.useUtils();
  const updateRole = trpc.adminUsers.updateRole.useMutation({
    onSuccess: async result => {
      toast.success(result.updated ? "Perfil atualizado e registrado na auditoria." : "O usuário já possui esse perfil.");
      await utils.adminUsers.list.invalidate();
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateCustomer = trpc.adminUsers.updateCustomer.useMutation({
    onSuccess: async result => {
      toast.success(result.emailVerificationReset
        ? "Dados atualizados. O cliente deverá confirmar novamente o novo e-mail."
        : "Dados cadastrais do cliente atualizados.");
      setEditingCustomer(null);
      await utils.adminUsers.list.invalidate();
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updatePlan = trpc.adminUsers.updatePlan.useMutation({
    onSuccess: async result => {
      toast.success(`Plano do cliente atualizado para ${result.planName}.`);
      await utils.adminUsers.list.invalidate();
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setSuspension = trpc.adminUsers.setSuspension.useMutation({
    onSuccess: async result => {
      toast.success(result.suspended ? `Conta suspensa. ${result.revokedCount} sessão(ões) encerrada(s).` : "Conta reativada com sucesso.");
      await utils.adminUsers.list.invalidate();
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteAccount = trpc.adminUsers.deleteAccount.useMutation({
    onSuccess: async result => {
      toast.success(`Conta de ${result.email} excluída.`);
      await utils.adminUsers.list.invalidate();
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const revokeSessions = trpc.adminUsers.revokeSessions.useMutation({
    onSuccess: async result => {
      toast.success(result.revokedCount + " sessão(ões) encerrada(s).");
      await utils.adminUsers.audit.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#102B4E]">Base de clientes e usuários</h2>
          <p className="mt-1 text-sm text-slate-500">Consulta protegida. Senhas, hashes e tokens de sessão não são exibidos.</p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou e-mail" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-700" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {query.isLoading ? <p className="p-8 text-center text-sm text-slate-500">Carregando usuários…</p> :
          query.error ? <div className="p-8 text-center"><p className="text-sm text-rose-700">{query.error.message}</p><button onClick={() => query.refetch()} className="mt-3 text-sm font-semibold text-cyan-800">Tentar novamente</button></div> :
          <>
            <div className="flex items-center justify-between border-b px-5 py-3 text-sm text-slate-500"><span>{data?.total ?? 0} usuários encontrados</span><button type="button" disabled={query.isFetching} onClick={async () => { const result = await query.refetch(); if (result.isError) toast.error("Não foi possível atualizar a lista de clientes."); else toast.success("Lista de clientes atualizada."); }} className="inline-flex items-center gap-2 font-medium text-cyan-800 disabled:cursor-wait disabled:opacity-50"><RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""}/> {query.isFetching ? "Atualizando…" : "Atualizar"}</button></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Usuário</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Perfil / gestão</th><th className="px-4 py-3">Plano do cliente</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Segurança / status</th><th className="px-4 py-3">Ações</th></tr></thead>
                <tbody>
                  {data?.items.map(user => <tr key={user.id} className="border-t">
                    <td className="px-5 py-3"><p className="font-semibold text-slate-800">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                    <td className="px-4 py-3">{user.companyName ?? "Não vinculada"}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{user.role}</span>{user.role !== "superadmin" && <select aria-label={`Alterar perfil de ${user.name}`} disabled={updateRole.isPending} value={user.role} onChange={event => { const role = event.target.value as "user" | "admin" | "source_operator" | "support" | "finance"; if (window.confirm(`Confirma alterar o perfil de ${user.name} para ${role}?`)) updateRole.mutate({ userId: user.id, role }); }} className="max-w-36 rounded-md border px-2 py-1 text-xs"><option value="user">Cliente</option><option value="admin">Administrador</option><option value="source_operator">Operador de fontes</option><option value="support">Suporte</option><option value="finance">Financeiro</option></select>}</div></td>
                    <td className="px-4 py-3">
                      {user.role === "user" ? (
                        <div className="min-w-40 space-y-1">
                          <p className="text-xs font-medium text-slate-700">{user.planName ?? "Sem plano"}</p>
                          <select
                            aria-label={`Alterar plano de ${user.name}`}
                            disabled={!user.companyId || plansQuery.isLoading || updatePlan.isPending}
                            value={plansQuery.data?.find(plan => plan.name === user.planName)?.id ?? ""}
                            onChange={event => {
                              const selected = plansQuery.data?.find(plan => plan.id === event.target.value);
                              if (selected && window.confirm(`Confirma atribuir o plano ${selected.name} a ${user.companyName ?? user.name}? A alteração será registrada na auditoria.`)) {
                                updatePlan.mutate({ userId: user.id, planId: selected.id });
                              }
                            }}
                            className="max-w-40 rounded-md border px-2 py-1.5 text-xs"
                          >
                            <option value="" disabled>Selecionar plano</option>
                            {plansQuery.data?.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · R$ {(plan.monthlyPriceCents / 100).toFixed(2).replace(".", ",")}/mês</option>)}
                          </select>
                          {user.subscriptionStatus && <p className="text-[11px] text-slate-500">Status: {user.subscriptionStatus}</p>}
                        </div>
                      ) : <span className="text-xs text-slate-400">Não aplicável</span>}
                    </td>
                    <td className="px-4 py-3">{user.emailVerifiedAt ? <span className="text-emerald-700">Verificado</span> : <span className="text-amber-700">Pendente</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{date(user.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{date(user.lastSignedIn)}</td><td className="px-4 py-3 align-top">
                      {user.role === "user" && <div className="w-36 space-y-2">
                        <div><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${user.suspendedAt ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{user.suspendedAt ? "Suspenso" : "Ativo"}</span>
                        {user.suspendedAt && <p className="mt-1 max-w-48 text-[11px] text-slate-500">Motivo: {user.suspensionReason || "Não informado"}</p>}</div>
                        {user.suspendedAt ? <button disabled={setSuspension.isPending} onClick={() => { if (window.confirm(`Reativar a conta de ${user.email}?`)) setSuspension.mutate({ userId: user.id, suspended: false }); }} className="w-full min-h-9 rounded-md border border-emerald-300 px-3 py-2 text-center text-xs font-semibold text-emerald-800 disabled:opacity-40">Reativar conta</button> : <button disabled={setSuspension.isPending} onClick={() => {
                          const reason = window.prompt(`Informe o motivo da suspensão de ${user.email}:`);
                          if (reason === null) return;
                          if (!reason.trim()) { toast.error("Informe um motivo para suspender a conta."); return; }
                          if (window.confirm(`Suspender ${user.email}? Todas as sessões atuais serão encerradas.`)) setSuspension.mutate({ userId: user.id, suspended: true, reason: reason.trim() });
                        }} className="w-full min-h-9 rounded-md border border-rose-300 px-3 py-2 text-center text-xs font-semibold text-rose-800 disabled:opacity-40">Suspender conta</button>}
                        <button disabled={revokeSessions.isPending} onClick={() => { if (window.confirm("Encerrar todas as sessões deste usuário? Ele precisará entrar novamente.")) revokeSessions.mutate({ userId: user.id }); }} className="block w-full min-h-9 rounded-md border border-amber-300 px-3 py-2 text-center text-xs font-semibold text-amber-800 disabled:opacity-40">Encerrar sessões</button>
                      </div>}
                    </td>
                    <td className="px-4 py-3 align-top">{user.role === "user" && <div className="w-36 flex flex-col gap-2">
                      <button type="button" disabled={updateCustomer.isPending} onClick={() => {
                        setEditingCustomer(user);
                        setEditForm({
                          name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "",
                          companyName: user.companyName ?? "", cnpj: user.companyCnpj ?? "",
                          state: user.companyState ?? "", municipality: user.companyMunicipality ?? "",
                          primarySegment: user.companySegment ?? "",
                          segments: Array.isArray(user.profile_segments) ? user.profile_segments.join(", ") : "",
                          products: Array.isArray(user.profile_products) ? user.profile_products.join(", ") : "",
                          services: Array.isArray(user.profile_services) ? user.profile_services.join(", ") : "",
                          keywords: Array.isArray(user.profile_keywords) ? user.profile_keywords.join(", ") : "",
                          servedStates: Array.isArray(user.profile_served_states) ? user.profile_served_states.join(", ") : "",
                          servedMunicipalities: Array.isArray(user.profile_served_municipalities) ? user.profile_served_municipalities.join(", ") : "",
                          catmatCodes: Array.isArray(user.profile_catmat_codes) ? user.profile_catmat_codes.join(", ") : "",
                          catserCodes: Array.isArray(user.profile_catser_codes) ? user.profile_catser_codes.join(", ") : "",
                          minimumValue: user.profile_minimum_value == null ? "" : String(user.profile_minimum_value),
                          maximumValue: user.profile_maximum_value == null ? "" : String(user.profile_maximum_value),
                          notificationPreferences: JSON.stringify(user.profile_notification_preferences ?? {}, null, 2),
                        });
                      }} className="w-full min-h-9 rounded-md border border-cyan-300 px-3 py-2 text-center text-xs font-semibold text-cyan-900 hover:bg-cyan-50 disabled:opacity-40">Editar dados</button>
                      <button disabled={deleteAccount.isPending} onClick={() => {
                      const typedEmail = window.prompt(`EXCLUSÃO PERMANENTE\n\nEsta ação excluirá a conta de ${user.name} (${user.email}). Se a empresa não tiver outros usuários, os dados vinculados à empresa também serão removidos.\n\nPara confirmar, digite exatamente o e-mail do cliente:`);
                      if (typedEmail === null) return;
                      if (typedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
                        toast.error("O e-mail digitado não corresponde ao cliente.");
                        return;
                      }
                      if (window.confirm(`Confirma a exclusão permanente da conta ${user.email}? Esta ação não pode ser desfeita.`)) {
                        deleteAccount.mutate({ userId: user.id, confirmationEmail: typedEmail.trim() });
                      }
                    }} className="w-full min-h-9 rounded-md border border-rose-300 px-3 py-2 text-center text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">Excluir conta</button></div>}</td>
                  </tr>)}
                  {!data?.items.length && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3">
              <span className="text-xs text-slate-500">Página {data?.page ?? page} de {Math.max(1, data?.pageCount ?? 1)} · 25 por página</span>
              <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button><button disabled={page >= (data?.pageCount ?? 1)} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button></div>
            </div>
          </>}
      </div>
      {editingCustomer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !updateCustomer.isPending) setEditingCustomer(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-customer-title" className="my-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-800">Gestão de clientes</p><h2 id="edit-customer-title" className="mt-1 text-xl font-bold text-[#102B4E]">Editar dados do cliente</h2><p className="mt-1 text-sm text-slate-500">{editingCustomer.name} · {editingCustomer.email}</p></div>
              <button type="button" disabled={updateCustomer.isPending} onClick={() => setEditingCustomer(null)} aria-label="Fechar edição" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-slate-500 hover:bg-slate-50 disabled:opacity-40"><X size={18}/></button>
            </div>
            <form className="space-y-6 p-5 sm:p-7" onSubmit={event => {
              event.preventDefault();
              const required = ["name", "email"];
              if (required.some(key => !editForm[key]?.trim())) { toast.error("Nome e e-mail são obrigatórios."); return; }
              let notificationPreferences: Record<string, unknown>;
              try {
                const parsed = JSON.parse(editForm.notificationPreferences || "{}");
                if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
                notificationPreferences = parsed;
              } catch { toast.error("Preferências de notificação: informe um JSON válido."); return; }
              const parseMoney = (value: string) => value.trim() ? Number(value.replace(/\./g, "").replace(",", ".")) : null;
              const minimumValue = parseMoney(editForm.minimumValue ?? "");
              const maximumValue = parseMoney(editForm.maximumValue ?? "");
              if ((minimumValue !== null && (!Number.isFinite(minimumValue) || minimumValue < 0)) || (maximumValue !== null && (!Number.isFinite(maximumValue) || maximumValue < 0))) { toast.error("Informe valores mínimos e máximos válidos."); return; }
              const list = (key: string, upper = false) => (editForm[key] ?? "").split(",").map(item => item.trim()).filter(Boolean).map(item => upper ? item.toUpperCase() : item);
              updateCustomer.mutate({
                userId: editingCustomer.id,
                name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim(),
                companyName: editForm.companyName.trim() || undefined, cnpj: editForm.cnpj.trim(),
                state: editForm.state.trim().toUpperCase(), municipality: editForm.municipality.trim(),
                primarySegment: editForm.primarySegment.trim(),
                segments: list("segments"), products: list("products"), services: list("services"), keywords: list("keywords"),
                servedStates: list("servedStates", true), servedMunicipalities: list("servedMunicipalities"),
                catmatCodes: list("catmatCodes"), catserCodes: list("catserCodes"),
                minimumValue, maximumValue, notificationPreferences,
              });
            }}>
              <div>
                <h3 className="text-sm font-bold text-[#102B4E]">Dados de acesso e contato</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  
                  {[
                    ["name", "Nome do responsável"], ["email", "E-mail de acesso"], ["phone", "Telefone"],
                    ["companyName", "Razão social"], ["cnpj", "CNPJ"], ["state", "UF"],
                    ["municipality", "Município"], ["primarySegment", "Segmento principal"],
                  ].map(([key, label]) => <label key={key} className="block text-xs font-semibold text-slate-600">{label}<input value={editForm[key] ?? ""} onChange={event => setEditForm(current => ({ ...current, [key]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>)}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#102B4E]">Perfil comercial e cobertura</h3>
                <p className="mt-1 text-xs text-slate-500">Separe vários itens por vírgula.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {[
                    ["segments", "Outros segmentos"], ["products", "Produtos comercializados"], ["services", "Serviços prestados"],
                    ["keywords", "Palavras-chave"], ["servedStates", "Estados atendidos"], ["servedMunicipalities", "Municípios atendidos"],
                    ["catmatCodes", "Códigos CATMAT"], ["catserCodes", "Códigos CATSER"],
                  ].map(([key, label]) => <label key={key} className="block text-xs font-semibold text-slate-600">{label}<textarea rows={2} value={editForm[key] ?? ""} onChange={event => setEditForm(current => ({ ...current, [key]: event.target.value }))} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>)}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#102B4E]">Faixa de valores de interesse</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {[
                    ["minimumValue", "Valor mínimo (R$)"], ["maximumValue", "Valor máximo (R$)"],
                  ].map(([key, label]) => <label key={key} className="block text-xs font-semibold text-slate-600">{label}<input inputMode="decimal" value={editForm[key] ?? ""} onChange={event => setEditForm(current => ({ ...current, [key]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>)}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#102B4E]">Preferências de notificação</h3>
                <label className="mt-3 block text-xs font-semibold text-slate-600">Configuração em JSON<textarea rows={5} spellCheck={false} value={editForm.notificationPreferences ?? "{}"} onChange={event => setEditForm(current => ({ ...current, notificationPreferences: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs font-normal text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
              </div>
              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:flex-row sm:justify-end sm:px-7">
                <button type="button" disabled={updateCustomer.isPending} onClick={() => setEditingCustomer(null)} className="min-h-10 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancelar</button>
                <button type="submit" disabled={updateCustomer.isPending} className="min-h-10 rounded-lg bg-[#087eaa] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#066b92] disabled:cursor-wait disabled:opacity-60">{updateCustomer.isPending ? "Salvando alterações…" : "Salvar todos os dados"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function PermissionsPage() {
  const roles = [
    ["superadmin", "Administrador Geral", "Acesso total ao painel administrativo e aos módulos protegidos."],
    ["admin", "Administrador", "Operação administrativa, fontes e financeiro, conforme as regras do servidor."],
    ["source_operator", "Operador de fontes", "Sincronização e configuração das fontes oficiais."],
    ["finance", "Financeiro", "Consulta dos indicadores e registros financeiros."],
    ["support", "Suporte", "Papel previsto no modelo de acesso; ações específicas dependem de endpoints próprios."],
    ["user", "Cliente", "Acesso somente aos recursos da própria conta e empresa."],
  ];
  return <section className="rounded-xl border bg-white p-5">
    <h2 className="font-semibold text-[#102B4E]">Matriz de papéis do sistema</h2>
    <p className="mt-1 text-sm text-slate-500">As permissões são conferidas no backend em cada operação. Esta tela é informativa; não permite elevar privilégios pela interface.</p>
    <div className="mt-5 divide-y">{roles.map(([key, title, detail]) => <div key={key} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:gap-5"><span className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-cyan-800">{key}</span><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div></div>)}</div>
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">A promoção do Administrador Geral continuará sendo feita por procedimento controlado, após cadastro e confirmação do e-mail. Nenhum usuário pode conceder superadmin a si próprio.</div>
  </section>;
}

function PlanPricingEditor() {
  const listing = trpc.admin.planPricing.list.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.planPricing.update.useMutation({
    onSuccess: async () => {
      await listing.refetch();
      await utils.billing.plans.invalidate();
      toast.success("Preços atualizados no catálogo.");
    },
    onError: error => toast.error(error.message),
  });
  const [drafts, setDrafts] = useState<Record<string, { monthly: string; annual: string }>>({});
  const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const cents = (value: string) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : NaN;
  };
  return <div className="rounded-xl border bg-white p-5">
    <h3 className="font-semibold">Preços dos planos</h3>
    <p className="mt-1 text-sm text-slate-600">Somente o Superadmin pode alterar valores. Os novos preços são usados no catálogo e nas novas contratações; assinaturas já cobradas exigem análise das regras do provedor.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {listing.data?.map(plan => {
        const draft = drafts[plan.id] ?? { monthly: reais(plan.monthlyPriceCents), annual: reais(plan.annualPriceCents) };
        const monthly = cents(draft.monthly), annual = cents(draft.annual);
        return <div key={plan.id} className="rounded-lg border p-4">
          <div className="mb-3 font-semibold">{plan.name}</div>
          <label className="block text-sm">Mensal (R$)<input type="text" inputMode="decimal" aria-label={`Preço mensal de ${plan.name}`} className="mt-1 w-full rounded-lg border p-2" value={draft.monthly} onChange={e => setDrafts(old => ({...old,[plan.id]:{...draft,monthly:e.target.value}}))}/></label>
          <label className="mt-3 block text-sm">Anual (R$)<input type="text" inputMode="decimal" aria-label={`Preço anual de ${plan.name}`} className="mt-1 w-full rounded-lg border p-2" value={draft.annual} onChange={e => setDrafts(old => ({...old,[plan.id]:{...draft,annual:e.target.value}}))}/></label>
          <button className="mt-4 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={update.isPending || !Number.isFinite(monthly) || !Number.isFinite(annual)} onClick={() => { if (confirm(`Confirmar novos valores do plano ${plan.name}?`)) update.mutate({id:plan.id,monthlyPriceCents:monthly,annualPriceCents:annual}); }}>Salvar preços</button>
        </div>;
      })}
    </div>
    {listing.isLoading && <p className="mt-3 text-sm">Carregando planos…</p>}
    {listing.error && <p className="mt-3 text-sm text-red-700">{listing.error.message}</p>}
  </div>;
}

function SettingsPage() {
  const settings = trpc.admin.settings.get.useQuery();
  const save = trpc.admin.settings.save.useMutation({ onSuccess: () => { settings.refetch(); toast.success("Configuração salva."); }, onError: e => toast.error(e.message) });
  const announce = trpc.admin.settings.announce.useMutation({ onSuccess: r => { toast.success(`Comunicado enviado para ${r.sent} clientes.`); setTitle(""); setMessage(""); }, onError: e => toast.error(e.message) });
  const [tab, setTab] = useState<"branding" | "experience" | "notifications" | "plans" | "security" | "audit">("branding");
  const [brandName, setBrandName] = useState("OrbeEdital");
  const [tagline, setTagline] = useState("Oportunidades públicas em um só lugar");
  const [welcome, setWelcome] = useState("Bem-vindo ao OrbeEdital");
  const [showWelcome, setShowWelcome] = useState(true);
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(true);
  const [recommendationLimit, setRecommendationLimit] = useState(6);
  const [title, setTitle] = useState(""); const [message, setMessage] = useState(""); const [audience, setAudience] = useState<"all" | "active">("all");
  useEffect(() => { const data = settings.data ?? {}; const b = data.branding ?? {}; const e = data.experience ?? {}; setBrandName(typeof b.name === "string" ? b.name : "OrbeEdital"); setTagline(typeof b.tagline === "string" ? b.tagline : "Oportunidades públicas em um só lugar"); setWelcome(typeof e.welcome === "string" ? e.welcome : "Bem-vindo ao OrbeEdital"); setShowWelcome(e.showWelcome !== false); const r = data.recommendations ?? {}; setRecommendationsEnabled(r.enabled !== false); setRecommendationLimit(typeof r.maxItems === "number" ? r.maxItems : 6); }, [settings.data]);
  const tabs = [{id:"branding",label:"Identidade visual"},{id:"experience",label:"Experiência"},{id:"notifications",label:"Notificações"},{id:"plans",label:"Planos e recursos"},{id:"security",label:"Segurança"},{id:"audit",label:"Auditoria"}] as const;
  return <section className="space-y-5">
    <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold text-[#102B4E]">Central de configurações</h2><p className="mt-1 text-sm text-slate-500">Configurações persistidas, validadas no servidor e registradas na auditoria.</p><div className="mt-4 flex flex-wrap gap-2">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab===t.id?"bg-[#102B4E] text-white":"border bg-white text-slate-600 hover:bg-slate-50"}`}>{t.label}</button>)}</div></div>
    {tab === "branding" && <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Identidade visual</h3><p className="mt-1 text-sm text-slate-500">Dados institucionais persistidos para uso pelos componentes que consumirem as configurações globais.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Nome público<input value={brandName} onChange={e=>setBrandName(e.target.value)} maxLength={60} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm font-medium">Slogan<input value={tagline} onChange={e=>setTagline(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border px-3 py-2"/></label></div><button disabled={save.isPending || !brandName.trim()} onClick={()=>save.mutate({key:"branding",value:{name:brandName.trim(),tagline:tagline.trim()}})} className="mt-4 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending?"Salvando…":"Salvar identidade"}</button></div>}
    {tab === "experience" && <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Experiência do cliente</h3><label className="mt-4 block text-sm font-medium">Mensagem de boas-vindas<input value={welcome} onChange={e=>setWelcome(e.target.value)} maxLength={140} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={showWelcome} onChange={e=>setShowWelcome(e.target.checked)}/> Exibir saudação no portal</label><button disabled={save.isPending} onClick={()=>save.mutate({key:"experience",value:{welcome:welcome.trim(),showWelcome}})} className="mt-4 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar experiência</button></div>}
    {tab === "notifications" && <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Comunicado aos clientes</h3><p className="mt-1 text-sm text-slate-500">O comunicado será entregue na central de notificações do portal.</p><label className="mt-4 block text-sm font-medium">Título<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="mt-3 block text-sm font-medium">Mensagem<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="mt-3 block text-sm font-medium">Destinatários<select value={audience} onChange={e=>setAudience(e.target.value as "all"|"active")} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="all">Todos os clientes</option><option value="active">Clientes com assinatura ativa</option></select></label><button disabled={announce.isPending || title.trim().length<3 || message.trim().length<5} onClick={()=>{if(confirm("Enviar este comunicado aos destinatários selecionados?"))announce.mutate({title,message,audience});}} className="mt-4 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{announce.isPending?"Enviando…":"Enviar comunicado"}</button></div>}
    {tab === "plans" && <><div className="rounded-xl border bg-white p-5"><h3 className="font-semibold text-[#102B4E]">Recomendações por perfil da empresa</h3><p className="mt-1 text-sm text-slate-500">Controle global da seleção de oportunidades na Visão geral. Mudanças são registradas na auditoria.</p><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={recommendationsEnabled} onChange={e => setRecommendationsEnabled(e.target.checked)}/> Habilitar recomendações personalizadas</label><label className="mt-3 block text-sm">Quantidade máxima de sugestões por cliente<input type="number" min={1} max={12} value={recommendationLimit} onChange={e => setRecommendationLimit(Number(e.target.value))} className="mt-1 block w-32 rounded-lg border px-3 py-2"/></label><button disabled={save.isPending || recommendationLimit < 1 || recommendationLimit > 12} onClick={() => save.mutate({key:"recommendations",value:{enabled:recommendationsEnabled,maxItems:recommendationLimit}})} className="mt-4 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar recomendações</button></div><PlanPricingEditor /><Link href="/app/admin/finance" className="mt-3 inline-flex rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white">Abrir gestão financeira</Link></>}
    {tab === "security" && <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Segurança</h3><p className="mt-1 text-sm text-slate-600">Suspensão de contas, encerramento de sessões e controle de papéis já estão disponíveis em Clientes e usuários. Políticas globais de duração de sessão e autenticação ainda não são editáveis para evitar alterações sem efeito garantido.</p><Link href="/app/admin/customers" className="mt-3 inline-flex rounded-lg border px-4 py-2 text-sm font-semibold">Abrir gestão de contas</Link></div>}
    {tab === "audit" && <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Auditoria</h3><p className="mt-1 text-sm text-slate-600">As alterações de configurações e os comunicados são registrados com responsável, data e resumo.</p><Link href="/app/admin/audit" className="mt-3 inline-flex rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white">Consultar trilha de auditoria</Link></div>}
    {settings.isLoading && <p className="text-sm text-slate-500">Carregando configurações…</p>}
    {settings.isError && <p className="text-sm text-rose-600">Não foi possível carregar as configurações: {settings.error.message}</p>}
  </section>;
}

export default function AdminConsole() {
  const auth = useAuth();
  const [path, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sectionFromPath = (value: string): Section => {
    const candidate = value.split("/").filter(Boolean).at(-1) as Section | undefined;
    return candidate && nav.some(item => item.id === candidate) ? candidate : "overview";
  };
  const section = sectionFromPath(path);
  const selectSection = (next: Section) => {
    navigate(next === "overview" ? "/app/admin" : `/app/admin/${next}`);
    setMobileMenuOpen(false);
  };
  const me = auth.user as (typeof auth.user & { role?: string; name?: string; email?: string }) | null;
  const allowed = me?.role === "superadmin";

  useEffect(() => {
    if (!auth.loading && !auth.user) navigate("/app/admin/login");
  }, [auth.loading, auth.user, navigate]);
  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
    return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  }, []);

  if (auth.loading || !auth.user) return <div className="grid min-h-screen place-items-center text-slate-500">Abrindo acesso administrativo…</div>;
  if (!me?.emailVerifiedAt || !allowed) return <AccessDenied />;

  const logout = async () => { await auth.logout(); navigate("/"); };
  const current = nav.find(item => item.id === section)!;
  const Icon = current.icon;
  return <div className="min-h-screen bg-[#f4f7fb] text-slate-800 lg:flex">
    {mobileMenuOpen && <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"/>}
    <button type="button" aria-label="Abrir menu de navegação" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} className="fixed left-4 top-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-[#102B4E] text-white shadow-lg ring-1 ring-white/20 transition hover:bg-[#17416f] active:scale-95 lg:hidden"><Menu size={21}/></button>
    <aside className={`${mobileMenuOpen ? "fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] shadow-2xl" : "hidden"} flex-col border-r border-[#0b2542] bg-gradient-to-b from-[#0b2542] via-[#102f50] to-[#164666] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[216px] lg:shrink-0 lg:border-r-0 lg:shadow-none`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-5"><BrandMark variant="dark"/><div className="flex items-center gap-2"><button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden"><X size={19}/></button></div></div>
      <div className="px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-cyan-200">Administração</p></div>
      <nav aria-label="Administração" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {navGroups.map(group => <div key={group.title} className="mb-2 min-w-0 lg:min-w-0">
          <p className="mb-1 px-2.5 text-[9px] font-bold uppercase tracking-[.14em] text-[#55c4e6]">{group.title}</p>
          <div className="space-y-px">{group.items.map(item => { const ItemIcon = item.icon; return <button key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => selectSection(item.id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition ${section === item.id ? "bg-[#087eaa] font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] ring-1 ring-cyan-200/30" : "text-[#d8e8f5] hover:bg-[#1d496b] hover:text-white"}`}><ItemIcon size={15}/><span>{item.label}</span>{section === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-600"/>}</button>; })}</div>
        </div>)}
      </nav>
      <div className="border-t border-white/15 p-3 sm:p-4"><div className="rounded-md bg-white/5 p-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#55c4e6]">Sessão administrativa</p><p className="mt-1.5 truncate text-xs font-semibold">{me.name}</p><p className="truncate text-[11px] text-[#a9c6dc]">{me.email}</p><span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Superadmin verificado</span></div><button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-blue-100 hover:bg-white/10 hover:text-white"><LogOut size={16}/> Sair</button><Link href="/app" className="mt-1 flex items-center gap-2 px-3 py-2 text-xs text-blue-200 hover:text-white"><ArrowLeft size={14}/> Voltar ao portal do cliente</Link></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="relative z-10 border-b border-slate-200/90 bg-white/95 px-4 pb-4 pt-20 sm:px-7 sm:pt-20 lg:sticky lg:top-0 lg:py-4">
        <div className="mx-auto max-w-[1540px]">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-cyan-800">OrbeEdital <span className="mx-1 text-slate-300">/</span> Administração geral <span className="mx-1 text-slate-300">/</span> {current.label}</p><span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck size={14}/> Sessão verificada</span></div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">{greeting}, {me.name?.split(" ")[0] ?? "administrador"}.</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102B4E] sm:text-3xl">{current.label}</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">{sectionDescriptions[section]}</p></div><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Área restrita · Superadmin</span></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1540px] space-y-6 p-5 sm:p-8">
        {section === "overview" && <AdminOverview isAdmin={true} onOpenSources={() => selectSection("sources")}/>}
        {section === "customers" && <CustomerDirectory/>}
        {section === "sources" && <SourcesPage isAdmin={true}/>}
        {section === "radar" && <RadarPilotPage/>}
        {section === "finance" && <FinancePage isAdmin={true}/>}
        {section === "permissions" && <PermissionsPage/>}
        {section === "audit" && <AdminAuditPage/>}
        {section === "support" && <AdminSupportPage/>}
        {section === "ia" && <AdminOrbeAIPage/>}
        {section === "settings" && <SettingsPage/>}
      </div>
    </main>
  </div>;
}

function RadarPilotPage() {
 const review = trpc.admin.radarReview.useQuery();
 const [verification,setVerification]=useState<string|null>(null);
 const [deadline,setDeadline]=useState("");
 const [evidence,setEvidence]=useState("");
 const verify=trpc.admin.radarVerify.useMutation({onSuccess:()=>{setVerification(null);setDeadline("");setEvidence("");void review.refetch();}});
 const change = trpc.admin.radarReviewStatus.useMutation({onSuccess:()=>{void review.refetch();}});
 const run = trpc.admin.radarPilot.useMutation({onSuccess:()=>{void review.refetch();}});
 const mgDiscovery = trpc.admin.radarMgDiscovery.useMutation({onSuccess:()=>{void review.refetch();}});
 const [source,setSource]=useState<"amm-mt"|"amm-mg">("amm-mt");
 const [ids,setIds]=useState("");
 const [saveReview,setSaveReview]=useState(false);
 return <section className="space-y-4 rounded-xl border bg-white p-5">
 <h2 className="text-lg font-bold">OrbeRadar · Extração experimental</h2>
 <div className="space-y-2 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
  <h3 className="font-bold text-cyan-950">AMM-MG · Descoberta automática</h3>
  <p className="text-sm text-slate-700">Pesquisa real de pregões, licitações e dispensas dos últimos sete dias, sem códigos. Resultados apenas na revisão privada; nenhuma oportunidade é publicada aos clientes.</p>
  <button type="button" className="rounded-lg bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={mgDiscovery.isPending||run.isPending} onClick={()=>mgDiscovery.mutate()}>{mgDiscovery.isPending?"Testando coleta AMM-MG…":"Testar coleta automática AMM-MG"}</button>
  {mgDiscovery.error && <p role="alert" className="text-sm text-red-700">Falha na coleta: {mgDiscovery.error.message}</p>}
  {mgDiscovery.data && <p role="status" className="text-sm text-cyan-950">{mgDiscovery.data.status==="busy"?"Outra coleta AMM-MG está em andamento.":"Coleta registrada na revisão privada. Confira candidatos e falhas no histórico abaixo."}</p>}
 </div>
 <select className="rounded border p-2" value={source} onChange={e=>{setSource(e.target.value as "amm-mt"|"amm-mg");run.reset();}} disabled={run.isPending}><option value="amm-mt">AMM-MT — descoberta</option><option value="amm-mg">AMM-MG — matérias por identificador</option></select>
 {source==="amm-mg" && <input className="block w-full rounded border p-2" value={ids} onChange={e=>setIds(e.target.value)} placeholder="Até 5 códigos de matéria separados por vírgula"/>}
 <p className="text-sm text-slate-600">{source==="amm-mt"?"Últimos sete dias. Até 12 publicações.":"Consulta de até cinco matérias por código, sem descoberta automática."} Nenhuma oportunidade será publicada na base dos clientes.</p>
 <label className="flex gap-2 items-center"><input type="checkbox" checked={saveReview} disabled={run.isPending} onChange={e=>setSaveReview(e.target.checked)}/> Salvar extração na área privada de revisão</label>
 <button className="rounded-lg bg-cyan-700 px-4 py-2 text-white disabled:opacity-50" disabled={run.isPending} onClick={()=>run.mutate({source,saveReview,ids:source==="amm-mg"?ids.split(/[,\s]+/).filter(Boolean):undefined})}>{run.isPending?"Consultando…":"Extrair avisos — teste"}</button>
 {run.error && <p role="alert" className="text-red-700">{run.error.message}</p>}
 {run.data && <div className="space-y-3"><p>{run.data.saved && <span>Extração armazenada para revisão · </span>}{run.data.notices.length} candidatos encontrados · {run.data.failures.length} falhas</p>
 <p className="text-sm text-slate-500">Todos aguardam revisão. Comparação preliminar com a base estadual correspondente; ausência de coincidência não garante registro inédito.</p>
 {run.data.notices.map(n=><article key={n.publicationId} className="rounded-lg border p-4"><h3 className="font-semibold">{n.object ?? n.title}</h3><p>{n.modality ?? "Licitação"}: {n.procurementNumber ?? "Não identificado"} · Processo: {n.processNumber ?? "Não identificado"}</p><p>{n.deadlineEvidence ?? "Prazo de propostas não identificado"}</p><p className="text-sm text-slate-600">Sessão: {n.sessionEvidence ?? "Não identificada"}</p><p className="text-amber-700 text-sm">Vigência não confirmada — não publicar sem validação.</p>{n.reviewReasons.map(reason=><p key={reason} className="text-sm text-slate-500">{reason}</p>)}<p className="font-semibold">{n.matches.length ? "Possível duplicidade" : "Sem coincidência encontrada"}</p>{n.matches.map(m=><p key={m.id} className="text-sm text-slate-600">{m.reason} — {m.title}</p>)}<a className="text-cyan-700 underline" href={n.url} target="_blank" rel="noreferrer">Publicação oficial</a></article>)}
 {run.data.failures.map((f,i)=><p key={i} className="text-red-700">{f}</p>)}</div>}
 <div className="space-y-3 border-t pt-4"><h2 className="text-lg font-bold">Central de revisão</h2><button className="rounded border px-3 py-2" onClick={()=>void review.refetch()} disabled={review.isFetching}>Atualizar histórico</button>{review.error && <p role="alert">{review.error.message}</p>}{change.error && <p role="alert">{change.error.message}</p>}<h3 className="font-semibold">Últimas extrações</h3>{review.data?.runs.map(r=><p key={r.id}>{r.source} · {new Date(r.started_at).toLocaleString("pt-BR")} · {r.status} · {r.candidate_count} candidatos</p>)}<h3 className="font-semibold">Candidatos armazenados</h3>{review.data?.candidates.length===0 && <p>Nenhum candidato armazenado.</p>}{review.data?.candidates.map(c=><article key={c.id} className="rounded border p-3 space-y-2"><p className="font-semibold">{c.payload?.object ?? c.payload?.title ?? c.publication_id}</p><p>{c.source} · {c.review_status==="rejected"?"Descartado":c.review_status==="verified"?"Verificado":"Aguardando revisão"}</p><p>{c.payload?.deadlineEvidence ?? "Prazo não identificado"}</p><a href={c.source_url} target="_blank" rel="noreferrer" className="underline">Publicação oficial</a>{c.review_status==="pending" && <button className="ml-3 rounded border px-3 py-1" onClick={()=>{setVerification(c.id);setDeadline("");setEvidence("");verify.reset();}}>Validar</button>}{verification===c.id && <div className="space-y-2"><label className="block">Prazo confirmado (horário de Brasília)<input className="block rounded border p-2" type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><textarea className="block w-full rounded border p-2" placeholder="Evidência na fonte oficial, prazo e conferência de duplicidade" value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={2000}/><button className="rounded border px-3 py-1" disabled={verify.isPending||!deadline||evidence.trim().length<15} onClick={()=>verify.mutate({id:c.id,deadline:new Date(deadline+":00-03:00").toISOString(),evidence})}>Confirmar validação sem publicar</button><button className="ml-2" onClick={()=>setVerification(null)}>Cancelar</button>{verify.error && <p role="alert">{verify.error.message}</p>}</div>}{c.review_status!=="verified" && <button className="ml-3 rounded border px-3 py-1" disabled={change.isPending} onClick={()=>change.mutate({id:c.id,status:c.review_status==="rejected"?"pending":"rejected"})}>{c.review_status==="rejected"?"Reabrir revisão":"Descartar"}</button>}</article>)}</div>
 </section>;
}
