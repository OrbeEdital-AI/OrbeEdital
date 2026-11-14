import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import BrandMark from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function PricingPage() {
  const [, navigate] = useLocation();
  const plans = trpc.billing.plans.useQuery();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: error => toast.error(error.message),
  });
  const resumeCode = new URLSearchParams(window.location.search).get("resume");
  const selectedCode = new URLSearchParams(window.location.search).get("plan");

  return (
    <main className="min-h-screen bg-[#f4f8fb] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <BrandMark />
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#153454]"><ArrowLeft size={16}/> Voltar</button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Planos OrbeEdital</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#102B4E] sm:text-5xl">Escolha o plano da sua empresa</h1>
          <p className="mt-5 text-base leading-7 text-slate-600">Compare os recursos, os limites mensais e escolha a opção mais adequada. O acesso ao portal é liberado após a confirmação do pagamento.</p>
        </div>
        {resumeCode && <p className="mt-8 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-center text-sm text-cyan-950">Sua conta já está criada. Escolha o plano novamente para retomar o pagamento e liberar o portal.</p>}
        {plans.isLoading ? <p className="mt-12 text-center text-slate-500">Carregando planos…</p> : plans.error ? <p className="mt-12 text-center text-rose-700">{plans.error.message}</p> : (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {(plans.data ?? []).map(plan => {
              const limits = plan.limits ?? {};
              const isSelected = selectedCode === plan.code || resumeCode === plan.code;
              return <article key={plan.id} className={`flex flex-col rounded-2xl border bg-white p-7 shadow-sm ${plan.code === "profissional" ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-[#102B4E]">{plan.name}</h2>
                  {plan.code === "profissional" && <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-900">Mais completo</span>}
                </div>
                {plan.description && <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">{plan.description}</p>}
                <p className="mt-6 text-4xl font-bold tracking-tight text-[#102B4E]">{money(plan.monthlyPriceCents)}<span className="text-sm font-medium text-slate-500">/mês</span></p>
                <p className="mt-1 text-xs text-slate-500">Cobrança recorrente mensal pelo Mercado Pago</p>
                <div className="my-6 border-t border-slate-100"/>
                <h3 className="text-sm font-bold text-[#153454]">Limites incluídos</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-600">
                  <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxSearchesPerMonth ?? 0).toLocaleString("pt-BR")} pesquisas por mês</li>
                  <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxFavorites ?? 0).toLocaleString("pt-BR")} oportunidades favoritas</li>
                  <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxSavedSearches ?? 0).toLocaleString("pt-BR")} pesquisas salvas</li>
                  {(plan.features ?? []).map(feature => <li className="flex gap-2" key={feature}><Check className="shrink-0 text-emerald-600" size={17}/>{feature}</li>)}
                </ul>
                <button disabled={checkout.isPending} onClick={() => {
                  if (auth.data) checkout.mutate({ planId: plan.id, interval: "monthly" });
                  else navigate(`/register?plan=${encodeURIComponent(plan.code)}`);
                }} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c3153] px-5 py-3.5 font-bold text-white transition hover:bg-[#16466f] disabled:opacity-60">
                  {auth.data ? (checkout.isPending ? "Preparando pagamento…" : "Assinar este plano") : "Escolher este plano"} <ArrowRight size={17}/>
                </button>
                {isSelected && resumeCode && <p className="mt-3 text-center text-xs text-cyan-800">Retome sua contratação com este plano.</p>}
              </article>;
            })}
          </div>
        )}
        {!plans.isLoading && !plans.error && !plans.data?.length && <p className="mt-12 text-center text-amber-800">Os planos estão temporariamente indisponíveis. Tente novamente mais tarde.</p>}
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15}/> Pagamento processado com segurança pelo Mercado Pago</span>
          <span>Os limites são compartilhados pelos usuários da mesma empresa e renovados mensalmente.</span>
          <span>O portal só é liberado após a confirmação do pagamento.</span>
        </div>
      </section>
    </main>
  );
}
