import {
  ArrowRight,
  Bookmark,
  Check,
  FileSearch,
  Filter,
  Landmark,
  ListFilter,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import BrandMark from "./BrandMark";

export type LandingPageProps = {
  onGetStarted: () => void;
  onLogin?: () => void;
};

const features = [
  {
    icon: Search,
    number: "01",
    title: "Encontre oportunidades",
    text: "Pesquise editais reunidos de fontes oficiais e encontre oportunidades alinhadas ao que sua empresa fornece.",
  },
  {
    icon: Filter,
    number: "02",
    title: "Refine sua busca",
    text: "Organize a pesquisa por palavras-chave, estado e fonte para chegar mais rápido ao que importa.",
  },
  {
    icon: Bookmark,
    number: "03",
    title: "Acompanhe o que importa",
    text: "Salve oportunidades e mantenha suas pesquisas organizadas em um só lugar.",
  },
];

const highlights = [
  "Pesquisa centralizada de oportunidades públicas",
  "Informações com indicação da fonte de origem",
  "Acesso aos detalhes para conferência no portal oficial",
];

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/" aria-label="OrbeEdital - início" className="shrink-0">
            <BrandMark />
          </a>
          <nav aria-label="Navegação principal" className="flex items-center gap-3 sm:gap-7">
            {onLogin && (
              <button className="rounded-full px-3 py-2 text-sm font-semibold text-[#153454] transition hover:bg-slate-100" onClick={onLogin} type="button">
                Entrar
              </button>
            )}
            <button className="inline-flex items-center gap-2 rounded-full bg-[#0c3153] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#16466f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 sm:px-5" onClick={onGetStarted} type="button">
              Criar conta <ArrowRight aria-hidden="true" size={16} />
            </button>
          </nav>
        </div>
      </header>

      <section className="relative isolate bg-[#071d33] text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 78% 18%, rgba(34,211,238,.35), transparent 28%), radial-gradient(circle at 10% 90%, rgba(14,116,144,.32), transparent 32%), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "auto, auto, 48px 48px, 48px 48px" }} />
        <div aria-hidden="true" className="absolute -right-40 top-12 -z-10 h-[32rem] w-[32rem] rounded-full border border-cyan-300/10" />
        <div aria-hidden="true" className="absolute -right-20 top-32 -z-10 h-[22rem] w-[22rem] rounded-full border border-cyan-300/10" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.02fr_.98fr] lg:gap-10 lg:py-28">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/[0.08] px-4 py-2 text-xs font-semibold tracking-wide text-cyan-100">
              <Sparkles aria-hidden="true" size={14} className="text-cyan-300" />
              INTELIGÊNCIA EM COMPRAS PÚBLICAS
            </div>
            <h1 className="text-[2.65rem] font-bold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.8rem]">
              O próximo edital da sua empresa pode estar <span className="bg-gradient-to-r from-cyan-300 to-teal-200 bg-clip-text text-transparent">mais perto.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              Descubra oportunidades de compras públicas em uma experiência mais simples. Pesquise, filtre e organize editais com informações de fontes oficiais.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 px-7 py-4 font-bold text-[#08253d] shadow-xl shadow-cyan-950/30 transition hover:-translate-y-1 hover:shadow-cyan-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={onGetStarted} type="button">
                Começar agora <ArrowRight aria-hidden="true" size={18} className="transition group-hover:translate-x-1" />
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-teal-300" /> Fontes oficiais identificadas</span>
              <span className="inline-flex items-center gap-2"><Target size={15} className="text-teal-300" /> Busca mais organizada</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto">
            <div aria-hidden="true" className="absolute -inset-8 rounded-[2.5rem] bg-cyan-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-[#f8fbfd] p-3 shadow-2xl shadow-black/40 sm:p-4">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e2f7fa] text-[#087eaa]"><Landmark size={18} /></span>
                  <div><p className="text-xs font-bold text-[#123452]">Painel de oportunidades</p><p className="text-[10px] text-slate-400">Visão de pesquisa</p></div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Área de trabalho</span>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-cyan-700">Sua pesquisa</p><h2 className="mt-1 text-lg font-bold tracking-tight text-[#123452]">Oportunidades para sua empresa</h2></div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf8fb] text-[#087eaa]"><FileSearch size={20} /></span>
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <Search size={16} className="text-slate-400" />
                  <span className="text-xs text-slate-400">O que sua empresa fornece?</span>
                  <span className="ml-auto rounded-md bg-[#0c3153] px-3 py-1.5 text-[10px] font-semibold text-white">Buscar</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-[10px] text-slate-400">Localização</p><p className="mt-1 text-xs font-semibold text-slate-700">Todos os estados</p></div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-[10px] text-slate-400">Origem</p><p className="mt-1 text-xs font-semibold text-slate-700">Fontes oficiais</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-3">
                  <p className="text-xs font-bold text-[#123452]">Organize seus resultados</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-700"><ListFilter size={12} /> Filtros</span>
                </div>
                <div className="space-y-2.5 pt-3">
                  {[
                    { tag: "OPORTUNIDADE", title: "Encontre editais por palavras-chave", desc: "Pesquise pelo que sua empresa fornece." },
                    { tag: "FONTE IDENTIFICADA", title: "Confira a origem das informações", desc: "Acesse os detalhes no portal responsável." },
                  ].map((item) => (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3" key={item.tag}>
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><Check size={16} /></span>
                      <div className="min-w-0"><p className="text-[9px] font-bold tracking-[.12em] text-cyan-700">{item.tag}</p><p className="mt-1 text-xs font-bold text-[#123452]">{item.title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#eaf7f9] px-4 py-3 text-[10px] leading-4 text-slate-600">
                <ShieldCheck size={16} className="shrink-0 text-cyan-700" />
                A disponibilidade depende dos dados efetivamente sincronizados. Sempre confira o edital na fonte oficial.
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-white/60 bg-white px-4 py-3 shadow-xl sm:flex">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><TrendingUp size={19} /></span>
              <div><p className="text-xs font-bold text-[#123452]">Mais clareza na busca</p><p className="text-[10px] text-slate-500">Menos dispersão de informações</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="relative bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Por que OrbeEdital?</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#102f4d] sm:text-4xl">Mais foco nas oportunidades. Menos tempo procurando em vários lugares.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Uma experiência pensada para ajudar sua empresa a descobrir e acompanhar oportunidades de compras públicas com mais organização.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, number, title, text }) => (
              <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_8px_30px_rgba(15,40,65,.04)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_18px_45px_rgba(15,40,65,.10)]" key={title}>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f8fa] text-[#087eaa] transition group-hover:bg-[#0c3153] group-hover:text-white"><Icon size={22} /></span>
                  <span className="text-xs font-bold tracking-[.16em] text-slate-300">{number}</span>
                </div>
                <h3 className="mt-7 text-lg font-bold text-[#123452]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-[#f3f8fb] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Simples para começar</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#102f4d] sm:text-4xl">Sua busca por oportunidades começa aqui.</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">Crie sua conta e conheça um ambiente pensado para centralizar a pesquisa e facilitar o acompanhamento das oportunidades.</p>
            <button className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0c3153] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#16466f]" onClick={onGetStarted} type="button">Criar minha conta <ArrowRight size={17} /></button>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            <div className="space-y-6">
              {[
                { n: "1", title: "Crie seu acesso", text: "Cadastre sua conta para entrar no ambiente OrbeEdital." },
                { n: "2", title: "Pesquise oportunidades", text: "Use palavras-chave e filtros para encontrar editais relevantes." },
                { n: "3", title: "Confira e acompanhe", text: "Consulte os detalhes na fonte oficial e organize o que interessa." },
              ].map((step, index) => (
                <div className="relative flex gap-4" key={step.n}>
                  {index < 2 && <span aria-hidden="true" className="absolute left-5 top-11 h-[calc(100%+1.5rem)] w-px bg-slate-200" />}
                  <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e5f7fa] text-sm font-bold text-[#087eaa]">{step.n}</span>
                  <div className="pt-0.5"><h3 className="text-sm font-bold text-[#123452]">{step.title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-500">{step.text}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">PNCP</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">Compras.gov.br</span>
              <span className="text-[10px] leading-6 text-slate-400">Conforme disponibilidade e sincronização das fontes.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#08233c] py-16 text-white sm:py-20">
        <div aria-hidden="true" className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Dê o próximo passo</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Encontre novas possibilidades para sua empresa.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">Conheça o OrbeEdital e organize sua jornada de busca por oportunidades públicas.</p>
          </div>
          <button className="inline-flex shrink-0 items-center gap-3 rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 px-7 py-4 font-bold text-[#08253d] shadow-xl shadow-black/20 transition hover:-translate-y-1" onClick={onGetStarted} type="button">Começar agora <ArrowRight size={18} /></button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <BrandMark className="scale-90 origin-left" />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <a href="/terms" className="transition hover:text-cyan-700">Termos e Condições de Uso</a>
            <a href="/privacy" className="transition hover:text-cyan-700">Política de Privacidade</a>
          </div>
          <div className="max-w-md text-xs leading-5 text-slate-500 md:text-right">
            <p className="font-semibold text-slate-600">Pesquisa e organização de oportunidades em compras públicas.</p>
            <p className="mt-1">© {new Date().getFullYear()} OrbeEdital. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
