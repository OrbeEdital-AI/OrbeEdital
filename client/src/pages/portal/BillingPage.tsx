import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { money, Loading, ErrorState } from "./common";

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = limit > 0 && percentage >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={nearLimit ? "font-semibold text-amber-700" : "text-slate-500"}>
          {limit === 0 ? `${used.toLocaleString("pt-BR")} utilizados · sem limite cadastrado` : `${used.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")} utilizados`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${nearLimit ? "bg-amber-500" : "bg-cyan-700"}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="text-xs text-slate-500">{limit === 0 ? "Sem limite numérico configurado" : `Restam ${Math.max(0, limit - used).toLocaleString("pt-BR")}`}</p>
    </div>
  );
}

export function BillingPage() {
  const [, navigate] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const plans = trpc.billing.plans.useQuery();
  const usage = trpc.billing.usage.useQuery();
  const profile = trpc.account.profile.useQuery();
  const utils = trpc.useUtils();
  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: async result => {
      if ("paymentId" in result) {
        sessionStorage.setItem("orbeedital_pix_payment", JSON.stringify(result));
        navigate("/pix-payment");
        return;
      }
      if ("checkoutUrl" in result) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      toast.success(`Plano alterado para ${result.planName} com sucesso.`);
      await Promise.all([utils.billing.usage.invalidate(), utils.billing.plans.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.assign(checkoutUrl); },
    onError: error => toast.error(error.message),
  });
  const pixCheckout = trpc.billing.pixCheckout.useMutation({
    onSuccess: result => { sessionStorage.setItem("orbeedital_pix_payment", JSON.stringify(result)); navigate("/pix-payment"); },
    onError: error => toast.error(error.message),
  });

  if (plans.isLoading || usage.isLoading) return <Loading label="Carregando planos e consumo…" />;
  if (plans.error) return <ErrorState message={plans.error.message} onRetry={() => plans.refetch()} />;
  if (usage.error) return <ErrorState message={usage.error.message} onRetry={() => usage.refetch()} />;

  const planList = plans.data ?? [];
  const essential = planList.find(plan => plan.code === "essencial");
  const professional = planList.find(plan => plan.code === "profissional");
  const quotaRows = [
    { label: "Pesquisas por mês", key: "maxSearchesPerMonth" as const },
    { label: "Favoritos por empresa", key: "maxFavorites" as const },
    { label: "Pesquisas salvas por empresa", key: "maxSavedSearches" as const },
  ];
  const quotaText = (value: number | undefined) => value === undefined ? "Não informado" : value === 0 ? "Sem limite numérico" : value.toLocaleString("pt-BR");
  const planQuota = (plan: typeof essential, key: typeof quotaRows[number]["key"]) => plan?.limits?.[key] === undefined ? undefined : Number(plan.limits[key]);
  const current = usage.data?.plan;

  const counters = usage.data?.usage;
  const limits = usage.data?.limits;
  const meters = current && counters && limits ? [
    { label: "Pesquisas de licitações neste mês", used: counters.searchesThisMonth, limit: Number(limits.maxSearchesPerMonth ?? 0) },
    { label: "Oportunidades favoritas", used: counters.favorites, limit: Number(limits.maxFavorites ?? 0) },
    { label: "Pesquisas salvas", used: counters.savedSearches, limit: Number(limits.maxSavedSearches ?? 0) },
  ] : [];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-5">
        <h2 className="font-semibold text-[#102B4E]">Planos e assinatura</h2>
        <p className="mt-1 text-sm leading-6 text-cyan-950">
          Escolha o plano ideal para monitorar licitações. Os limites são compartilhados pelos usuários da mesma empresa e o consumo de pesquisas é renovado a cada mês.
        </p>
      </section>

      {(plans.data ?? []).some(plan => plan.monthlyPriceCents > 0 && plan.monthlyPriceCents < 9900) && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Atenção aos preços cadastrados:</strong> há valores mensais abaixo de R$ 99,00. Confirme com a administração se são preços de teste antes de contratar. O checkout utilizará o valor atualmente cadastrado no sistema.</div>}
      {current ? (
        <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Seu plano atual</p>
              <h3 className="mt-1 text-xl font-bold text-[#102B4E]">{current.name}</h3>
              <p className="mt-1 text-sm text-slate-500">Status: {current.status === "trialing" ? "Período de avaliação" : "Ativo"}</p>
            </div>
            <p className="text-xl font-bold text-[#102B4E]">{money(current.monthlyPriceCents / 100)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {meters.map(meter => <UsageMeter key={meter.label} label={meter.label} used={meter.used} limit={meter.limit} />)}
          </div>
          <p className="text-xs text-slate-500">Cotas positivas são aplicadas conforme o plano. Limite zero no cadastro significa ausência de limite numérico, não recurso excluído.</p>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nenhuma assinatura ativa.</strong> Escolha um dos planos abaixo para liberar as pesquisas e os recursos do OrbeEdital.
        </section>
      )}

      {essential && professional && <section className="rounded-xl border bg-white p-5 shadow-sm" aria-labelledby="comparison-title">
        <h3 id="comparison-title" className="text-lg font-bold text-[#102B4E]">Comparação rápida dos planos</h3>
        <p className="mt-1 text-xs text-slate-500">Valores e cotas exibidos conforme o cadastro atual. As cotas abaixo são compartilhadas pela empresa, exceto o chat da IA.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead><tr className="border-b text-slate-600"><th scope="col" className="py-3 pr-3">Recurso</th><th scope="col" className="p-3">Essencial</th><th scope="col" className="p-3">Profissional</th></tr></thead>
            <tbody>
              {quotaRows.map(row => <tr key={row.key} className="border-b"><th scope="row" className="py-3 pr-3 font-medium">{row.label}</th><td className="p-3">{quotaText(planQuota(essential, row.key))}</td><td className="p-3 font-semibold">{quotaText(planQuota(professional, row.key))}</td></tr>)}
              {[
                ["PNCP, Compras.gov.br e filtros", "Incluído", "Incluído"],
                ["Análise de edital com IA", "Disponível", "Disponível"],
                ["Radar e busca assistida por IA", "Não incluído", "Incluído"],
                ["Chat Orbe IA", "Não incluído", "60 mensagens/usuário/dia"],
                ["Atendimento", "Padrão", "Prioritário"],
              ].map(row => <tr key={row[0]} className="border-b"><th scope="row" className="py-3 pr-3 font-medium">{row[0]}</th><td className="p-3">{row[1]}</td><td className="p-3 font-semibold">{row[2]}</td></tr>)}
            </tbody>
          </table>
        </div>
        {quotaRows.some(row => { const low = planQuota(essential, row.key); const high = planQuota(professional, row.key); return low !== undefined && high !== undefined && low > 0 && high > low; }) && <p className="mt-3 text-sm text-cyan-900">Diferença do Profissional: {quotaRows.map(row => { const low = planQuota(essential, row.key); const high = planQuota(professional, row.key); return low !== undefined && high !== undefined && low > 0 && high > low ? `+${(high - low).toLocaleString("pt-BR")} ${row.label.toLowerCase()}` : null; }).filter(Boolean).join(" · ")}.</p>}
      </section>}
      <section className="grid gap-4 md:grid-cols-2">
        {(plans.data ?? []).map(plan => {
          const isCurrent = current?.code === plan.code;
          const planLimits = plan.limits ?? {};
          const isProfessional = plan.code === "profissional";
          return (
            <article key={plan.id} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${plan.code === "profissional" ? "border-cyan-300 ring-1 ring-cyan-100" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[#102B4E]">{plan.name}</h3>
                {plan.code === "profissional" && <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-900">Mais completo</span>}
              </div>
              {plan.description && <p className="mt-2 text-sm text-slate-500">{plan.description}</p>}
              <p className="mt-5 text-3xl font-bold text-[#102B4E]">{money(plan.monthlyPriceCents / 100)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
              <div className="mt-4 flex-1 space-y-4 text-sm">
                <div><h4 className="font-bold text-[#102B4E]">Pesquisa e oportunidades</h4><p className="mt-2 text-slate-700">✓ Consulta de oportunidades PNCP e Compras.gov.br</p><p className="mt-1 text-slate-700">✓ Filtros de pesquisa</p></div>
                <div><h4 className="font-bold text-[#102B4E]">Organização e alertas</h4><p className="mt-2 text-slate-700">✓ Favoritos e pesquisas salvas, conforme as cotas</p><p className="mt-1 text-slate-700">✓ Recursos de acompanhamento disponíveis no portal</p></div>
                <div><h4 className="font-bold text-[#102B4E]">Inteligência artificial</h4>
                  <p className={isProfessional ? "mt-2 text-slate-700" : "mt-2 text-slate-400 line-through"}>{isProfessional ? "✓" : "—"} Busca assistida por IA</p>
                  <p className={isProfessional ? "mt-1 text-slate-700" : "mt-1 text-slate-400 line-through"}>{isProfessional ? "✓" : "—"} Radar de oportunidades por perfil</p>
                  <p className={isProfessional ? "mt-1 text-slate-700" : "mt-1 text-slate-400 line-through"}>{isProfessional ? "✓" : "—"} Chat Orbe IA {isProfessional ? "(até 60 mensagens por usuário/dia)" : ""}</p>
                  <p className="mt-1 text-slate-700">✓ Análise de edital com IA, sujeita às regras de acesso da plataforma</p>
                </div>
                <div><h4 className="font-bold text-[#102B4E]">Suporte</h4><p className="mt-2 text-slate-700">✓ Atendimento pelo portal {isProfessional ? "com prioridade alta" : "com prioridade padrão"}</p></div>
                <div><h4 className="font-bold text-[#102B4E]">Limites de uso</h4>
                  {[
                    { label: "Pesquisas por mês", value: planLimits.maxSearchesPerMonth === undefined ? undefined : Number(planLimits.maxSearchesPerMonth) },
                    { label: "Favoritos", value: planLimits.maxFavorites === undefined ? undefined : Number(planLimits.maxFavorites) },
                    { label: "Pesquisas salvas", value: planLimits.maxSavedSearches === undefined ? undefined : Number(planLimits.maxSavedSearches) },
                  ].map(item => <p key={item.label} className="mt-2 flex justify-between gap-3 text-slate-700"><span>{item.label}</span><strong className="tabular-nums">{quotaText(item.value)}</strong></p>)}
                  <p className="mt-2 text-xs text-slate-500">Pesquisas, favoritos e pesquisas salvas: cotas compartilhadas pela empresa. Chat: limite diário individual por usuário.</p>

                </div>
              </div>
              <div className="mt-6 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-700">Forma de pagamento</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentMethod("card")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "card" ? "border-cyan-700 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-600"}`}>Cartão de crédito</button>
                  <button type="button" onClick={() => setPaymentMethod("pix")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "pix" ? "border-cyan-700 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-600"}`}>Pix</button>
                </div>
                <p className="mt-2 text-xs text-slate-500">{paymentMethod === "pix" ? "Pagamento manual. A renovação deverá ser paga novamente a cada período." : "Cobrança recorrente mensal no cartão."}</p>
              </div>
              <button type="button" disabled={checkout.isPending || changePlan.isPending || pixCheckout.isPending || profile.isLoading || (Boolean(current) && isCurrent)} onClick={() => {
                let document: string | undefined;
                if (paymentMethod === "pix" && !profile.data?.cnpj) {
                  const entered = window.prompt("Informe o CPF ou CNPJ do pagador:");
                  if (entered === null) return;
                  document = entered.trim();
                }
                if (current) {
                  const description = paymentMethod === "pix" ? "Será gerado um novo Pix. O plano atual continuará ativo até a confirmação do novo pagamento." : "Será iniciada uma nova cobrança recorrente. O plano atual continuará ativo até a confirmação.";
                  if (!window.confirm(`Confirma a alteração para o plano ${plan.name} por ${money(plan.monthlyPriceCents / 100)}/mês? ${description}`)) return;
                  changePlan.mutate({ planId: plan.id, method: paymentMethod, document });
                } else if (paymentMethod === "pix") {
                  pixCheckout.mutate({ planId: plan.id, interval: "monthly", document });
                } else {
                  checkout.mutate({ planId: plan.id, interval: "monthly" });
                }
              }} className="mt-3 w-full rounded-lg bg-[#087eaa] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b92] disabled:cursor-not-allowed disabled:opacity-50">
                {isCurrent ? "Plano atual" : checkout.isPending || changePlan.isPending || pixCheckout.isPending ? "Preparando pagamento…" : current ? "Alterar plano e continuar" : "Continuar para pagamento"}
              </button>
            </article>
          );
        })}
      </section>
      {!plans.data?.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Os planos ainda não estão disponíveis. Entre em contato com o suporte.</div>
      )}
    </div>
  );
}
