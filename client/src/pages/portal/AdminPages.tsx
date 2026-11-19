import { useState } from "react";
import { Link } from "wouter";
import { CircleAlert, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { date, money, Loading, ErrorState, NoPermission, AdminStatusBadge, EmptyState, AdminPagination } from "./common";
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
    onSuccess: async () => { toast.success("Configuração da fonte salva no OrbeEdital."); await utils.admin.sources.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const [runSearch, setRunSearch] = useState("");
  const [runStatus, setRunStatus] = useState("all");
  const [runOrder, setRunOrder] = useState("newest");
  const [runPage, setRunPage] = useState(1);
  const [runPageSize, setRunPageSize] = useState(5);
  const [recoveryCnpj, setRecoveryCnpj] = useState("");
  const [recoveryFrom, setRecoveryFrom] = useState("");
  const [recoveryTo, setRecoveryTo] = useState("");
  const recover = trpc.admin.sources.recoverPncpByCnpj.useMutation({
    onSuccess: async result => {
      toast.success(`Recuperação concluída: ${result.inserted} novos e ${result.updated} atualizados. Confira a cobertura e os registros na lista de execuções.`);
      await utils.admin.sources.list.invalidate();
      await utils.admin.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [taskUids, setTaskUids] = useState<Record<string, string>>({});
  const [sourceConfirmation, setSourceConfirmation] = useState<{ title: string; description: string; action: () => void } | null>(null);
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
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-[#102B4E]">Recuperação direcionada de licitações — PNCP</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Pesquise publicações por CNPJ do órgão e intervalo de publicação. A operação consulta o PNCP, registra a sincronização e gera trilha de auditoria. Não garante que editais anulados ou fora dos filtros estejam abertos.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const cnpj = recoveryCnpj.replace(/\D/g, "");
          if (cnpj.length !== 14 || recoveryFrom > recoveryTo) {
            toast.error("Informe um CNPJ de 14 dígitos e um intervalo válido.");
            return;
          }
          const from = recoveryFrom.replace(/-/g, "");
          const to = recoveryTo.replace(/-/g, "");
          setSourceConfirmation({
            title: "Confirmar recuperação direcionada do PNCP",
            description: `Órgão CNPJ ${cnpj}. Publicações de ${recoveryFrom} até ${recoveryTo}. Consulta restrita à modalidade 6 e até 3 páginas por intervalo. Esta operação pode demorar, consumir recursos e não garante cobertura integral nem que todas as oportunidades estejam abertas.`,
            action: () => recover.mutate({ cnpj, publicationFrom: from, publicationTo: to, modalityCodes: [6], maxPages: 3 }),
          });
        }}>
          <label className="text-xs font-medium text-slate-600">CNPJ do órgão
            <input value={recoveryCnpj} onChange={e => setRecoveryCnpj(e.target.value)} inputMode="numeric" maxLength={18} required className="mt-1 block w-44 rounded-lg border px-3 py-2 text-sm" placeholder="14 dígitos" />
          </label>
          <label className="text-xs font-medium text-slate-600">Publicação inicial
            <input type="date" value={recoveryFrom} onChange={e => setRecoveryFrom(e.target.value)} required className="mt-1 block rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">Publicação final
            <input type="date" value={recoveryTo} onChange={e => setRecoveryTo(e.target.value)} required className="mt-1 block rounded-lg border px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={recover.isPending} className="rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{recover.isPending ? "Consultando PNCP…" : "Executar recuperação"}</button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Preencha o CNPJ e o período desejado. Nenhum órgão ou intervalo é selecionado automaticamente.</p>
      </section>
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
                disabled={configure.isPending}
                onClick={() => {
                  const nextEnabled = !source.enabled;
                  if (!nextEnabled) {
                    setSourceConfirmation({
                      title: `Desativar ${source.name}?`,
                      description: `A fonte ${source.name} deixará de participar das sincronizações habilitadas. O catálogo existente não será apagado, mas novas oportunidades dessa origem poderão deixar de chegar até a reativação.`,
                      action: () => configure.mutate({ code: source.code as "pncp" | "compras.gov.br", enabled: false }),
                    });
                  } else {
                    configure.mutate({ code: source.code as "pncp" | "compras.gov.br", enabled: true });
                  }
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
                disabled={configure.isPending}
                onClick={() => {
                  const minutes = Number(frequencyMinutes[source.code] ?? Math.round(source.frequencySeconds / 60));
                  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
                    toast.error("A frequência deve ser um número inteiro entre 5 e 1440 minutos.");
                    return;
                  }
                  configure.mutate({ code: source.code as "pncp" | "compras.gov.br", frequencySeconds: minutes * 60 });
                }}
              >
                Salvar frequência
              </button>
              <p className="basis-full text-xs leading-5 text-slate-500">Define o intervalo desejado entre as execuções automáticas da fonte. Ex.: 30 minutos = solicitar uma nova execução a cada meia hora. Isso salva a configuração no OrbeEdital; o agendador externo também precisa estar configurado para respeitar esse intervalo.</p>
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
              <p className="basis-full text-xs leading-5 text-slate-500">Task UID é o código único que o serviço de agendamento fornece quando você cria a tarefa. Cole esse código aqui para associar os callbacks daquela tarefa a esta fonte. Este campo não cria a tarefa; apenas vincula uma tarefa já criada.</p>
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
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-rose-800"><CircleAlert size={15}/> Último erro registrado</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-rose-900">{source.lastError}</p><p className="mt-2 text-xs text-rose-700">Consulte também as execuções recentes abaixo para comparar horário, status e quantidade de erros.</p></div>
            )}
          </article>
          </div>
        ))}
        {!orderedSources.length && <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">Nenhuma fonte cadastrada.</div>}
      </div>
      {sourceConfirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !recover.isPending && !configure.isPending) setSourceConfirmation(null); }}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="source-confirm-title" aria-describedby="source-confirm-description" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h2 id="source-confirm-title" className="text-lg font-bold text-slate-900">{sourceConfirmation.title}</h2>
          <p id="source-confirm-description" className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{sourceConfirmation.description}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus disabled={recover.isPending || configure.isPending} onClick={() => setSourceConfirmation(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={recover.isPending || configure.isPending} onClick={() => { const action = sourceConfirmation.action; setSourceConfirmation(null); action(); }} className="rounded-lg bg-[#102B4E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar operação</button>
          </div>
        </div>
      </div>}
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Execuções recentes</h3><button type="button" disabled={query.isFetching} onClick={() => { void query.refetch(); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""}/> Atualizar</button></div>
        <p className="mt-1 text-xs text-slate-500">Histórico limitado aos registros retornados pelo servidor. A paginação e os filtros atuam sobre esse conjunto.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Buscar execuções" placeholder="Buscar fonte" value={runSearch} onChange={e => { setRunSearch(e.target.value); setRunPage(1); }} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <select aria-label="Filtrar status das execuções" value={runStatus} onChange={e => { setRunStatus(e.target.value); setRunPage(1); }} className="rounded-lg border px-3 py-2 text-sm"><option value="all">Todos os status</option><option value="completed">Concluídas</option><option value="failed">Com falha</option><option value="running">Em andamento</option></select>
          <select aria-label="Ordenar execuções" value={runOrder} onChange={e => setRunOrder(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option></select>
        </div>
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
                {query.data.runs.filter((r: any) => (runStatus === "all" || r.run.status === runStatus) && String(r.sourceName ?? "").toLowerCase().includes(runSearch.toLowerCase())).sort((a: any, b: any) => (runOrder === "newest" ? -1 : 1) * (new Date(a.run.startedAt).getTime() - new Date(b.run.startedAt).getTime())).slice((runPage - 1) * runPageSize, runPage * runPageSize).map((r: any) => (
                  <tr className="border-t" key={r.run.id}>
                    <td className="py-2">{r.sourceName}</td>
                    <td><AdminStatusBadge status={r.run.status} /></td>
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
          <EmptyState message="Nenhuma sincronização registrada." />
        )}
        <AdminPagination total={query.data?.runs.filter((r: any) => (runStatus === "all" || r.run.status === runStatus) && String(r.sourceName ?? "").toLowerCase().includes(runSearch.toLowerCase())).length ?? 0} page={runPage} pageSize={runPageSize} onPageChange={setRunPage} onPageSizeChange={size => { setRunPageSize(size); setRunPage(1); }} />
      </section>
    </>
  );
}

export function FinancePage({ isAdmin }: { isAdmin: boolean }) {
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentOrder, setPaymentOrder] = useState("newest");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(5);
  const [refundConfirmation, setRefundConfirmation] = useState<{ paymentId: string; customer: string; company: string; amount: number; kind: "refund" | "reconcile" } | null>(null);
  const utils = trpc.useUtils();
  const refund = trpc.admin.refundPayment.useMutation({
    onSuccess: async result => {
      toast.success(`Estorno solicitado e confirmado: ${money(result.amountCents / 100)}. A assinatura foi cancelada.`);
      await utils.admin.finance.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reconcileRefund = trpc.admin.reconcileRefund.useMutation({
    onSuccess: async result => {
      toast.success(`Estorno externo confirmado. ${result.cancelledSubscriptions} assinatura(s) cancelada(s); acesso bloqueado.`);
      await utils.admin.finance.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const query = trpc.admin.finance.useQuery(undefined, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading)
    return <Loading label="Carregando indicadores financeiros…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => { void query.refetch(); }} />;
  const d = query.data!;
  const filteredPayments = (d.payments ?? []).filter((payment: any) => {
    const text = [payment.customerName, payment.customerEmail, payment.companyName, payment.planName, payment.providerPaymentId].join(" ").toLowerCase();
    return (paymentStatus === "all" || payment.status === paymentStatus) && text.includes(paymentSearch.toLowerCase());
  }).sort((a: any, b: any) => (paymentOrder === "newest" ? -1 : 1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  const visiblePayments = filteredPayments.slice((paymentPage - 1) * paymentPageSize, paymentPage * paymentPageSize);
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
      <div className={`rounded-xl border p-4 text-sm ${d.configured ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <strong>{d.configured ? "Mercado Pago configurado." : "Gateway não conectado."}</strong> {d.note}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Contratações e pagamentos</h2>
            <p className="mt-1 text-xs text-slate-500">Últimos 100 registros. Datas e status conforme dados persistidos no OrbeEdital.</p>
          </div>
          <button type="button" onClick={() => query.refetch()} className="rounded-lg border px-3 py-2 text-xs font-semibold">Atualizar</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input aria-label="Buscar pagamentos" placeholder="Buscar cliente, empresa, plano ou ID" value={paymentSearch} onChange={e => { setPaymentSearch(e.target.value); setPaymentPage(1); }} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <select aria-label="Filtrar pagamentos" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPaymentPage(1); }} className="rounded-lg border px-3 py-2 text-sm"><option value="all">Todos os status</option><option value="approved">Pagos</option><option value="pending">Pendentes</option><option value="refunded">Estornados</option><option value="cancelled">Cancelados</option></select>
          <select aria-label="Ordenar pagamentos" value={paymentOrder} onChange={e => setPaymentOrder(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option></select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="border-b text-slate-500">
              <tr><th className="p-2">Cliente / empresa</th><th className="p-2">Plano</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">Meio / pagamento</th><th className="p-2">Contratação</th><th className="p-2">Renovação</th><th className="p-2">Ação</th></tr>
            </thead>
            <tbody>
              {visiblePayments.map((payment: any) => {
                const status = payment.status === "approved" ? "Pago" : payment.status === "pending" ? "Aguardando pagamento" : payment.status === "refunded" ? "Estornado" : payment.status === "cancelled" ? "Cancelado" : payment.status;
                let meta: any = {};
                try { meta = JSON.parse(payment.rawStatus || "{}"); } catch { /* optional metadata */ }
                const canRefund = payment.status === "approved" && Boolean(payment.providerPaymentId);
                return <tr key={payment.id} className="border-b align-top">
                  <td className="p-2"><div className="font-semibold text-slate-800">{payment.customerName || "Cliente"}</div><div className="text-slate-500">{payment.customerEmail || "—"}</div><div className="text-slate-500">{payment.companyName}</div></td>
                  <td className="p-2">{payment.planName || "—"}<div className="text-slate-500">{payment.billingInterval === "annual" ? "Anual" : "Mensal"}</div></td>
                  <td className="p-2 font-semibold">{money(payment.amountCents / 100)}</td>
                  <td className="p-2"><AdminStatusBadge status={payment.status} /><div className="text-slate-500">Assinatura: {payment.subscriptionStatus || "—"}</div></td>
                  <td className="p-2">{meta.pixQrCode ? "Pix manual" : "Cartão / recorrente"}<div>{payment.paidAt ? date(payment.paidAt) : "Aguardando confirmação"}</div><div className="text-slate-500">{payment.providerPaymentId ? `ID ${payment.providerPaymentId}` : "Sem ID externo"}</div></td>
                  <td className="p-2">{date(payment.contractedAt || payment.createdAt)}</td>
                  <td className="p-2">{payment.renewalAt ? date(payment.renewalAt) : payment.status === "pending" ? "Após confirmação" : "—"}</td>
                  <td className="p-2">{canRefund ? <div className="flex flex-col items-start gap-2"><button type="button" disabled={refund.isPending || reconcileRefund.isPending} onClick={() => setRefundConfirmation({ paymentId: payment.providerPaymentId, customer: payment.customerName || payment.customerEmail || "Cliente", company: payment.companyName || "Empresa não informada", amount: payment.amountCents, kind: "refund" })} className="rounded-lg border border-rose-300 px-3 py-2 font-semibold text-rose-700 disabled:opacity-50">Estornar</button><button type="button" disabled={reconcileRefund.isPending || refund.isPending} onClick={() => setRefundConfirmation({ paymentId: payment.providerPaymentId, customer: payment.customerName || payment.customerEmail || "Cliente", company: payment.companyName || "Empresa não informada", amount: payment.amountCents, kind: "reconcile" })} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">Sincronizar estorno externo</button></div> : <span className="text-slate-400">{payment.status === "refunded" ? "Estornado" : "—"}</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
          {!d.payments?.length && <p className="py-6 text-center text-sm text-slate-500">Nenhuma contratação ou pagamento registrado.</p>}
        </div>
        <AdminPagination total={filteredPayments.length} page={paymentPage} pageSize={paymentPageSize} onPageChange={setPaymentPage} onPageSizeChange={size => { setPaymentPageSize(size); setPaymentPage(1); }} />
      </section>
      {refundConfirmation && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !refund.isPending && !reconcileRefund.isPending) setRefundConfirmation(null); }}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="refund-confirm-title" aria-describedby="refund-confirm-description" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h2 id="refund-confirm-title" className="text-lg font-bold text-slate-900">{refundConfirmation.kind === "refund" ? "Confirmar estorno de pagamento" : "Conferir estorno realizado no Mercado Pago"}</h2>
          <div id="refund-confirm-description" className="mt-4 space-y-2 text-sm text-slate-700">
            <p><strong>Cliente:</strong> {refundConfirmation.customer}</p>
            <p><strong>Empresa:</strong> {refundConfirmation.company}</p>
            <p><strong>Valor:</strong> {money(refundConfirmation.amount / 100)}</p>
            <p><strong>ID do pagamento:</strong> <span className="break-all font-mono">{refundConfirmation.paymentId}</span></p>
            {refundConfirmation.kind === "refund" ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900">O OrbeEdital solicitará o estorno ao Mercado Pago e cancelará a assinatura vinculada após confirmação. Essa ação pode interromper o acesso e impedir renovações.</p> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Esta ação não solicita um novo estorno. Ela verifica o pagamento no Mercado Pago e, se o estorno integral estiver confirmado, pode cancelar todas as assinaturas vinculadas à empresa e bloquear seu acesso.</p>}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus disabled={refund.isPending || reconcileRefund.isPending} onClick={() => setRefundConfirmation(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Voltar sem alterar</button>
            <button type="button" disabled={refund.isPending || reconcileRefund.isPending} onClick={() => { const action = refundConfirmation; if (action.kind === "refund") refund.mutate({ paymentId: action.paymentId }, { onSuccess: () => setRefundConfirmation(null) }); else reconcileRefund.mutate({ paymentId: action.paymentId }, { onSuccess: () => setRefundConfirmation(null) }); }} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{refund.isPending || reconcileRefund.isPending ? "Processando…" : refundConfirmation.kind === "refund" ? "Confirmar estorno" : "Verificar e reconciliar"}</button>
          </div>
        </div>
      </div>}
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

export function AdminOverview({ isAdmin, onOpenSources }: { isAdmin: boolean; onOpenSources?: () => void }) {
  const query = trpc.admin.overview.useQuery(undefined, { enabled: isAdmin });
  if (!isAdmin) return <NoPermission />;
  if (query.isLoading) return <Loading label="Carregando visão geral…" />;
  if (query.error) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const data = query.data!;
  const activeSources = data.sources.filter((source: any) => source.enabled);
  const now = Date.now();
  const sourceIssues = activeSources.filter((source: any) => {
    const last = source.lastRunAt ? new Date(source.lastRunAt).getTime() : NaN;
    const frequency = Number(source.frequencySeconds);
    return source.status === "error" || !Number.isFinite(last) ||
      now - last > Math.max(8 * 60 * 60 * 1000, (Number.isFinite(frequency) ? frequency : 0) * 2000);
  });
  const recentRuns = data.recentRuns.slice(0, 5);
  const recentSuccesses = data.recentRuns.filter(({ run }: any) => run.status === "completed");
  const recentNew = recentSuccesses.reduce((sum: number, { run }: any) => sum + Number(run.insertedCount ?? 0), 0);
  const recentFailures = data.recentRuns.filter(({ run }: any) => run.status === "failed").length;
  const metrics = [
    { label: "Clientes cadastrados", value: data.users },
    { label: "Assinaturas ativas", value: data.activeSubscribers },
    { label: "Oportunidades no catálogo", value: data.opportunities },
    { label: "Fontes em operação", value: activeSources.length },
  ];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#102B4E]">Visão geral</h2>
          <p className="mt-1 text-sm text-slate-500">O essencial para acompanhar a operação do OrbeEdital.</p>
        </div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} /> Atualizar
        </button>
      </header>

      <section aria-label="Indicadores essenciais" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(metric => (
          <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#102B4E]">{Number(metric.value).toLocaleString("pt-BR")}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { title: "Clientes e assinaturas", detail: "Contas, planos e acessos", href: "/app/admin/customers" },
          { title: "Financeiro", detail: "Pagamentos e cobranças", href: "/app/admin/finance" },
          { title: "Atendimento", detail: "Solicitações dos clientes", href: "/app/admin/support" },
        ].map(item => (
          <Link key={item.title} href={item.href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">
            <p className="text-sm font-bold text-[#102B4E]">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-cyan-800">Abrir área →</span>
          </Link>
        ))}
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Novas nas coletas recentes", value: recentNew },
          { label: "Coletas concluídas", value: recentSuccesses.length },
          { label: "Coletas com falha", value: recentFailures },
        ].map(item => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#102B4E]">{item.value.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-slate-400">Histórico recente, não necessariamente últimas 24h</p>
          </article>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#102B4E]">O que precisa de atenção</h3>
          {sourceIssues.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{sourceIssues.length} pendência(s)</span>}
        </div>
        {sourceIssues.length ? (
          <div className="mt-3 divide-y divide-slate-100">
            {sourceIssues.map((source: any) => (
              <div key={source.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{source.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{source.status === "error" ? "A última situação registrada indica falha." : "Execução atrasada ou ainda não registrada."} Última tentativa: {date(source.lastRunAt)}.</p>
                </div>
                <button type="button" onClick={onOpenSources} className="text-xs font-semibold text-cyan-800 hover:underline">Verificar fonte</button>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">Nenhuma fonte ativa com falha ou atraso identificado.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#102B4E]">Funcionamento da plataforma</h3>
          <button type="button" onClick={onOpenSources} className="text-xs font-semibold text-cyan-800 hover:underline">Ver detalhes</button>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {activeSources.map((source: any) => {
            const hasIssue = sourceIssues.some((issue: any) => issue.code === source.code);
            return (
              <div key={source.code} className="flex items-center justify-between gap-3 py-3">
                <p className="text-sm font-semibold text-slate-800">{source.name}</p>
                <span className={`shrink-0 text-xs font-semibold ${hasIssue ? "text-rose-700" : "text-emerald-700"}`}>
                  {hasIssue ? "Com falha" : "Em operação"}
                </span>
              </div>
            );
          })}
          {!activeSources.length && <p className="py-3 text-sm text-slate-500">Nenhuma fonte em operação.</p>}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#102B4E]">Atividade recente de coleta</h3>
          <button type="button" onClick={onOpenSources} className="text-xs font-semibold text-cyan-800 hover:underline">Histórico completo</button>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {recentRuns.map(({ run, sourceName }: any) => (
            <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{sourceName}</p>
                <p className="mt-1 text-xs text-slate-500">{date(run.startedAt)} · {Number(run.insertedCount ?? 0).toLocaleString("pt-BR")} novas</p>
              </div>
              <span className={run.status === "failed" ? "text-xs font-semibold text-rose-700" : "text-xs font-semibold text-emerald-700"}>{run.status === "completed" ? "Concluída" : run.status === "failed" ? "Falhou" : "Em andamento"}</span>
            </div>
          ))}
          {!recentRuns.length && <p className="py-3 text-sm text-slate-500">Nenhuma coleta registrada.</p>}
        </div>
      </section>
    </div>
  );
}
