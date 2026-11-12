import { useState } from "react";
import { Link } from "wouter";
import { Ban, CheckCircle2, CircleAlert, ExternalLink, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import BrandMark from "@/components/BrandMark";
import { date, dateTime, money, Loading, ErrorState, NoPermission } from "./common";
export function SourcesPage({ isAdmin }: { isAdmin: boolean }) {
  const query = trpc.admin.sources.list.useQuery(undefined, {
    enabled: isAdmin,
  });
  const utils = trpc.useUtils();
  const run = trpc.admin.sources.run.useMutation({
    onSuccess: async result => {
      toast.success(
        `Sincronização concluída: ${result.inserted} novos, ${result.updated} atualizados.`
      );
      await utils.admin.sources.list.invalidate();
      await utils.dashboard.summary.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const configure = trpc.admin.sources.configure.useMutation({
    onSuccess: () => utils.admin.sources.list.invalidate(),
    onError: e => toast.error(e.message),
  });
  const [taskUids, setTaskUids] = useState<Record<string, string>>({});
  const [frequencyMinutes, setFrequencyMinutes] = useState<
    Record<string, string>
  >({});
  const [runPage, setRunPage] = useState(1);
  const [runSource, setRunSource] = useState<"" | "pncp" | "compras.gov.br">("");
  const [runStatus, setRunStatus] = useState("");
  const [runFrom, setRunFrom] = useState("");
  const [runTo, setRunTo] = useState("");
  const runsQuery = trpc.admin.sources.runs.useQuery({ page: runPage, pageSize: 25, sourceCode: runSource || undefined, status: runStatus || undefined, from: runFrom || undefined, to: runTo || undefined }, { enabled: isAdmin });
  const saveTask = trpc.admin.sources.setScheduledTask.useMutation({
    onSuccess: async () => {
      toast.success(
        "Task UID registrado. A tarefa precisa existir e apontar para este endpoint publicado."
      );
      await utils.admin.sources.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading) return <Loading label="Carregando fontes…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  const scheduledTaskCount = query.data?.sources.filter(source => Boolean(source.configuration?.scheduledTaskUid)).length ?? 0;
  const activeSources = query.data?.sources.filter(source => source.enabled) ?? [];
  const inactiveSources = query.data?.sources.filter(source => !source.enabled) ?? [];
  return (
    <>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        <strong>Agendamentos externos: {scheduledTaskCount}/2 associações registradas.</strong> O painel mostra os callbacks gravados no OrbeEdital, mas não consulta o histórico interno do Heartbeat. Confira lá se cada tarefa continua habilitada e sem falhas; a tabela abaixo registra as execuções recebidas pelo aplicativo. A sincronização manual segue disponível.
      </div>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-800">Fontes ativas ({activeSources.length})</h3>
        <div className="grid gap-4">
        {activeSources.map(source => (
          <article
            className="rounded-xl border border-slate-200 bg-white p-5"
            key={source.code}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#102B4E]">{source.name}</h2>
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-800 hover:underline"
                  href={source.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.baseUrl}
                  <ExternalLink size={12} />
                </a>
                <p className="mt-2 text-xs text-slate-500">
                  Última execução: {dateTime(source.lastRunAt)} · Próxima estimada:{" "}
                  {source.configuration?.scheduledTaskUid
                    ? dateTime(source.nextRunAt)
                    : "não agendada"}{" "}
                  · Importados: {source.importedCount} · Erros:{" "}
                  {source.errorCount} · Duração média:{" "}
                  {source.averageDurationMs ?? "—"} ms
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                {source.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                disabled={!source.enabled || run.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(`Executar sincronização manual de ${source.name}? A consulta respeitará os limites configurados da fonte.`)) return;
                  run.mutate({
                    sourceCode: source.code as "pncp" | "compras.gov.br",
                    daysBack: 7,
                    modalityCodes: [6],
                    maxPages: 1,
                  });
                }}
              >
                <RefreshCw
                  className={run.isPending ? "animate-spin" : ""}
                  size={15}
                />
                Sincronizar últimos 7 dias
              </button>
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => {
                  if (source.enabled && !window.confirm(`Desativar ${source.name}? A coleta automática ficará pausada.`)) return;
                  configure.mutate({
                    code: source.code as "pncp" | "compras.gov.br",
                    enabled: !source.enabled,
                  });
                }}
              >
                {source.enabled ? "Desativar" : "Ativar"}
              </button>
              <label className="text-xs text-slate-600">
                Frequência (minutos)
                <input
                  type="number"
                  min={5}
                  max={1440}
                  className="ml-2 w-24 rounded-md border px-2 py-1.5 text-sm"
                  value={
                    frequencyMinutes[source.code] ??
                    String(Math.round(source.frequencySeconds / 60))
                  }
                  onChange={event =>
                    setFrequencyMinutes(value => ({
                      ...value,
                      [source.code]: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() =>
                  configure.mutate({
                    code: source.code as "pncp" | "compras.gov.br",
                    frequencySeconds:
                      Number(
                        frequencyMinutes[source.code] ??
                          Math.round(source.frequencySeconds / 60)
                      ) * 60,
                  })
                }
              >
                Salvar frequência
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
              <label className="text-xs font-medium text-slate-600">
                Task UID após criar a tarefa
                <input
                  className="mt-1 block w-80 max-w-full rounded-md border px-3 py-2 text-sm font-normal"
                  value={
                    taskUids[source.code] ??
                    String(source.configuration?.scheduledTaskUid ?? "")
                  }
                  onChange={event =>
                    setTaskUids(value => ({
                      ...value,
                      [source.code]: event.target.value,
                    }))
                  }
                  placeholder="Identificador retornado pelo agendador"
                />
              </label>
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                disabled={saveTask.isPending}
                onClick={() =>
                  saveTask.mutate({
                    code: source.code as "pncp" | "compras.gov.br",
                    taskUid:
                      taskUids[source.code] ??
                      String(source.configuration?.scheduledTaskUid ?? ""),
                  })
                }
              >
                Salvar associação
              </button>
              <span className="text-xs text-slate-500">
                Associação cadastrada:{" "}
                {source.configuration?.scheduledTaskUid ? "sim" : "não"}
              </span>
            </div>
            {source.lastError && (
              <p className="mt-3 flex items-center gap-2 text-xs text-rose-700">
                <CircleAlert size={14} />
                {source.lastError}
              </p>
            )}
          </article>
        ))}
      </div>
        {!activeSources.length && <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Nenhuma fonte ativa.</p>}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Fontes desativadas ({inactiveSources.length})</h3>
        <div className="grid gap-4">
          {inactiveSources.map(source => (
            <article className="rounded-xl border border-slate-200 bg-white p-5 opacity-90" key={source.code}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-[#0b2442]">{source.name}</h2>
                  <p className="mt-2 text-xs text-slate-500">Última execução: {dateTime(source.lastRunAt)} · Importados: {source.importedCount} · Erros: {source.errorCount}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Desativada</span>
              </div>
              <button className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={() => configure.mutate({ code: source.code as "pncp" | "compras.gov.br", enabled: true })}>Ativar fonte</button>
            </article>
          ))}
          {!inactiveSources.length && <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Nenhuma fonte desativada.</p>}
        </div>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-semibold">Execuções recentes</h3>
        {query.data?.runs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2">Fonte</th>
                  <th>Status</th>
                  <th>Executada em</th>
                  <th>Novos</th>
                  <th>Atualizados</th>
                  <th>Erros</th>
                </tr>
              </thead>
              <tbody>
                {query.data.runs.slice(0, 12).map((r: any) => (
                  <tr className="border-t" key={r.run.id}>
                    <td className="py-2">{r.sourceName}</td>
                    <td>{r.run.status}</td>
                    <td>{dateTime(r.run.startedAt)}</td>
                    <td>{r.run.insertedCount}</td>
                    <td>{r.run.updatedCount}</td>
                    <td>{r.run.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Nenhuma sincronização registrada.
          </p>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div><h3 className="font-semibold">Histórico detalhado de sincronizações</h3><p className="mt-1 text-xs text-slate-500">Consulta persistida no PostgreSQL, com filtros e paginação.</p></div>
          <label className="ml-auto text-xs text-slate-600">Fonte<select className="ml-2 rounded-lg border px-2 py-1.5 text-sm" value={runSource} onChange={event => { setRunSource(event.target.value as typeof runSource); setRunPage(1); }}><option value="">Todas</option><option value="pncp">PNCP</option><option value="compras.gov.br">Compras.gov.br</option></select></label>
          <label className="text-xs text-slate-600">Status<input className="ml-2 w-28 rounded-lg border px-2 py-1.5 text-sm" value={runStatus} onChange={event => { setRunStatus(event.target.value); setRunPage(1); }} placeholder="completed" /></label>
          <label className="text-xs text-slate-600">De<input type="date" className="ml-2 rounded-lg border px-2 py-1.5 text-sm" value={runFrom} onChange={event => { setRunFrom(event.target.value); setRunPage(1); }} /></label>
          <label className="text-xs text-slate-600">Até<input type="date" className="ml-2 rounded-lg border px-2 py-1.5 text-sm" value={runTo} onChange={event => { setRunTo(event.target.value); setRunPage(1); }} /></label>
        </div>
        {runsQuery.isLoading ? <Loading label="Carregando histórico…" /> : runsQuery.error ? <ErrorState message={runsQuery.error.message} onRetry={() => runsQuery.refetch()} /> : runsQuery.data?.items.length ? <><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Fonte</th><th>Status</th><th>Início</th><th>Fim</th><th>Capturados</th><th>Novos</th><th>Atualizados</th><th>Ignorados</th><th>Erros</th></tr></thead><tbody>{runsQuery.data.items.map(item => <tr className="border-t" key={item.run.id}><td className="py-2">{item.sourceName}</td><td>{item.run.status}</td><td>{dateTime(item.run.startedAt)}</td><td>{dateTime(item.run.finishedAt)}</td><td>{item.run.fetchedCount}</td><td>{item.run.insertedCount}</td><td>{item.run.updatedCount}</td><td>{typeof item.run.metadata.skipped === "number" ? item.run.metadata.skipped : "—"}</td><td>{item.run.errorCount}</td></tr>)}</tbody></table></div><AdminPagination page={runsQuery.data.page} totalPages={runsQuery.data.totalPages} total={Number(runsQuery.data.total)} onChange={setRunPage} /></> : <p className="mt-4 text-sm text-slate-500">Nenhuma execução corresponde aos filtros informados.</p>}
      </section>
    </>
  );
}

function AdminPagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-slate-500">
    <span>{total.toLocaleString("pt-BR")} registros · página {page} de {totalPages}</span>
    <div className="flex gap-2">
      <button className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <button className="rounded-lg border px-3 py-1.5 disabled:opacity-40" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Próxima</button>
    </div>
  </div>;
}

export function UsersPage({ isAdmin, canManageUsers }: { isAdmin: boolean; canManageUsers: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | "user" | "admin" | "superadmin" | "source_operator" | "support" | "finance">("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const utils = trpc.useUtils();
  const query = trpc.admin.users.useQuery({ page, pageSize: 25, search: search || undefined, role: role || undefined, status: status || undefined }, { enabled: isAdmin });
  const suspend = trpc.admin.suspendUser.useMutation({ onSuccess: async () => { toast.success("Usuário suspenso."); await utils.admin.users.invalidate(); await utils.admin.audit.invalidate(); }, onError: e => toast.error(e.message) });
  const reactivate = trpc.admin.reactivateUser.useMutation({ onSuccess: async () => { toast.success("Usuário reativado."); await utils.admin.users.invalidate(); await utils.admin.audit.invalidate(); }, onError: e => toast.error(e.message) });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading) return <Loading label="Carregando usuários…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <section className="rounded-xl border bg-white p-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-64 flex-1 text-xs font-medium text-slate-600">Buscar por nome ou e-mail
        <div className="mt-1 flex items-center rounded-lg border px-3"><Search size={15} className="text-slate-400" /><input className="w-full border-0 px-2 py-2 text-sm outline-none" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Ex.: empresa@dominio.com" /></div>
      </label>
      <label className="text-xs font-medium text-slate-600">Perfil
        <select className="mt-1 block rounded-lg border px-3 py-2 text-sm" value={role} onChange={event => { setRole(event.target.value as typeof role); setPage(1); }}><option value="">Todos</option><option value="user">Cliente</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option><option value="source_operator">Operador de fontes</option><option value="support">Suporte</option><option value="finance">Financeiro</option></select>
      </label>
      <label className="text-xs font-medium text-slate-600">Situação
        <select className="mt-1 block rounded-lg border px-3 py-2 text-sm" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="">Todas</option><option value="active">Ativos</option><option value="suspended">Suspensos</option></select>
      </label>
    </div>
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Usuário</th><th>Empresa</th><th>Perfil</th><th>Situação</th><th>Verificação</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>{query.data?.items.map(user => <tr className="border-t" key={user.id}><td className="py-3"><p className="font-medium text-[#102B4E]">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td><td>{user.companyName || "Não vinculada"}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{user.role}</span></td><td>{user.suspendedAt ? <span className="inline-flex items-center gap-1 text-rose-700"><Ban size={14} /> Suspenso</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Ativo</span>}</td><td>{user.emailVerifiedAt ? <span className="text-emerald-700">Confirmado</span> : <span className="text-amber-700">Pendente</span>}</td><td>{date(user.lastSignedIn)}</td><td>{canManageUsers && (user.suspendedAt ? <button className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800" disabled={reactivate.isPending} onClick={() => { if (window.confirm(`Reativar a conta de ${user.name}?`)) reactivate.mutate({ userId: user.id }); }}><CheckCircle2 size={14} /> Reativar</button> : <button className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-800" disabled={suspend.isPending || user.role === "superadmin"} title={user.role === "superadmin" ? "A proteção de superadministradores impede esta ação pela interface." : undefined} onClick={() => { const reason = window.prompt(`Motivo da suspensão de ${user.name}:`); if (reason?.trim() && window.confirm("Confirmar suspensão? Esta ação impede o login e será registrada na auditoria.")) suspend.mutate({ userId: user.id, reason: reason.trim() }); }}><Ban size={14} /> Suspender</button>)}</td></tr>)}</tbody></table></div>
    <AdminPagination page={query.data?.page ?? 1} totalPages={query.data?.totalPages ?? 1} total={Number(query.data?.total ?? 0)} onChange={setPage} />
  </section>;
}

export function AdminOpportunitiesPage({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = trpc.admin.opportunities.useQuery({ page, pageSize: 25, search: search || undefined }, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading) return <Loading label="Carregando editais…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <section className="rounded-xl border bg-white p-5"><div className="flex items-end gap-3"><label className="min-w-64 flex-1 text-xs font-medium text-slate-600">Buscar edital, órgão ou número<div className="mt-1 flex items-center rounded-lg border px-3"><Search size={15} className="text-slate-400" /><input className="w-full border-0 px-2 py-2 text-sm outline-none" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Termo de busca" /></div></label></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Edital</th><th>Fonte</th><th>Órgão</th><th>UF</th><th>Publicação</th><th>Prazo</th></tr></thead><tbody>{query.data?.items.map(item => <tr className="border-t" key={item.id}><td className="max-w-sm py-3"><p className="truncate font-medium text-[#102B4E]">{item.title}</p><p className="text-xs text-slate-500">{item.controlNumber || item.sourceKey}</p></td><td>{item.sourceName}</td><td>{item.agencyName || "—"}</td><td>{item.state || "—"}</td><td>{date(item.publicationDate)}</td><td>{date(item.proposalDeadline)}</td></tr>)}</tbody></table></div><AdminPagination page={query.data?.page ?? 1} totalPages={query.data?.totalPages ?? 1} total={Number(query.data?.total ?? 0)} onChange={setPage} /></section>;
}

export function AuditPage({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const query = trpc.admin.audit.useQuery({ page, pageSize: 50 }, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading) return <Loading label="Carregando auditoria…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold text-[#102B4E]">Trilha de auditoria</h2><p className="mt-1 text-sm text-slate-500">Eventos persistidos pelo sistema para rastreabilidade administrativa.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Data</th><th>Ator</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>{query.data?.items.map(item => <tr className="border-t" key={item.id}><td className="py-3">{date(item.createdAt)}</td><td>{item.actorName || item.actorEmail || "Sistema"}</td><td><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs text-cyan-800">{item.action}</span></td><td>{item.entityType}{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ""}</td><td className="max-w-xs truncate text-xs text-slate-500">{JSON.stringify(item.details)}</td></tr>)}</tbody></table></div><AdminPagination page={query.data?.page ?? 1} totalPages={query.data?.totalPages ?? 1} total={Number(query.data?.total ?? 0)} onChange={setPage} /></section>;
}

export function FinancePage({ isAdmin }: { isAdmin: boolean }) {
  const query = trpc.admin.finance.useQuery(undefined, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading)
    return <Loading label="Carregando indicadores financeiros…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const d = query.data!;
  const cards = [
    ["Assinaturas ativas", d.activeSubscriptions],
    ["Receita mensal recorrente", money(d.mrrCents / 100)],
    ["Receita anualizada", money(d.arrCents / 100)],
    ["Canceladas", d.canceledSubscriptions],
    ["Inadimplência", d.overdueSubscriptions],
    ["Receita aprovada", money(d.approvedRevenueCents / 100)],
  ] as const;
  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Gateway não conectado.</strong> {d.note} Estes valores não
        representam cobranças processadas por Mercado Pago ou Asaas.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <article className="rounded-xl border bg-white p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-bold text-[#102B4E]">{value}</p>
          </article>
        ))}
      </div>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Pagamentos por status persistido</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(d.paymentsByStatus as Record<string, number>)
            .length ? (
            Object.entries(d.paymentsByStatus as Record<string, number>).map(
              ([key, value]) => (
                <span
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  key={key}
                >
                  {key}: {money(value / 100)}
                </span>
              )
            )
          ) : (
            <p className="text-sm text-slate-500">
              Sem pagamentos registrados.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

export function AdminOverview({ isAdmin }: { isAdmin: boolean }) {
  const query = trpc.admin.overview.useQuery(undefined, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading)
    return <Loading label="Carregando dados administrativos…" />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  const data = query.data!;
  const activeConnectors = data.sources.filter((source: any) => source.enabled);
  const inactiveConnectors = data.sources.filter((source: any) => !source.enabled);
  const cards = [
    ["Usuários cadastrados", data.users],
    ["Oportunidades no catálogo", data.opportunities],
    ["Fontes configuradas", data.sourceCount],
    ["Assinaturas ativas", data.activeSubscribers],
    ["Assinaturas canceladas", data.canceledSubscriptions],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <BrandMark className="mb-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
            Painel administrativo
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#102B4E]">
            Operação OrbeEdital
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Indicadores calculados a partir dos dados efetivamente persistidos;
            pagamentos e MRR dependem do gateway ainda não conectado.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <article className="rounded-xl border bg-white p-5" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-bold text-[#102B4E]">
              {Number(value).toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </div>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#102B4E]">
              Conectores configurados
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              As integrações de outros portais ainda não estão cadastradas.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-cyan-800"
            href="/app/admin/sources"
          >
            Gerenciar fontes →
          </Link>
        </div>
        <div className="mt-4 space-y-5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Ativos ({activeConnectors.length})</h4>
            <div className="mt-2 divide-y rounded-lg border">
          {activeConnectors.map((source: any) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 py-3"
              key={source.code}
            >
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-xs text-slate-500">
                  Última execução: {date(source.lastRunAt)} · Novos registros:{" "}
                  {source.importedCount} · Erros: {source.errorCount}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${source.status === "active" ? "bg-emerald-50 text-emerald-800" : source.status === "error" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600"}`}
              >
                {source.status}
              </span>
            </div>
          ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Desativados ({inactiveConnectors.length})</h4>
            <div className="mt-2 divide-y rounded-lg border">
          {inactiveConnectors.map((source: any) => (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-3" key={source.code}>
              <div><p className="font-medium">{source.name}</p><p className="text-xs text-slate-500">Última execução: {dateTime(source.lastRunAt)} · Importados: {source.importedCount}</p></div>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-600">Desativado</span>
            </div>
          ))}
            </div>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          O status do agendamento não é verificado automaticamente pelo app;
          confira o painel de tarefas antes de depender de atualização
          recorrente.
        </p>
      </section>
    </div>
  );
}
