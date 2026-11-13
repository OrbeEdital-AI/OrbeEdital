import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Database, LayoutDashboard,
  LogOut, Search, ShieldCheck, Users, Wallet, RefreshCw, LockKeyhole, History, Menu, X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import BrandMark from "@/components/BrandMark";
import { toast } from "sonner";
import { AdminOverview, FinancePage, SourcesPage } from "@/pages/portal/AdminPages";
import AdminAuditPage from "@/pages/AdminAuditPage";

type Section = "overview" | "customers" | "sources" | "finance" | "permissions" | "audit" | "settings";

const navGroups: { title: string; items: { id: Section; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { title: "Operação", items: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "sources", label: "Fontes e sincronizações", icon: Database },
  ]},
  { title: "Pessoas e acesso", items: [
    { id: "customers", label: "Clientes e usuários", icon: Users },
    { id: "permissions", label: "Papéis e permissões", icon: ShieldCheck },
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
  sources: "Acompanhe integrações ativas, fontes desativadas, agendamentos e execuções.",
  finance: "Consulte os registros financeiros disponíveis e identifique integrações pendentes.",
  permissions: "Entenda os papéis existentes e os limites de acesso aplicados no servidor.",
  audit: "Rastreie operações administrativas registradas e seus responsáveis.",
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
  const updatePlan = trpc.adminUsers.updatePlan.useMutation({
    onSuccess: async result => {
      toast.success(`Plano do cliente atualizado para ${result.planName}.`);
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
            <div className="flex items-center justify-between border-b px-5 py-3 text-sm text-slate-500"><span>{data?.total ?? 0} usuários encontrados</span><button onClick={() => query.refetch()} className="inline-flex items-center gap-2 font-medium text-cyan-800"><RefreshCw size={14}/> Atualizar</button></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Usuário</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Perfil / gestão</th><th className="px-4 py-3">Plano do cliente</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Segurança</th></tr></thead>
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
                    <td className="px-4 py-3 text-slate-600">{date(user.lastSignedIn)}</td><td className="px-4 py-3">{user.role !== "superadmin" && <button disabled={revokeSessions.isPending} onClick={() => { if (window.confirm("Encerrar todas as sessões deste usuário? Ele precisará entrar novamente.")) revokeSessions.mutate({ userId: user.id }); }} className="rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-40">Encerrar sessões</button>}</td>
                  </tr>)}
                  {!data?.items.length && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3">
              <span className="text-xs text-slate-500">Página {data?.page ?? page} de {Math.max(1, data?.pageCount ?? 1)} · 25 por página</span>
              <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button><button disabled={page >= (data?.pageCount ?? 1)} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button></div>
            </div>
          </>}
      </div>
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

function SettingsPage() {
  return <section className="rounded-xl border bg-white p-6">
    <h2 className="font-semibold text-[#102B4E]">Configurações globais</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Esta área será habilitada conforme cada configuração ganhar persistência, validação, trilha de auditoria e uma ação segura no servidor. Não exibiremos controles fictícios nem opções que ainda não tenham efeito real.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {[
        ["Identidade visual", "Nome, logotipo e elementos públicos do produto"],
        ["Experiência do cliente", "Saudação, limites de tela e preferências de exibição"],
        ["Notificações", "Mensagens operacionais e comunicados aos clientes"],
        ["Segurança", "Políticas de sessão, verificação e proteção de contas"],
        ["Planos e recursos", "Catálogo de planos e limites comerciais"],
        ["Auditoria", "Registro de ações administrativas e alterações críticas"],
      ].map(([title, description]) => <div key={title} className="rounded-lg border p-4"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p><span className="mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">A integrar com segurança</span></div>)}
    </div>
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
    <aside className={`${mobileMenuOpen ? "fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] shadow-2xl" : "hidden"} flex-col border-r border-slate-200 bg-[#102B4E] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[216px] lg:shrink-0 lg:border-r-0 lg:shadow-none`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3"><div className="flex min-w-0 items-center gap-2"><BrandMark showWordmark={false} className="shrink-0"/><span className="whitespace-nowrap text-[13px] font-extrabold tracking-[.12em] text-white">ORBE<span className="text-cyan-300">EDITAL</span></span></div><div className="flex items-center gap-2"><span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-100">Admin Geral</span><button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden"><X size={19}/></button></div></div>
      <div className="px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-cyan-200">Administração</p></div>
      <nav aria-label="Administração" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {navGroups.map(group => <div key={group.title} className="mb-2 min-w-0 lg:min-w-0">
          <p className="mb-1 px-2.5 text-[9px] font-bold uppercase tracking-[.14em] text-blue-300/70">{group.title}</p>
          <div className="space-y-px">{group.items.map(item => { const ItemIcon = item.icon; return <button key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => selectSection(item.id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition ${section === item.id ? "bg-white font-semibold text-[#102B4E] shadow-sm" : "text-blue-100 hover:bg-white/10"}`}><ItemIcon size={15}/><span>{item.label}</span>{section === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-600"/>}</button>; })}</div>
        </div>)}
      </nav>
      <div className="border-t border-white/10 p-2.5"><div className="rounded-md bg-white/5 p-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">Sessão administrativa</p><p className="mt-1.5 truncate text-xs font-semibold">{me.name}</p><p className="truncate text-[11px] text-blue-200">{me.email}</p><span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Superadmin verificado</span></div><button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-blue-100 hover:bg-white/10"><LogOut size={16}/> Sair</button><Link href="/app" className="mt-1 flex items-center gap-2 px-3 py-2 text-xs text-blue-200 hover:text-white"><ArrowLeft size={14}/> Voltar ao portal do cliente</Link></div>
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
        {section === "finance" && <FinancePage isAdmin={true}/>}
        {section === "permissions" && <PermissionsPage/>}
        {section === "audit" && <AdminAuditPage/>}
        {section === "settings" && <SettingsPage/>}
      </div>
    </main>
  </div>;
}
