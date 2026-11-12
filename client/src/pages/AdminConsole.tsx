import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, CreditCard, Database, LayoutDashboard,
  LogOut, Search, ShieldCheck, Users, Wallet, RefreshCw, LockKeyhole,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import BrandMark from "@/components/BrandMark";
import { AdminOverview, FinancePage, SourcesPage } from "@/pages/portal/AdminPages";

type Section = "overview" | "customers" | "sources" | "finance" | "permissions" | "settings";

const nav: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "customers", label: "Clientes e usuários", icon: Users },
  { id: "sources", label: "Fontes de dados", icon: Database },
  { id: "finance", label: "Planos e financeiro", icon: Wallet },
  { id: "permissions", label: "Acessos e permissões", icon: ShieldCheck },
  { id: "settings", label: "Configurações gerais", icon: LockKeyhole },
];

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
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Usuário</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3">Último acesso</th></tr></thead>
                <tbody>
                  {data?.items.map(user => <tr key={user.id} className="border-t">
                    <td className="px-5 py-3"><p className="font-semibold text-slate-800">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                    <td className="px-4 py-3">{user.companyName ?? "Não vinculada"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{user.role}</span></td>
                    <td className="px-4 py-3">{user.emailVerifiedAt ? <span className="text-emerald-700">Verificado</span> : <span className="text-amber-700">Pendente</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{date(user.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{date(user.lastSignedIn)}</td>
                  </tr>)}
                  {!data?.items.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>}
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
  const [, navigate] = useLocation();
  const [section, setSection] = useState<Section>("overview");
  const me = auth.user as (typeof auth.user & { role?: string; name?: string; email?: string }) | null;
  const allowed = me?.role === "superadmin";

  useEffect(() => {
    if (!auth.loading && !auth.user) navigate("/admin/login");
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
    <aside className="flex flex-col border-b border-slate-200 bg-[#102B4E] text-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><BrandMark/><span className="rounded-full bg-cyan-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">Admin Geral</span></div>
      <div className="px-5 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Painel de controle</p><p className="mt-1 text-sm text-blue-100">Gestão central do OrbeEdital</p></div>
      <nav aria-label="Administração" className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
        {nav.map(item => { const ItemIcon = item.icon; return <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${section === item.id ? "bg-white text-[#102B4E]" : "text-blue-100 hover:bg-white/10"}`}><ItemIcon size={17}/>{item.label}</button>; })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4"><p className="truncate text-sm font-semibold">{me.name}</p><p className="truncate text-xs text-blue-200">{me.email}</p><button onClick={logout} className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-white/10"><LogOut size={16}/> Sair</button><Link href="/app" className="mt-2 flex items-center gap-2 px-3 py-2 text-xs text-blue-200 hover:text-white"><ArrowLeft size={14}/> Voltar ao portal do cliente</Link></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-widest text-cyan-800">OrbeEdital / Administração geral</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-[#102B4E]">{current.label}</h1><p className="mt-1 text-sm text-slate-500">{greeting}, {me.name?.split(" ")[0] ?? "administrador"}. Controle central da plataforma.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck size={14}/> Sessão verificada · Superadmin</span></div></header>
      <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
        {section === "overview" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between text-sm text-slate-500">Controle de usuários<Users size={18}/></div><p className="mt-3 text-lg font-bold text-[#102B4E]">Clientes e acessos</p><p className="mt-1 text-xs text-slate-500">Cadastro, verificação e papéis</p></div><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between text-sm text-slate-500">Operação de dados<Database size={18}/></div><p className="mt-3 text-lg font-bold text-[#102B4E]">Fontes oficiais</p><p className="mt-1 text-xs text-slate-500">PNCP e Compras.gov.br</p></div><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between text-sm text-slate-500">Planos e cobrança<CreditCard size={18}/></div><p className="mt-3 text-lg font-bold text-[#102B4E]">Financeiro</p><p className="mt-1 text-xs text-slate-500">Gateway ainda não conectado</p></div><div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between text-sm text-slate-500">Governança<LockKeyhole size={18}/></div><p className="mt-3 text-lg font-bold text-[#102B4E]">Acesso protegido</p><p className="mt-1 text-xs text-slate-500">Permissões no servidor</p></div></div><AdminOverview isAdmin={true}/></>}
        {section === "customers" && <CustomerDirectory/>}
        {section === "sources" && <SourcesPage isAdmin={true}/>}
        {section === "finance" && <FinancePage isAdmin={true}/>}
        {section === "permissions" && <PermissionsPage/>}
        {section === "settings" && <SettingsPage/>}
      </div>
    </main>
  </div>;
}
