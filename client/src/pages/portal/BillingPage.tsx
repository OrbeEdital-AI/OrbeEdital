import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { money, Loading, ErrorState } from "./common";

export function BillingPage() {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const plans = trpc.billing.plans.useQuery();
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.assign(checkoutUrl); },
    onError: error => toast.error(error.message),
  });

  if (plans.isLoading) return <Loading label="Carregando planos…" />;
  if (plans.error) return <ErrorState message={plans.error.message} onRetry={() => plans.refetch()} />;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-5">
        <h2 className="font-semibold text-[#102B4E]">Planos e assinatura</h2>
        <p className="mt-1 text-sm leading-6 text-cyan-950">Escolha um plano e conclua a autorização de cobrança recorrente no ambiente seguro do Mercado Pago. Seu acesso será atualizado após a confirmação enviada pelo gateway.</p>
        <div className="mt-4 inline-flex rounded-lg border border-cyan-200 bg-white p-1">
          <button type="button" onClick={() => setInterval("monthly")} className={`rounded-md px-3 py-2 text-sm font-semibold ${interval === "monthly" ? "bg-[#102B4E] text-white" : "text-slate-600"}`}>Mensal</button>
          <button type="button" onClick={() => setInterval("annual")} className={`rounded-md px-3 py-2 text-sm font-semibold ${interval === "annual" ? "bg-[#102B4E] text-white" : "text-slate-600"}`}>Anual</button>
        </div>
      </section>
      {plans.data?.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map(plan => {
            const price = interval === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
            return (
              <article key={plan.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#102B4E]">{plan.name}</h3>
                {plan.description && <p className="mt-2 text-sm text-slate-500">{plan.description}</p>}
                <p className="mt-5 text-2xl font-bold text-[#102B4E]">{money(price / 100)}<span className="text-sm font-normal text-slate-500">/{interval === "annual" ? "ano" : "mês"}</span></p>
                {plan.features?.length > 0 && <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">{plan.features.map(feature => <li key={feature}>• {feature}</li>)}</ul>}
                <button type="button" disabled={price <= 0 || checkout.isPending} onClick={() => checkout.mutate({ planId: plan.id, interval })} className="mt-6 w-full rounded-lg bg-[#087eaa] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b92] disabled:cursor-not-allowed disabled:opacity-50">
                  {checkout.isPending ? "Preparando checkout…" : price > 0 ? "Assinar pelo Mercado Pago" : "Preço não configurado"}
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Ainda não há planos ativos cadastrados para contratação. Cadastre os planos e seus preços no banco para disponibilizá-los aqui.</div>
      )}
    </div>
  );
}
