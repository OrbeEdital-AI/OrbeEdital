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
          {used.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")} utilizados
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${nearLimit ? "bg-amber-500" : "bg-cyan-700"}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="text-xs text-slate-500">Restam {Math.max(0, limit - used).toLocaleString("pt-BR")}</p>
    </div>
  );
}

export function BillingPage() {
  const plans = trpc.billing.plans.useQuery();
  const usage = trpc.billing.usage.useQuery();
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.assign(checkoutUrl); },
    onError: error => toast.error(error.message),
  });

  if (plans.isLoading || usage.isLoading) return <Loading label="Carregando planos e consumo…" />;
  if (plans.error) return <ErrorState message={plans.error.message} onRetry={() => plans.refetch()} />;
  if (usage.error) return <ErrorState message={usage.error.message} onRetry={() => usage.refetch()} />;

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
          <p className="text-xs text-slate-500">Ao atingir o limite, a ação correspondente será bloqueada até a renovação mensal ou a mudança de plano.</p>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nenhuma assinatura ativa.</strong> Escolha um dos planos abaixo para liberar as pesquisas e os recursos do OrbeEdital.
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {(plans.data ?? []).map(plan => {
          const isCurrent = current?.code === plan.code;
          const planLimits = plan.limits ?? {};
          return (
            <article key={plan.id} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${plan.code === "profissional" ? "border-cyan-300 ring-1 ring-cyan-100" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[#102B4E]">{plan.name}</h3>
                {plan.code === "profissional" && <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-900">Mais completo</span>}
              </div>
              {plan.description && <p className="mt-2 text-sm text-slate-500">{plan.description}</p>}
              <p className="mt-5 text-3xl font-bold text-[#102B4E]">{money(plan.monthlyPriceCents / 100)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                <li>• Até {Number(planLimits.maxSearchesPerMonth ?? 0).toLocaleString("pt-BR")} pesquisas por mês</li>
                <li>• Até {Number(planLimits.maxFavorites ?? 0).toLocaleString("pt-BR")} oportunidades favoritas</li>
                <li>• Até {Number(planLimits.maxSavedSearches ?? 0).toLocaleString("pt-BR")} pesquisas salvas</li>
                {(plan.features ?? []).map(feature => <li key={feature}>• {feature}</li>)}
              </ul>
              <button
                type="button"
                disabled={Boolean(current) || checkout.isPending}
                onClick={() => checkout.mutate({ planId: plan.id, interval: "monthly" })}
                className="mt-6 w-full rounded-lg bg-[#087eaa] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b92] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent ? "Plano atual" : current ? "Alteração de plano via suporte" : checkout.isPending ? "Preparando checkout…" : "Assinar pelo Mercado Pago"}
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
