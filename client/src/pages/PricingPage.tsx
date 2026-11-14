import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import BrandMark from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const plans = trpc.billing.plans.useQuery();
  const profile = trpc.account.profile.useQuery();
  const pixCheckout = trpc.billing.pixCheckout.useMutation({
    onSuccess: result => { sessionStorage.setItem("orbeedital_pix_payment", JSON.stringify(result)); navigate("/pix-payment"); },
    onError: error => toast.error(error.message),
  });
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: error => toast.error(error.message),
  });
  const resumeCode = new URLSearchParams(window.location.search).get("resume");
  const selectedCode = new URLSearchParams(window.location.search).get("plan");
  const checkoutError = new URLSearchParams(window.location.search).get("checkoutError");

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
          <p className="mt-5 text-base leading-7 text-slate-600">{resumeCode ? "Finalize a contratação do plano selecionado para liberar o acesso à plataforma." : "Escolha o plano ideal para sua empresa. O acesso é liberado após a confirmação do pagamento."}</p>
        </div>
        {resumeCode && <p className="mt-8 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-center text-sm text-cyan-950">Sua conta já está criada. Continue a contratação abaixo; não é necessário refazer o cadastro nem escolher outro plano.</p>}
        {checkoutError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{checkoutError}</p>}
        {plans.isLoading ? <p className="mt-12 text-center text-slate-500">Carregando planos…</p> : plans.error ? <p className="mt-12 text-center text-rose-700">{plans.error.message}</p> : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {(plans.data ?? []).filter(plan => !resumeCode || plan.code === resumeCode).map(plan => {
              const limits = plan.limits ?? {};
              const isSelected = selectedCode === plan.code || resumeCode === plan.code;
              return <article key={plan.id} className={`flex flex-col rounded-2xl border bg-white p-7 shadow-sm ${plan.code === "profissional" ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-[#102B4E]">{plan.name}</h2>
                  {plan.code === "profissional" && <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-900">Mais completo</span>}
                </div>
                {plan.code !== "teste-gratis" && plan.description && <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">{plan.description}</p>}
                <p className="mt-6 text-4xl font-bold tracking-tight text-[#102B4E]">{plan.monthlyPriceCents === 0 ? "Grátis" : money(plan.monthlyPriceCents)}{plan.monthlyPriceCents > 0 && <span className="text-sm font-medium text-slate-500">/mês</span>}</p>
                <p className="mt-1 text-xs text-slate-500">Cobrança recorrente mensal pelo Mercado Pago</p>
                {plan.code !== "teste-gratis" && <>
                  <div className="my-6 border-t border-slate-100"/>
                  <h3 className="text-sm font-bold text-[#153454]">Limites incluídos</h3>
                  <ul className="mt-3 space-y-3 text-sm text-slate-600">
                    <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxSearchesPerMonth ?? 0).toLocaleString("pt-BR")} pesquisas por mês</li>
                    <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxFavorites ?? 0).toLocaleString("pt-BR")} oportunidades favoritas</li>
                    <li className="flex gap-2"><Check className="shrink-0 text-emerald-600" size={17}/> {Number(limits.maxSavedSearches ?? 0).toLocaleString("pt-BR")} pesquisas salvas</li>
                    {(plan.features ?? []).map(feature => <li className="flex gap-2" key={feature}><Check className="shrink-0 text-emerald-600" size={17}/>{feature}</li>)}
                  </ul>
                </>}
                {auth.data && <div className="mt-8 rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-700">Forma de pagamento</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPaymentMethod("card")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "card" ? "border-cyan-700 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-600"}`}>Cartão</button>
                    <button type="button" onClick={() => setPaymentMethod("pix")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "pix" ? "border-cyan-700 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-600"}`}>Pix</button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{paymentMethod === "pix" ? "Pagamento manual, com nova cobrança a cada renovação." : "Cobrança recorrente mensal no cartão."}</p>
                </div>}
                <button disabled={checkout.isPending || pixCheckout.isPending || profile.isLoading} onClick={() => {
                  if (!auth.data) { navigate(`/register?plan=${encodeURIComponent(plan.code)}`); return; }
                  if (paymentMethod === "pix") {
                    const document = profile.data?.cnpj ? undefined : window.prompt("Informe o CPF ou CNPJ do pagador:");
                    if (!profile.data?.cnpj && document === null) return;
                    pixCheckout.mutate({ planId: plan.id, interval: "monthly", document: document?.trim() || undefined });
                  } else {
                    checkout.mutate({ planId: plan.id, interval: "monthly" });
                  }
                }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c3153] px-5 py-3.5 font-bold text-white transition hover:bg-[#16466f] disabled:opacity-60">
                  {auth.data ? (checkout.isPending || pixCheckout.isPending ? "Aguarde…" : "Continuar para pagamento") : "Escolher este plano"} <ArrowRight size={17}/>
                </button>
                {isSelected && resumeCode && <p className="mt-3 text-center text-xs text-cyan-800">Este é o plano selecionado no seu cadastro.</p>}
              </article>;
            })}
          </div>
        )}
        {!plans.isLoading && !plans.error && !plans.data?.length && <p className="mt-12 text-center text-amber-800">Os planos estão temporariamente indisponíveis. Tente novamente mais tarde.</p>}
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15}/> Pagamentos dos planos pagos processados com segurança pelo Mercado Pago</span>
          <span>Os limites são compartilhados pelos usuários da mesma empresa e renovados mensalmente.</span>
          <span>O portal só é liberado após a confirmação do pagamento.</span>
        </div>
      </section>
    </main>
  );
}
