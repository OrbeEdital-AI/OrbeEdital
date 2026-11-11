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
  const scheduledTaskCount = query.data?.sources.filter(source => Boolean(source.configuration?.scheduledTaskUid)).length ?? 0;
  return (
    <>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        <strong>Agendamentos externos: {scheduledTaskCount}/2 associações registradas.</strong> O painel mostra os callbacks gravados no OrbeEdital, mas não consulta o histórico interno do Heartbeat. Confira lá se cada tarefa continua habilitada e sem falhas; a tabela abaixo registra as execuções recebidas pelo aplicativo. A sincronização manual segue disponível.
      </div>
      <div className="grid gap-4">
        {query.data?.sources.map(source => (
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
                  Última execução: {date(source.lastRunAt)} · Próxima estimada:{" "}
                  {source.configuration?.scheduledTaskUid
                    ? date(source.nextRunAt)
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
        ))}
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
  const cards = [
    ["Usuários cadastrados", data.users],
    ["Oportunidades no catálogo", data.opportunities],
    ["Fontes configuradas", data.sourceCount],
    ["Assinaturas ativas", data.activeSubscribers],
    ["Assinaturas canceladas", data.canceledSubscriptions],
  ] as const;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-[#102B4E]">Operação OrbeEdital</h2>
        <p className="mt-1 text-sm text-slate-500">
          Indicadores calculados a partir dos dados efetivamente persistidos;
          pagamentos e MRR dependem do gateway ainda não conectado.
        </p>
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
        <div className="mt-4 divide-y">
          {data.sources.map((source: any) => (
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
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          O status do agendamento não é verificado automaticamente pelo app;
          confira o painel de tarefas antes de depender de atualização
          recorrente.
        </p>
      </section>
    </div>
  );
}
