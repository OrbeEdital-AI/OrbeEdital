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
  const failedSources = data.sources.filter((source: any) => source.status === "error" || Number(source.errorCount) > 0);
  const metrics = [
    { label: "Usuários", value: data.users, detail: "contas cadastradas" },
    { label: "Oportunidades", value: data.opportunities, detail: "no catálogo" },
    { label: "Fontes habilitadas", value: activeSources.length, detail: `de ${data.sourceCount} cadastradas` },
    { label: "Assinaturas", value: data.activeSubscribers, detail: "registros ativos" },
  ] as const;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Painel de controle</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#102B4E]">Resumo executivo</h2>
          <p className="mt-1 text-sm text-slate-500">Indicadores essenciais e situação operacional em um só lugar.</p>
        </div>
        <button onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={13} className={query.isFetching ? "animate-spin" : ""} /> Atualizar dados
        </button>
      </section>

      <section aria-label="Indicadores principais" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 xl:grid-cols-4 xl:divide-y-0">
          {metrics.map((metric, index) => (
            <article key={metric.label} className={`px-4 py-4 sm:px-5 ${index > 1 ? "xl:border-l xl:border-slate-100" : ""}`}>
              <p className="text-xs font-medium text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[#102B4E]">{Number(metric.value).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[11px] text-slate-400">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#102B4E]">Integrações e fontes de dados</h3>
            <p className="mt-1 text-xs text-slate-500">Separação entre habilitação da fonte e saúde da última operação registrada.</p>
          </div>
          <Link className="text-xs font-semibold text-cyan-800 hover:underline" href="/app/admin/sources">Abrir gestão de fontes →</Link>
        </div>
        <div className="grid md:grid-cols-2">
          <div className="p-5 md:border-r md:border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h4 className="text-sm font-semibold text-slate-800">Habilitadas</h4>
              </div>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{activeSources.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Podem participar da rotina de sincronização.</p>
            <div className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
              {activeSources.length ? activeSources.map((source: any) => (
                <div key={source.code} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">{source.name}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${source.status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{source.status === "error" ? "Com falha" : "Habilitada"}</span>
                </div>
              )) : <p className="py-3 text-xs text-slate-400">Nenhuma fonte habilitada.</p>}
            </div>
          </div>
          <div className="bg-slate-50/60 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <h4 className="text-sm font-semibold text-slate-800">Desabilitadas</h4>
              </div>
              <span className="rounded-md bg-slate-200/70 px-2 py-1 text-xs font-bold text-slate-700">{inactiveSources.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Pausadas e fora da rotina de sincronização.</p>
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {inactiveSources.length ? inactiveSources.map((source: any) => (
                <div key={source.code} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium text-slate-600">{source.name}</span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">Pausada</span>
                </div>
              )) : <p className="py-3 text-xs text-slate-400">Nenhuma fonte desabilitada.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#102B4E]">Pontos de atenção</h3>
              <p className="mt-1 text-xs text-slate-500">Itens que merecem acompanhamento operacional.</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-bold ${failedSources.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{failedSources.length} alerta(s)</span>
          </div>
          {failedSources.length ? (
            <div className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
              {failedSources.map((source: any) => (
                <div key={source.code} className="flex items-start justify-between gap-3 py-3">
                  <div><p className="text-sm font-semibold text-slate-700">{source.name}</p><p className="mt-0.5 text-xs text-slate-500">Há falha ou erro registrado no histórico desta fonte.</p></div>
                  <span className="shrink-0 text-xs font-semibold text-rose-700">Verificar</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-emerald-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">Nenhuma falha registrada nas fontes.</p>
              <p className="mt-1 text-xs text-emerald-700/80">Continue acompanhando as execuções e os callbacks recebidos.</p>
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-[#102B4E]">Resumo de disponibilidade</h3>
          <p className="mt-1 text-xs text-slate-500">Distribuição atual das integrações cadastradas.</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600">Habilitadas</span><span className="font-semibold text-slate-700">{activeSources.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${data.sourceCount ? (activeSources.length / data.sourceCount) * 100 : 0}%` }} /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600">Desabilitadas</span><span className="font-semibold text-slate-700">{inactiveSources.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-400" style={{ width: `${data.sourceCount ? (inactiveSources.length / data.sourceCount) * 100 : 0}%` }} /></div>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">{data.sourceCount} fonte(s) cadastrada(s). A disponibilidade do agendador externo não é consultada diretamente por este painel.</p>
        </article>
      </section>

      <p className="px-1 text-[11px] leading-5 text-slate-400">Observação: os indicadores refletem os dados persistidos no OrbeEdital. Indicadores financeiros dependem da integração com um gateway de pagamento.</p>
    </div>
  );
}
