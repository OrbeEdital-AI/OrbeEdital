import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Copy, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type PixPayment = {
  paymentId: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  pixTicketUrl: string | null;
  expiresAt: string;
  amountCents: number;
  planName: string;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function PixPaymentPage() {
  const [, navigate] = useLocation();
  const [pix, setPix] = useState<PixPayment | null>(null);
  const auth = useAuth();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("orbeedital_pix_payment");
      if (saved) setPix(JSON.parse(saved) as PixPayment);
    } catch {
      sessionStorage.removeItem("orbeedital_pix_payment");
    }
  }, []);
  const status = trpc.billing.pixStatus.useQuery(
    { paymentId: pix?.paymentId ?? "" },
    { enabled: Boolean(pix?.paymentId), refetchOnWindowFocus: true, refetchInterval: 5000 },
  );

  const approved = status.data?.status === "approved";

  useEffect(() => {
    if (!approved || auth.loading) return;
    navigate(auth.user ? "/app" : "/login");
  }, [approved, auth.loading, auth.user, navigate]);

  if (!pix) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f8fb] px-5 text-center text-slate-700">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-[#102B4E]">Nenhum Pix em aberto nesta sessão</h1>
        <p className="mt-2 text-sm text-slate-600">Volte à página de planos e gere uma cobrança Pix para continuar.</p>
        <button onClick={() => navigate("/plans?resume=teste-gratis")} className="mt-5 rounded-lg bg-[#087eaa] px-5 py-3 text-sm font-semibold text-white">Voltar aos planos</button>
      </div>
    </main>;
  }

  const expired = new Date(pix.expiresAt).getTime() < Date.now() && !approved;

  return <main className="min-h-screen bg-[#f4f8fb] px-4 py-8 text-slate-800 sm:py-12">
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate("/app/billing")} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#153454]"><ArrowLeft size={16}/> Voltar</button>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-800"><ShieldCheck size={25}/></div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-cyan-700">OrbeEdital · Pagamento</p>
          <h1 className="mt-2 text-2xl font-bold text-[#102B4E]">Pague com Pix</h1>
          <p className="mt-2 text-sm text-slate-600">Plano {pix.planName}</p>
          <p className="mt-3 text-4xl font-bold text-[#102B4E]">{money(pix.amountCents)}</p>
          <p className="mt-1 text-xs text-slate-500">Válido até {new Date(pix.expiresAt).toLocaleString("pt-BR")}</p>
        </div>
        <div className="mt-7 flex flex-col items-center gap-4">
          {approved ? <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-800">
            <CheckCircle2 className="mx-auto mb-2" size={28}/>
            <p className="font-bold">Pagamento confirmado!</p>
            <p className="mt-1 text-sm">Seu acesso ao OrbeEdital foi liberado.</p>
            <p className="mt-2 text-xs">Redirecionando para {auth.user ? "o painel do cliente" : "a tela de login"}…</p>
            <button type="button" onClick={() => navigate(auth.user ? "/app" : "/login")} className="mt-4 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">{auth.user ? "Ir para o painel" : "Fazer login"}</button>
          </div> : <>
            <img alt="QR Code Pix" className="h-60 w-60 rounded-lg border border-slate-200 p-2" src={`data:image/png;base64,${pix.pixQrCodeBase64}`}/>
            <p className="text-center text-sm font-semibold text-slate-700">Escaneie o QR Code com o aplicativo do seu banco</p>
            <label htmlFor="pix-copy-paste" className="w-full text-sm font-semibold text-slate-700">Pix Copia e Cola</label>
            <textarea id="pix-copy-paste" readOnly value={pix.pixQrCode} className="min-h-28 w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-700"/>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(pix.pixQrCode).then(() => toast.success("Código Pix copiado."), () => toast.error("Não foi possível copiar o código.")); }} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#087eaa] px-4 py-3 text-sm font-semibold text-white"><Copy size={16}/> Copiar código Pix</button>
            {pix.pixTicketUrl && <a href={pix.pixTicketUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cyan-800 underline">Abrir no Mercado Pago</a>}
            <div className={expired ? "w-full rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-700" : "w-full rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800"}>
              <Clock3 className="mr-1 inline" size={15}/>{expired ? "Este código Pix expirou." : `Status: ${status.data?.status ?? "Aguardando pagamento"} · verificando automaticamente`}
            </div>
            <button type="button" onClick={() => { void status.refetch().then(result => { if (result.data?.status === "approved") toast.success("Pagamento confirmado! Seu acesso foi liberado."); else toast.info("O pagamento ainda não foi confirmado."); }); }} className="w-full rounded-lg border border-cyan-700 px-4 py-3 text-sm font-semibold text-cyan-800">Já paguei — verificar pagamento</button>
          </>}
        </div>
      </section>
      <p className="mt-4 text-center text-xs text-slate-500">O acesso é liberado automaticamente após a confirmação do pagamento pelo Mercado Pago.</p>
    </div>
  </main>;
}
