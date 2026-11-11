import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import BrandMark from "./BrandMark";

export type AuthMode = "login" | "register";

export type LoginFormData = {
  mode: "login";
  email: string;
  password: string;
};

export type RegisterFormData = {
  mode: "register";
  name: string;
  email: string;
  phone: string;
  password: string;
  company: string;
  cnpj: string;
  state: string;
  municipality: string;
  segment: string;
};

export type AuthFormData = LoginFormData | RegisterFormData;

export type AuthPageProps = {
  /** Modo inicial exibido. */
  initialMode?: AuthMode;
  /** Recebe os dados validados; pode lançar erro ou retornar Promise. */
  onSubmit: (data: AuthFormData) => void | Promise<void>;
  /** Chamado ao alternar entre login e cadastro, permitindo sincronizar o estado externo. */
  onModeChange?: (mode: AuthMode) => void;
  /** Callback opcional para voltar à página anterior. */
  onBack?: () => void;
  /** Mensagem externa de erro, por exemplo, uma falha de autenticação. */
  error?: string;
  /** Navega para o fluxo de recuperação de senha. */
  onForgotPassword?: () => void;
};

type Values = Omit<RegisterFormData, "mode">;

const initialValues: Values = {
  name: "", email: "", phone: "", password: "", company: "", cnpj: "", state: "", municipality: "", segment: "",
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function AuthPage({ initialMode = "login", onSubmit, onModeChange, onBack, error, onForgotPassword }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [values, setValues] = useState<Values>(initialValues);
  const [localError, setLocalError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError("");
    setFieldErrors({});
    onModeChange?.(nextMode);
  };

  const setField = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setLocalError("");
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const email = values.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Informe um e-mail válido.";
    if (values.password.length < 10) errors.password = "A senha deve ter pelo menos 10 caracteres.";
    if (values.password.length > 128) errors.password = "A senha deve ter no máximo 128 caracteres.";
    if (mode === "register") {
      if (!values.name.trim()) errors.name = "Informe seu nome.";
      if (!/^\+?[\d\s().-]{10,}$/.test(values.phone.trim())) errors.phone = "Informe um telefone válido com DDD.";
      if (!values.company.trim()) errors.company = "Informe o nome da empresa.";
      if (values.cnpj.trim() && !/^\d{14}$/.test(values.cnpj.replace(/\D/g, ""))) errors.cnpj = "Informe um CNPJ com 14 dígitos.";
      if (!values.state) errors.state = "Selecione o estado.";
      if (!values.municipality.trim()) errors.municipality = "Informe o município.";
      if (!values.segment.trim()) errors.segment = "Informe o segmento de atuação.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    if (!validate()) return;
    setPending(true);
    try {
      if (mode === "login") {
        await onSubmit({ mode: "login", email: values.email.trim(), password: values.password });
      } else {
        await onSubmit({
          mode: "register", name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(),
          password: values.password, company: values.company.trim(), cnpj: values.cnpj.trim(), state: values.state,
          municipality: values.municipality.trim(), segment: values.segment.trim(),
        });
      }
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const inputClass = "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50";

  const field = (id: keyof Values, label: string, options: { type?: string; placeholder?: string; autoComplete?: string; required?: boolean; inputMode?: "text" | "tel" | "email" | "numeric" } = {}) => (
    <div key={id}>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>{label}{options.required !== false && <span aria-hidden="true" className="ml-1 text-rose-600">*</span>}</label>
      <input aria-describedby={fieldErrors[id] ? `${id}-error` : undefined} aria-invalid={Boolean(fieldErrors[id])} autoComplete={options.autoComplete} className={inputClass} disabled={pending} id={id} inputMode={options.inputMode} onChange={(event) => setField(id, event.target.value)} placeholder={options.placeholder} required={options.required !== false} type={options.type ?? "text"} value={values[id]} />
      {fieldErrors[id] && <p className="mt-1 text-xs text-rose-700" id={`${id}-error`}>{fieldErrors[id]}</p>}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f4f8fb] px-4 py-8 sm:grid sm:place-items-center sm:py-12">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-[#102B4E]/10 sm:grid sm:grid-cols-[.82fr_1.18fr]">
        <aside className="relative hidden overflow-hidden bg-[#102B4E] p-9 text-white sm:flex sm:flex-col sm:justify-between lg:p-12">
          <div aria-hidden="true" className="absolute -bottom-20 -left-24 h-72 w-72 rounded-full border-[35px] border-cyan-300/10" />
          <BrandMark className="relative [&_span]:text-white [&_span_span]:text-[#42D5E8]" />
          <div className="relative py-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#42D5E8]">Compras públicas, com clareza</p><h1 className="mt-4 text-3xl font-bold leading-tight">Sua próxima oportunidade começa com uma boa pesquisa.</h1><p className="mt-4 text-sm leading-6 text-slate-300">Acesse ou crie sua conta para conhecer o LicitaHub.</p></div>
          <p className="relative text-xs text-slate-400">Plataforma em desenvolvimento.</p>
        </aside>
        <section className="px-5 py-8 sm:px-9 sm:py-10 lg:px-14 lg:py-12">
          <div className="mb-8 flex items-center justify-between">
            {onBack ? <button className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#102B4E]" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={16} /> Voltar</button> : <BrandMark className="sm:hidden" />}
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><LockKeyhole aria-hidden="true" size={14} /> Acesso seguro</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#102B4E]">{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2>
          <p className="mt-2 text-sm text-slate-600">{mode === "login" ? "Entre para continuar no LicitaHub." : "Conte um pouco sobre você e sua empresa."}</p>
          <div aria-label="Escolha entre entrar e criar conta" className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="group">
            {(["login", "register"] as const).map((tab) => <button aria-pressed={mode === tab} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === tab ? "bg-white text-[#102B4E] shadow-sm" : "text-slate-500 hover:text-slate-800"}`} key={tab} onClick={() => changeMode(tab)} type="button">{tab === "login" ? "Entrar" : "Criar conta"}</button>)}
          </div>

          <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
            {mode === "register" && <>
              {field("name", "Nome completo", { autoComplete: "name", placeholder: "Seu nome" })}
              {field("phone", "Telefone com DDD", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "(00) 00000-0000" })}
            </>}
            {field("email", "E-mail", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "voce@empresa.com" })}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">Senha<span aria-hidden="true" className="ml-1 text-rose-600">*</span></label>
              <div className="relative mt-1.5"><input aria-describedby={fieldErrors.password ? "password-error" : undefined} aria-invalid={Boolean(fieldErrors.password)} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputClass} pr-11`} disabled={pending} id="password" minLength={10} onChange={(event) => setField("password", event.target.value)} placeholder="Mínimo de 10 caracteres" required type={showPassword ? "text" : "password"} value={values.password} /><button aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-800" onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button></div>
              {fieldErrors.password && <p className="mt-1 text-xs text-rose-700" id="password-error">{fieldErrors.password}</p>}
              {mode === "login" && onForgotPassword && <div className="mt-2 text-right"><button className="text-sm font-semibold text-[#087eaa] hover:underline" onClick={onForgotPassword} type="button">Esqueceu sua senha?</button></div>}
            </div>
            {mode === "register" && <>
              {field("company", "Empresa", { autoComplete: "organization", placeholder: "Razão social ou nome da empresa" })}
              {field("cnpj", "CNPJ (opcional)", { required: false, inputMode: "numeric", placeholder: "00.000.000/0000-00" })}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-sm font-medium text-slate-700" htmlFor="state">Estado<span aria-hidden="true" className="ml-1 text-rose-600">*</span></label><select aria-describedby={fieldErrors.state ? "state-error" : undefined} aria-invalid={Boolean(fieldErrors.state)} className={inputClass} disabled={pending} id="state" onChange={(event) => setField("state", event.target.value)} required value={values.state}><option value="">Selecione</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select>{fieldErrors.state && <p className="mt-1 text-xs text-rose-700" id="state-error">{fieldErrors.state}</p>}</div>
                {field("municipality", "Município", { autoComplete: "address-level2", placeholder: "Sua cidade" })}
              </div>
              {field("segment", "Segmento de atuação", { placeholder: "Ex.: tecnologia, construção, saúde" })}
            </>}
            {(localError || error) && <p aria-live="assertive" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800" role="alert">{localError || error}</p>}
            <button className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#087eaa] px-4 py-3 font-semibold text-white transition hover:bg-[#066b92] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">{pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">{mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"} <button className="font-semibold text-[#087eaa] hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" onClick={() => changeMode(mode === "login" ? "register" : "login")} type="button">{mode === "login" ? "Cadastre-se" : "Faça login"}</button></p>
        </section>
      </div>
    </main>
  );
}

export default AuthPage;
