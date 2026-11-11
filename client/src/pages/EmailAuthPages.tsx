import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import BrandMark from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

function EmailAuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8fb] px-4 py-8">
      <section className="w-full max-w-lg border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="inline-block"><BrandMark /></Link>
        <h1 className="mt-8 text-2xl font-bold text-[#102B4E]">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const [email, setEmail] = useState("");
  const deliveryNotice = new URLSearchParams(window.location.search).get("delivery");
  const [feedback, setFeedback] = useState(() => deliveryNotice === "sent"
    ? "Cadastro concluído. O link de confirmação foi enviado; confira também a pasta de spam."
    : deliveryNotice === "unavailable"
      ? "Cadastro concluído, mas o link não pôde ser enviado agora. O serviço de e-mail pode estar sem configuração ou temporariamente indisponível; tente reenviar mais tarde."
      : "");
  const [verified, setVerified] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const started = useRef(false);
  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: async () => {
      setVerified(true);
      setFeedback("E-mail confirmado. Sua conta está pronta para uso.");
      await utils.auth.me.invalidate();
    },
    onError: error => setFeedback(error.message),
  });
  const resend = trpc.auth.requestEmailVerification.useMutation();

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    verify.mutate({ token });
  }, [token, verify]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    try {
      const result = await resend.mutateAsync(auth.data ? {} : { email: email.trim() });
      if ("sent" in result && result.sent) {
        setFeedback("Link enviado. Confira sua caixa de entrada e a pasta de spam.");
      } else if ("sent" in result) {
        setFeedback("Não foi possível enviar agora ou há um envio recente. Aguarde um minuto e tente novamente; se persistir, o serviço de e-mail pode estar indisponível.");
      } else {
        setFeedback("Se houver uma conta pendente para esse endereço, enviaremos um link de confirmação.");
      }
    } catch {
      setFeedback("Não foi possível solicitar o link agora. Tente novamente mais tarde.");
    }
  };

  return (
    <EmailAuthShell title={verified ? "E-mail confirmado" : "Confirme seu e-mail"}>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {auth.data?.email
          ? <>Confirme <strong>{auth.data.email}</strong> para liberar os recursos do portal.</>
          : "Use o link recebido por e-mail. Links de confirmação expiram após 24 horas e só podem ser usados uma vez."}
      </p>
      {feedback && <p aria-live="polite" className="mt-5 border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{feedback}</p>}
      {verified ? (
        <div className="mt-6 flex flex-col gap-3">
          <button className="w-full bg-[#087eaa] px-4 py-3 font-semibold text-white" onClick={() => navigate(auth.data ? "/app" : "/login")} type="button">
            {auth.data ? "Acessar o portal" : "Entrar"}
          </button>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {!auth.data && (
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="verification-email">E-mail da conta</label>
              <input autoComplete="email" className="mt-1 block w-full border border-slate-300 px-3 py-2.5" id="verification-email" onChange={event => setEmail(event.target.value)} required type="email" value={email} />
            </div>
          )}
          <button className="w-full bg-[#087eaa] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={resend.isPending || verify.isPending} type="submit">
            {resend.isPending ? "Enviando…" : "Reenviar link de confirmação"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-slate-600"><Link href="/login" className="font-semibold text-[#087eaa] underline">Voltar para entrar</Link></p>
    </EmailAuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => setFeedback("Não foi possível processar a solicitação agora. Tente novamente mais tarde."),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    request.mutate({ email: email.trim() });
  };
  return (
    <EmailAuthShell title="Recuperar senha">
      <p className="mt-3 text-sm leading-6 text-slate-600">Informe o e-mail da conta. Se ele estiver cadastrado e a entrega estiver disponível, você receberá um link temporário para criar uma nova senha.</p>
      {submitted ? (
        <p aria-live="polite" className="mt-6 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Se houver uma conta associada a esse endereço e a entrega estiver disponível, as instruções serão enviadas. Verifique também a pasta de spam.</p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="reset-email">E-mail</label>
            <input autoComplete="email" className="mt-1 block w-full border border-slate-300 px-3 py-2.5" id="reset-email" onChange={event => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          {feedback && <p aria-live="assertive" className="text-sm text-rose-700" role="alert">{feedback}</p>}
          <button className="w-full bg-[#087eaa] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={request.isPending} type="submit">{request.isPending ? "Enviando…" : "Enviar instruções"}</button>
        </form>
      )}
      <p className="mt-6 text-sm text-slate-600"><Link href="/login" className="font-semibold text-[#087eaa] underline">Voltar para entrar</Link></p>
    </EmailAuthShell>
  );
}

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  useEffect(() => {
    if (token) window.history.replaceState({}, "", window.location.pathname);
  }, [token]);
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setCompleted(true);
      setFeedback("Senha redefinida. Entre com a nova senha.");
    },
    onError: error => setFeedback(error.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    if (!token) {
      setFeedback("O link não contém um token válido. Solicite uma nova redefinição.");
      return;
    }
    if (password !== confirmation) {
      setFeedback("As senhas não coincidem.");
      return;
    }
    reset.mutate({ token, password });
  };
  return (
    <EmailAuthShell title={completed ? "Senha atualizada" : "Crie uma nova senha"}>
      <p className="mt-3 text-sm leading-6 text-slate-600">O link de redefinição expira após 30 minutos e só pode ser usado uma vez. A nova senha deve ter entre 10 e 128 caracteres.</p>
      {feedback && <p aria-live={completed ? "polite" : "assertive"} className={`mt-5 border p-3 text-sm ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`} role={completed ? "status" : "alert"}>{feedback}</p>}
      {completed ? (
        <button className="mt-6 w-full bg-[#087eaa] px-4 py-3 font-semibold text-white" onClick={() => navigate("/login")} type="button">Ir para login</button>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="new-password">Nova senha</label>
            <input autoComplete="new-password" className="mt-1 block w-full border border-slate-300 px-3 py-2.5" id="new-password" maxLength={128} minLength={10} onChange={event => setPassword(event.target.value)} required type="password" value={password} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-password">Confirme a nova senha</label>
            <input autoComplete="new-password" className="mt-1 block w-full border border-slate-300 px-3 py-2.5" id="confirm-password" maxLength={128} minLength={10} onChange={event => setConfirmation(event.target.value)} required type="password" value={confirmation} />
          </div>
          <button className="w-full bg-[#087eaa] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={reset.isPending} type="submit">{reset.isPending ? "Salvando…" : "Redefinir senha"}</button>
        </form>
      )}
      <p className="mt-6 text-sm text-slate-600"><Link href="/login" className="font-semibold text-[#087eaa] underline">Voltar para entrar</Link></p>
    </EmailAuthShell>
  );
}
