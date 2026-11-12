import { useState } from "react";
import { Link } from "wouter";
import { CircleAlert, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { date, money, Loading, ErrorState, NoPermission } from "./common";
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
  const allSources = query.data?.sources ?? [];
  const activeSources = allSources.filter(source => source.enabled);
  const inactiveSources = allSources.filter(source => !source.enabled);
  const sourcesWithErrors = allSources.filter(source => source.status === "error" || Number(source.errorCount) > 0);
  const scheduledTaskCount = allSources.filter(source => Boolean(source.configuration?.scheduledTaskUid)).length;
  const orderedSources = [...allSources].sort((a, b) => Number(b.enabled) - Number(a.enabled));
  return (
    <>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        <strong>Agendamentos externos: {scheduledTaskCount}/2 associações registradas.</strong> O painel mostra os callbacks gravados no OrbeEdital, mas não consulta o histórico interno do Heartbeat. Confira lá se cada tarefa continua habilitada e sem falhas; a tabela abaixo registra as execuções recebidas pelo aplicativo. A sincronização manual segue disponível.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Fontes cadastradas", value: allSources.length, tone: "slate" },
          { label: "Ativas", value: activeSources.length, tone: "emerald" },
          { label: "Desativadas", value: inactiveSources.length, tone: "slate" },
          { label: "Com histórico de erros", value: sourcesWithErrors.length, tone: "rose" },
        ].map(item => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#102B4E]">{item.value}</p>
          </article>
        ))}
      </div>
      <div className="space-y-7">
        {orderedSources.map((source, index) => (
          <div key={source.code} className="space-y-4">
            {(index === 0 || source.enabled !== orderedSources[index - 1]?.enabled) && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-[#102B4E]">{source.enabled ? "Fontes ativas" : "Fontes desativadas"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{source.enabled ? "Integrações habilitadas para operação e sincronização." : "Integrações cadastradas, mas pausadas. Não executam sincronização manual."}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${source.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                  {source.enabled ? activeSources.length : inactiveSources.length} {source.enabled ? "ativas" : "desativadas"}
                </span>
              </div>
            )}
          <article
            className={`rounded-xl border bg-white p-5 ${source.enabled ? "border-emerald-200" : "border-slate-200 opacity-90"}`}
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
                  Última sincronização: {date(source.lastRunAt)} · Próxima estimada:{" "}
                  {source.configuration?.scheduledTaskUid
                    ? date(source.nextRunAt)
                    : "não agendada"}{" "}
                  · Importados: {source.importedCount} · Erros:{" "}
                  {source.errorCount} · Duração média:{" "}
                  {source.averageDurationMs ?? "—"} ms
                </p>
                {(() => {
                  const callback = query.data?.scheduleEvents.find(event => event.entityId === source.code);
                  const status = callback?.action === "source.schedule.completed" ? "sincronização concluída" : callback ? "falha na sincronização" : "nenhum callback registrado pelo aplicativo";
                  return <p className="mt-1 text-xs text-slate-600">Último callback externo confirmado: {callback ? date(callback.createdAt) + " · " + status : status}</p>;
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${source.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{source.enabled ? "Ativa" : "Desativada"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${source.status === "error" ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-800"}`}>Operação: {source.status}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                disabled={!source.enabled || run.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() =>
                  run.mutate({
                    sourceCode: source.code as "pncp" | "compras.gov.br",
                    daysBack: 7,
                    modalityCodes: [6],
                    maxPages: 1,
                  })
                }
              >
                <RefreshCw
                  className={run.isPending ? "animate-spin" : ""}
                  size={15}
                />
                Sincronizar últimos 7 dias
              </button>
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() =>
                  configure.mutate({
                    code: source.code as "pncp" | "compras.gov.br",
                    enabled: !source.enabled,
                  })
                }
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
          </div>
        ))}
        {!orderedSources.length && <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">Nenhuma fonte cadastrada.</div>}
      </div>
      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-semibold">Execuções recentes</h3>
        {query.data?.runs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2">Fonte</th>
                  <th>Status</th>
                  <th>Início</th>
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
                    <td>{date(r.run.startedAt)}</td>
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
    </>
  );
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
  if (query.isLoading) return <Loading label="Carregando dados administrativos…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const data = query.data!;
  const activeSources = data.sources.filter((source: any) => source.enabled);
  const inactiveSources = data.sources.filter((source: any) => !source.enabled);
  const sourcesWithErrors = data.sources.filter((source: any) => source.status === "error" || Number(source.errorCount) > 0).length;
  const metrics = [
    { label: "Usuários cadastrados", value: data.users, hint: "Contas na plataforma" },
    { label: "Oportunidades", value: data.opportunities, hint: "No catálogo" },
    { label: "Fontes ativas", value: activeSources.length, hint: `${data.sourceCount} cadastradas`, tone: "emerald" },
    { label: "Assinaturas ativas", value: data.activeSubscribers, hint: "Registros persistidos" },
  ] as const;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#102B4E]">Resumo da plataforma</h2>
            <p className="mt-1 text-sm text-slate-500">Visão rápida dos principais números operacionais.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">Dados persistidos no OrbeEdital</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => (
            <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[#102B4E]">{Number(metric.value).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs text-slate-400">{metric.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#102B4E]">Saúde das integrações</h3>
            <p className="mt-1 text-sm text-slate-500">Fontes habilitadas e pausadas, sem misturar disponibilidade com estado de execução.</p>
          </div>
          <Link className="text-sm font-semibold text-cyan-800 hover:underline" href="/app/admin/sources">Gerenciar fontes →</Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><h4 className="text-sm font-semibold text-emerald-900">Ativas</h4></div>
              <span className="text-xl font-bold text-emerald-900">{activeSources.length}</span>
            </div>
            <p className="mt-1 text-xs text-emerald-800/80">Habilitadas para operação e sincronização.</p>
            <div className="mt-3 space-y-2">
              {activeSources.length ? activeSources.map((source: any) => (
                <div key={source.code} className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{source.name}</span>
                  <span className={`text-xs font-semibold ${source.status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{source.status === "error" ? "Com falha" : "Habilitada"}</span>
                </div>
              )) : <p className="rounded-md bg-white/80 px-3 py-3 text-sm text-slate-500">Nenhuma fonte ativa.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400"/><h4 className="text-sm font-semibold text-slate-800">Desativadas</h4></div>
              <span className="text-xl font-bold text-slate-800">{inactiveSources.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Cadastradas, mas fora da rotina de sincronização.</p>
            <div className="mt-3 space-y-2">
              {inactiveSources.length ? inactiveSources.map((source: any) => (
                <div key={source.code} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{source.name}</span>
                  <span className="text-xs font-medium text-slate-500">Pausada</span>
                </div>
              )) : <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">Nenhuma fonte desativada.</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{data.sourceCount} fontes cadastradas</span>
          <span className={sourcesWithErrors ? "font-semibold text-rose-700" : "text-emerald-700"}>{sourcesWithErrors} com histórico de erro</span>
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
          O painel registra os callbacks recebidos pelo aplicativo, mas não consulta diretamente o estado interno do agendador. Pagamentos e MRR dependem da conexão de um gateway.
        </p>
      </section>
    </div>
  );
}
