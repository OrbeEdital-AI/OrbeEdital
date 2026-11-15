import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, Target, MapPin, CalendarClock, Building2, RefreshCw, Gauge, ShieldCheck,
  Send, Plus, Bot, UserRound, Search, FileSearch, ClipboardCheck, ArrowRight, MessageCircle,
} from "lucide-react";

function dateLabel(value: string | Date | null) {
  if (!value) return "Prazo não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Prazo não informado" : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}
function currency(value: string | null) {
  if (!value || !Number.isFinite(Number(value))) return "Valor não informado";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const suggestions = [
  { label: "Encontrar licitações para minha empresa", icon: Search },
  { label: "Como saber se minha empresa está apta a participar?", icon: ClipboardCheck },
  { label: "Quais documentos devo preparar para uma licitação?", icon: FileSearch },
  { label: "Como avaliar se uma oportunidade vale a pena?", icon: Target },
];

export function OrbeAIPage() {
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const history = trpc.orbeAi.chatHistory.useQuery({ conversationId });
  const profile = trpc.account.profile.useQuery();
  const send = trpc.orbeAi.chatSend.useMutation({
    onSuccess: async () => { await history.refetch(); },
    onError: error => toast.error(error.message),
  });
  const radar = trpc.orbeAi.radar.useMutation({
    onSuccess: result => {
      const summary = result.items.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} — ${item.score}% de aderência`).join("\\n");
      const response = result.matchedCount
        ? `Concluí o Radar. Verifiquei ${result.candidateCount.toLocaleString("pt-BR")} oportunidades e encontrei ${result.matchedCount.toLocaleString("pt-BR")} compatibilidades. Estas são as primeiras recomendações:\\n\\n${summary}\\n\\nA pontuação indica aderência ao perfil, não garante habilitação ou vitória. Abra cada oportunidade para conferir o edital.`
        : "Concluí o Radar, mas não encontrei oportunidades que atingissem o critério mínimo de aderência. Podemos revisar os produtos, serviços e códigos do perfil da empresa.";
      setLocalMessages(current => [...current, { role: "assistant", content: response }]);
      toast.success("Radar concluído.");
    },
    onError: error => toast.error(error.message),
  });
  const savedMessages = (history.data ?? []).map(message => ({ role: message.role, content: message.content }));
  const messages = [...savedMessages, ...localMessages];
  const hasProfile = Boolean(
    profile.data?.primarySegment ||
    profile.data?.profile?.products?.length ||
    profile.data?.profile?.services?.length ||
    profile.data?.profile?.keywords?.length ||
    profile.data?.profile?.catmatCodes?.length ||
    profile.data?.profile?.catserCodes?.length
  );

  const startNewConversation = () => {
    setConversationId(crypto.randomUUID());
    setLocalMessages([]);
    setDraft("");
  };
  const submitMessage = (value = draft) => {
    const message = value.trim();
    if (!message || send.isPending) return;
    setLocalMessages(current => [...current, { role: "user", content: message }]);
    setDraft("");
    send.mutate({ conversationId, message }, {
      onError: () => setLocalMessages(current => current.slice(0, -1)),
    });
  };

  return <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-5xl flex-col gap-4">
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-[#102B4E] via-[#17496b] to-[#087eaa] p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/20 bg-white/10 p-3"><Sparkles size={25}/></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Orbe IA · Plano Profissional</p><h2 className="mt-1 text-2xl font-bold">Seu assistente de licitações</h2></div>
        </div>
        <button type="button" onClick={startNewConversation} className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"><Plus size={16}/> Nova conversa</button>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-blue-50/90">Converse sobre oportunidades, editais, habilitação e estratégia. A Orbe IA considera as informações cadastradas no perfil da sua empresa e informa quando precisar consultar uma fonte ou documento.</p>
    </section>

    <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2"><div className="rounded-full bg-cyan-100 p-2 text-cyan-800"><Bot size={18}/></div><div><p className="text-sm font-bold text-[#102B4E]">Conversa com a Orbe IA</p><p className="text-[11px] text-slate-500">Histórico salvo nesta conta</p></div></div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Assistente ativo</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {!messages.length && <div className="mx-auto max-w-2xl py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#17496b] to-[#087eaa] text-white"><Sparkles size={28}/></div>
          <h3 className="mt-4 text-xl font-bold text-[#102B4E]">Olá! Vamos trabalhar nas suas licitações?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Posso ajudar a entender editais, preparar sua empresa e avaliar oportunidades. Escolha uma sugestão ou escreva sua pergunta.</p>
          <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
            {suggestions.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => submitMessage(label)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"><Icon size={18} className="shrink-0 text-cyan-800"/><span>{label}</span><ArrowRight size={15} className="ml-auto shrink-0 text-slate-400"/></button>)}
          </div>
        </div>}
        {messages.map((message, index) => <div key={index} className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`mt-0.5 rounded-full p-2 ${message.role === "user" ? "bg-[#173d60] text-white" : "bg-cyan-100 text-cyan-900"}`}>{message.role === "user" ? <UserRound size={16}/> : <Bot size={16}/>}</div>
          <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-tr-sm bg-[#173d60] text-white" : "rounded-tl-sm bg-slate-100 text-slate-800"}`}><p className="whitespace-pre-wrap">{message.content}</p></div>
        </div>)}
        {send.isPending && <div className="flex items-center gap-3"><div className="rounded-full bg-cyan-100 p-2 text-cyan-900"><Bot size={16}/></div><div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><RefreshCw size={14} className="animate-spin"/> Analisando sua pergunta…</span></div></div>}
        {history.isLoading && <p className="text-center text-xs text-slate-400">Carregando conversa…</p>}
      </div>

      <div className="border-t bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" disabled={radar.isPending || !hasProfile} onClick={() => radar.mutate()} className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:opacity-50"><Target size={14}/>{radar.isPending ? "Executando Radar…" : "Executar meu Radar"}</button>
          <Link href="/app/opportunities" className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Search size={14}/> Abrir oportunidades</Link>
          <Link href="/app/profile" className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Building2 size={14}/> Perfil da empresa</Link>
        </div>
        {!hasProfile && <p className="mb-2 text-xs text-amber-700">Complete o perfil da empresa para receber recomendações mais relevantes.</p>}
        <form onSubmit={event => { event.preventDefault(); submitMessage(); }} className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
          <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} rows={2} maxLength={3000} placeholder="Pergunte sobre licitações, editais ou sua empresa…" className="max-h-36 min-h-[48px] flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"/>
          <button type="submit" disabled={!draft.trim() || send.isPending} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#087eaa] text-white transition hover:bg-[#066b91] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem"><Send size={17}/></button>
        </form>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">A Orbe IA pode cometer erros. Confirme exigências, prazos e decisões no edital e nas fontes oficiais. Não substitui análise jurídica ou a conferência do órgão.</p>
      </div>
    </section>
  </div>;
}

