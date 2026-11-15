import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Sparkles, Target, MapPin, CalendarClock, Building2, RefreshCw, Gauge, ShieldCheck } from "lucide-react";

function dateLabel(value: string | Date | null) {
  if (!value) return "Prazo não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Prazo não informado" : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}
function currency(value: string | null) {
  if (!value || !Number.isFinite(Number(value))) return "Valor não informado";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrbeAIPage() {
  const profile = trpc.account.profile.useQuery();
  const radar = trpc.orbeAi.radar.useMutation({
    onSuccess: result => toast.success(`Radar concluído: ${result.matchedCount} oportunidade(s) compatível(is).`),
    onError: error => toast.error(error.message),
  });
  const profileTerms = [
    ...(profile.data?.profile?.products ?? []),
    ...(profile.data?.profile?.services ?? []),
    ...(profile.data?.profile?.keywords ?? []),
    ...(profile.data?.profile?.segments ?? []),
    ...(profile.data?.primarySegment ? [profile.data.primarySegment] : []),
  ];
  const hasProfile = profileTerms.length > 0 || Boolean(profile.data?.profile?.catmatCodes?.length || profile.data?.profile?.catserCodes?.length);
  const result = radar.data;

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-[#102B4E] via-[#17496b] to-[#087eaa] p-6 text-white shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/25 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-50"><Sparkles size={14}/> ORBE IA · PLANO PROFISSIONAL</div>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Meu Radar de Licitações</h2>
          <p className="mt-2 text-sm leading-6 text-blue-50/90">Encontre oportunidades abertas que combinam com os produtos, serviços, regiões e códigos informados no perfil da sua empresa.</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><Target size={34}/><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">Compatibilidade</p></div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" disabled={radar.isPending || profile.isLoading || !hasProfile} onClick={() => radar.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#102B4E] shadow-sm transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">
          {radar.isPending ? <RefreshCw size={16} className="animate-spin"/> : <Sparkles size={16}/>}
          {radar.isPending ? "Analisando oportunidades…" : "Executar meu radar"}
        </button>
        <Link href="/app/profile" className="rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Completar perfil da empresa</Link>
      </div>
    </section>

    {!profile.isLoading && !hasProfile && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Seu perfil ainda precisa de informações para gerar recomendações.</p>
      <p className="mt-1">Informe produtos, serviços, segmentos, palavras-chave ou códigos CATMAT/CATSER. O Radar também considera sua região de atendimento e faixa de valores.</p>
      <Link href="/app/profile" className="mt-3 inline-flex font-semibold underline">Atualizar perfil empresarial</Link>
    </section>}

    {result && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oportunidades verificadas</p><p className="mt-2 text-2xl font-bold text-[#102B4E]">{result.candidateCount.toLocaleString("pt-BR")}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compatíveis encontradas</p><p className="mt-2 text-2xl font-bold text-cyan-800">{result.matchedCount.toLocaleString("pt-BR")}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última execução</p><p className="mt-2 text-sm font-semibold text-[#102B4E]">{dateLabel(result.generatedAt)}</p></div>
      </div>
      {(result.coverageLimited || result.itemRowsLimited) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Análise parcial da base</p>
        <p className="mt-1">Há mais registros abertos do que o limite processado nesta execução. Execute novamente mais tarde e confira também a busca geral de oportunidades; esta lista não representa toda a base.</p>
      </div>}
      {result.learnedInterestCount > 0 && <p className="text-xs text-slate-500">O Radar também considerou padrões identificados nos seus favoritos e nas oportunidades que você acompanha.</p>}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-[#102B4E]">Oportunidades compatíveis</h3><p className="text-sm text-slate-500">Ordenadas pela pontuação de aderência ao perfil da empresa.</p></div><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900">Até 40 resultados</span></div>
        {result.items.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">{item.sourceName}</p><h4 className="mt-1 font-bold text-[#102B4E]">{item.title}</h4><p className="mt-1 text-sm text-slate-500">{item.agencyName ?? "Órgão não informado"}</p></div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><Gauge size={17}/><span className="text-lg font-bold">{item.score}%</span><span className="text-[10px] font-semibold uppercase">aderência</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><MapPin size={14}/>{[item.municipality, item.state].filter(Boolean).join(" / ") || "Local não informado"}</span><span className="inline-flex items-center gap-1"><CalendarClock size={14}/>Prazo: {dateLabel(item.proposalDeadline)}{item.needsDeadlineCheck ? " · confirmar no edital" : ""}</span><span className="inline-flex items-center gap-1"><Building2 size={14}/>{currency(item.estimatedValue)}</span></div>
          {item.reasons.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{item.reasons.map(reason => <span key={reason} className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs text-cyan-900">{reason}</span>)}</div>}
          <div className="mt-4 border-t pt-3"><Link href={`/app/opportunities/${item.id}`} className="text-sm font-semibold text-cyan-800 hover:underline">Ver oportunidade e edital →</Link></div>
        </article>)}
        {!result.items.length && <div className="rounded-xl border border-dashed bg-white p-8 text-center"><Target className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-3 font-semibold text-[#102B4E]">Nenhuma compatibilidade encontrada nesta execução</p><p className="mt-1 text-sm text-slate-500">Revise os produtos, serviços, palavras-chave, regiões e códigos do perfil da empresa.</p></div>}
      </section>
      <p className="text-xs leading-5 text-slate-500">O Radar usa correspondência entre o perfil empresarial e os dados disponíveis nas oportunidades. A pontuação é indicativa, não garante habilitação nem substitui a leitura do edital e a conferência dos requisitos.</p>
    </>}
    {!result && !radar.isPending && <section className="rounded-xl border bg-white p-6 text-sm text-slate-600"><p className="font-semibold text-[#102B4E]">Como funciona</p><p className="mt-1">O sistema cruza palavras-chave, itens, códigos de catálogo, localização e faixa de valores. A execução inicial usa processamento interno de baixo custo, sem consumir chamadas do modelo generativo.</p></section>}
  </div>;
}

export function AdminOrbeAIPage() {
  const query = trpc.orbeAi.adminUsage.useQuery(undefined, { refetchInterval: 30000 });
  const items = query.data ?? [];
  return <section className="space-y-4">
    <div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#102B4E]">Uso do Orbe IA</h2><p className="mt-1 text-sm text-slate-500">Histórico de execuções do Radar, clientes e volume processado.</p></div><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="rounded-lg border p-2 text-slate-600 disabled:opacity-50" aria-label="Atualizar uso do Orbe IA"><RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""}/></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Execuções registradas</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{items.length}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Clientes distintos</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{new Set(items.map(item => item.userEmail).filter(Boolean)).size}</p></div></div>
    </div>
    {query.isLoading ? <p className="p-6 text-center text-sm text-slate-500">Carregando histórico…</p> : query.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{query.error.message}</p> : items.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Oportunidades verificadas</th><th className="px-4 py-3">Compatíveis</th><th className="px-4 py-3">Interesses aprendidos</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Modo</th></tr></thead><tbody>{items.map(item => { const details = item.details as Record<string, unknown> | null; return <tr key={item.id} className="border-t"><td className="px-4 py-3 text-xs text-slate-500">{dateLabel(item.createdAt)}</td><td className="px-4 py-3"><p className="font-semibold">{item.userName ?? "Usuário removido"}</p><p className="text-xs text-slate-500">{item.userEmail ?? "—"}</p></td><td className="px-4 py-3">{item.companyName ?? "—"}</td><td className="px-4 py-3 tabular-nums">{String(details?.candidateCount ?? "—")}</td><td className="px-4 py-3 tabular-nums font-semibold">{String(details?.matchedCount ?? "—")}</td><td className="px-4 py-3 tabular-nums">{String(details?.learnedInterestTerms ?? 0)}</td><td className="px-4 py-3 text-xs">{details?.coverageLimited || details?.itemRowsLimited ? <span className="font-semibold text-amber-700">Parcial</span> : <span className="text-emerald-700">Dentro do limite</span>}</td><td className="px-4 py-3 text-xs text-slate-500">{String(details?.matchingMode ?? "—")}</td></tr>; })}</tbody></table></div> : <div className="rounded-xl border border-dashed bg-white p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-2 font-semibold text-[#102B4E]">Nenhuma execução registrada</p><p className="mt-1 text-sm text-slate-500">As execuções dos clientes Profissional aparecerão aqui.</p></div>}
    <p className="text-xs text-slate-500">Esta primeira etapa registra uso e volume do Radar. Consumo de tokens e custos de IA generativa serão exibidos quando as funções com modelo generativo forem habilitadas.</p>
  </section>;
}
