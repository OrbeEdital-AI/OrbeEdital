import { ArrowRight, BellRing, FileSearch, ListFilter, ShieldCheck, Sparkles } from "lucide-react";
import BrandMark from "./BrandMark";

export type LandingPageProps = {
  /** Acionado pelos CTAs principais para iniciar cadastro ou demonstração. */
  onGetStarted: () => void;
  /** Opcional: acesso ao fluxo de login. */
  onLogin?: () => void;
};

const plannedFeatures = [
  {
    icon: FileSearch,
    title: "Busca de oportunidades",
    text: "Consulte registros coletados das APIs oficiais PNCP e Compras.gov.br, com link para conferir cada oportunidade na fonte.",
  },
  {
    icon: ListFilter,
    title: "Filtros para o seu negócio",
    text: "Pesquise por palavra-chave, estado e fonte, com resultados limitados ao que foi efetivamente sincronizado.",
  },
  {
    icon: BellRing,
    title: "Acompanhamento e alertas",
    text: "Salve oportunidades e pesquisas no seu espaço. Alertas externos e sincronização automática ainda dependem de configuração.",
  },
];

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandMark />
        <nav aria-label="Navegação principal" className="flex items-center gap-5">
          <a className="hidden text-sm font-medium text-slate-600 hover:text-[#102B4E] sm:inline" href="#como-funciona">Como funciona</a>
          {onLogin && <button className="text-sm font-semibold text-[#102B4E] hover:text-[#1388B8]" onClick={onLogin} type="button">Entrar</button>}
          <button className="rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#173b65] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" onClick={onGetStarted} type="button">Criar conta</button>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-y border-slate-100 bg-[#f5f9fc]">
        <div aria-hidden="true" className="absolute -right-24 -top-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.1fr_.9fr]">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#146b8d]"><Sparkles aria-hidden="true" size={14} /> Inteligência em compras públicas</p>
            <h1 className="text-4xl font-bold leading-[1.12] tracking-tight text-[#102B4E] sm:text-5xl lg:text-[3.6rem]">Encontre oportunidades que combinam com o que sua empresa fornece.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Pesquise oportunidades públicas reunidas de fontes oficiais, salve as que importam e confirme cada detalhe diretamente no portal de origem.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#087eaa] px-6 py-3.5 font-semibold text-white shadow-md shadow-cyan-900/10 transition hover:bg-[#066b92] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" onClick={onGetStarted} type="button">Começar agora <ArrowRight aria-hidden="true" size={18} /></button>
              <a className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3.5 font-semibold text-[#102B4E] transition hover:border-slate-400" href="#como-funciona">Conheça a proposta</a>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">A cobertura depende dos registros sincronizados. Não representa consulta integral ou atualização em tempo real de todos os portais.</p>
          </div>
          <div aria-label="Ilustração conceitual de pesquisa e análise de editais" className="relative mx-auto w-full max-w-md" role="img">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-[#102B4E]/10 sm:p-8">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e7f7fb] text-[#087eaa]"><FileSearch aria-hidden="true" size={22} /></span>
                <div><div className="text-sm font-semibold text-[#102B4E]">Pesquisa de oportunidades</div><div className="mt-1 text-xs text-slate-500">Uma visão organizada para sua equipe</div></div>
              </div>
              <div className="space-y-3 py-5">
                {["Critérios alinhados ao seu negócio", "Informações com contexto de fonte", "Acompanhamento em um só fluxo"].map((item) => <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600" key={item}><ShieldCheck aria-hidden="true" className="shrink-0 text-[#1388B8]" size={17} />{item}</div>)}
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-xs leading-5 text-slate-600">Oportunidades reais só aparecem após sincronização. Consulte o edital e os prazos na fonte oficial.</div>
            </div>
            <div aria-hidden="true" className="absolute -bottom-5 -left-5 -z-10 h-28 w-28 rounded-full border-[18px] border-cyan-100" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8" id="como-funciona">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1388B8]">A proposta</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#102B4E] sm:text-4xl">Menos pesquisa dispersa. Mais clareza para decidir.</h2>
          <p className="mt-4 leading-7 text-slate-600">Uma plataforma para apoiar empresas na descoberta e organização de oportunidades de compras públicas — sem substituir a leitura dos documentos oficiais.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plannedFeatures.map(({ icon: Icon, title, text }) => <article className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-cyan-200 hover:shadow-md" key={title}><div className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7f7fb] text-[#087eaa]"><Icon aria-hidden="true" size={21} /></div><h3 className="mt-5 text-lg font-semibold text-[#102B4E]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
        </div>
      </section>

      <section className="bg-[#102B4E]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-5 py-14 sm:px-8 md:flex-row md:items-center">
          <div><h2 className="text-2xl font-bold text-white">Prepare sua empresa para encontrar novas oportunidades.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Conheça o OrbeEdital e acompanhe a evolução da plataforma.</p></div>
          <button className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#42D5E8] px-5 py-3 font-semibold text-[#102B4E] transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={onGetStarted} type="button">Quero conhecer <ArrowRight aria-hidden="true" size={17} /></button>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><BrandMark className="scale-90 origin-left" /><div className="flex gap-4"><a href="/terms" className="hover:text-slate-800">Termos</a><a href="/privacy" className="hover:text-slate-800">Privacidade</a></div><p>Informações oficiais devem sempre ser confirmadas na fonte responsável.</p></footer>
    </main>
  );
}

export default LandingPage;