export function AdminOrbeAIPage() {
  const query = trpc.orbeAi.adminUsage.useQuery(undefined, { refetchInterval: 30000 });
  const items = query.data ?? [];
  return <section className="space-y-4">
    <div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#102B4E]">Uso do Orbe IA</h2><p className="mt-1 text-sm text-slate-500">Histórico de execuções do Radar, clientes e volume processado.</p></div><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="rounded-lg border p-2 text-slate-600 disabled:opacity-50" aria-label="Atualizar uso do Orbe IA"><RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""}/></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Execuções registradas</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{items.length}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Clientes distintos</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{new Set(items.map(item => item.userEmail).filter(Boolean)).size}</p></div></div>
    </div>
    {query.isLoading ? <p className="p-6 text-center text-sm text-slate-500">Carregando histórico…</p> : query.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{query.error.message}</p> : items.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Oportunidades verificadas</th><th className="px-4 py-3">Compatíveis</th><th className="px-4 py-3">Interesses aprendidos</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">PDFs lidos</th><th className="px-4 py-3">PDFs pendentes</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Modo / modelo</th></tr></thead><tbody>{items.map(item => { const details = item.details as Record<string, unknown> | null; const isRadar = item.action === "orbe_ai.radar.executed"; const isFailed = item.action === "orbe_ai.edital_analysis.failed"; return <tr key={item.id} className="border-t"><td className="px-4 py-3 text-xs text-slate-500">{dateLabel(item.createdAt)}</td><td className="px-4 py-3 text-xs font-semibold">{isRadar ? "Radar" : "Leitura de edital"}</td><td className="px-4 py-3"><p className="font-semibold">{item.userName ?? "Usuário removido"}</p><p className="text-xs text-slate-500">{item.userEmail ?? "—"}</p></td><td className="px-4 py-3">{item.companyName ?? "—"}</td><td className="px-4 py-3 tabular-nums">{isRadar ? String(details?.candidateCount ?? "—") : "—"}</td><td className="px-4 py-3 tabular-nums font-semibold">{isRadar ? String(details?.matchedCount ?? "—") : "—"}</td><td className="px-4 py-3 tabular-nums">{isRadar ? String(details?.learnedInterestTerms ?? 0) : "—"}</td><td className="px-4 py-3 tabular-nums">{String(details?.totalTokenCount ?? "—")}</td><td className="px-4 py-3 tabular-nums">{Array.isArray(details?.documentsAnalyzed) ? details.documentsAnalyzed.length : "—"}</td><td className="px-4 py-3 tabular-nums">{Array.isArray(details?.documentsNotProcessed) ? details.documentsNotProcessed.length : "—"}</td><td className="px-4 py-3 text-xs">{isRadar ? (details?.coverageLimited || details?.itemRowsLimited ? <span className="font-semibold text-amber-700">Cobertura parcial</span> : <span className="text-emerald-700">Concluído</span>) : isFailed ? <span className="font-semibold text-rose-700">Falhou</span> : <span className="text-emerald-700">Concluído</span>}</td><td className="px-4 py-3 text-xs text-slate-500">{String(details?.matchingMode ?? details?.model ?? "—")}</td></tr>; })}</tbody></table></div> : <div className="rounded-xl border border-dashed bg-white p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-2 font-semibold text-[#102B4E]">Nenhuma execução registrada</p><p className="mt-1 text-sm text-slate-500">As execuções dos clientes Profissional aparecerão aqui.</p></div>}
    <p className="text-xs text-slate-500">O Radar é processado internamente e não consome tokens de modelo. Leituras de edital registram os tokens informados pelo Gemini; o custo financeiro ainda depende do preço vigente do modelo configurado.</p>
  </section>;
}
