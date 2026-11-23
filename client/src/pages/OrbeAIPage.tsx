import { AdminPagination } from "./portal/common";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, Target, MapPin, CalendarClock, Building2, RefreshCw, Gauge, ShieldCheck,
  Send, Plus, Bot, UserRound, Search, FileSearch, ClipboardCheck, ArrowRight, MessageCircle, Trash2,
} from "lucide-react";

function extractOpportunityQuery(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleaned = normalized
    .replace(/^(?:por favor[, ]*)?(?:(?:encontre|encontrar|busque|buscar|pesquis\w*|ache|achar|procure|procurar|localize|localizar|mostre|mostrar|liste|listar|quero|preciso|necessito)\s+(?:me\s+|por\s+)?)*/i, "")
    .replace(/^(?:licitac\w*|oportunidad\w*|preg\w*|edit\w*)\s+(?:de|para|sobre|com|do|da|dos|das)\s+/i, "")
    .replace(/^(?:de|para|sobre|por|com)\s+/, "")
    .replace(/\b(?:em|no|na|nos|nas)\s+[a-z]{2}\b/g, "")
    .replace(/\b(?:abertas?|vigentes?|atuais?|abertos?)\b/g, "")
    .replace(/[.,;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 160);
}

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
  const [conversationId, setConversationId] = useState("");
  const conversations = trpc.orbeAi.chatConversations.useQuery();
  const deleteChat = trpc.orbeAi.chatDelete.useMutation();
  useEffect(() => {
    if (conversationId || !conversations.isFetched) return;
    const latest = conversations.data?.[0]?.conversationId;
    setConversationId(latest || crypto.randomUUID());
  }, [conversationId, conversations.data, conversations.isFetched]);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const history = trpc.orbeAi.chatHistory.useQuery({ conversationId }, { enabled: Boolean(conversationId) });
  const profile = trpc.account.profile.useQuery();
  const send = trpc.orbeAi.chatSend.useMutation({
    onSuccess: async () => { setLocalMessages([]); await Promise.all([history.refetch(), conversations.refetch()]); },
    onError: error => toast.error(error.message),
  });
  const analyzeEdital = trpc.opportunities.analyzeEdital.useMutation();
  const searchBase = trpc.orbeAi.searchBase.useMutation();
  const persistToolResult = async (content: string, userPrompt: string) => {
    await send.mutateAsync({
      conversationId,
      message: "O usuário pediu: " + userPrompt.slice(0, 350) + "\nResultado confirmado de uma ferramenta da plataforma. Use somente estes dados para responder ao usuário, sem inventar informações:\n" + content.slice(0, 2250),
    });
    await Promise.all([history.refetch(), conversations.refetch()]);
  };
  const radar = trpc.orbeAi.radar.useMutation({
    onSuccess: result => {
      const summary = result.items.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} — ${item.score}% de aderência\nAbrir no OrbeEdital: ${window.location.origin}/app/opportunities/${item.id}${item.sourceUrl ? `\nFonte oficial: ${item.sourceUrl}` : ""}`).join("\n");
      const response = result.matchedCount
        ? `Concluí o Radar. Verifiquei ${result.candidateCount.toLocaleString("pt-BR")} oportunidades e encontrei ${result.matchedCount.toLocaleString("pt-BR")} compatibilidades. Estas são as primeiras recomendações:\n\n${summary}\n\nA pontuação indica aderência ao perfil, não garante habilitação ou vitória. Abra cada oportunidade para conferir o edital.`
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

  const removeConversation = async (id: string) => {
    if (!window.confirm("Excluir esta conversa da Orbe IA? As mensagens serão apagadas permanentemente.")) return;
    try {
      await deleteChat.mutateAsync({ conversationId: id });
      if (conversationId === id) {
        setConversationId(crypto.randomUUID());
        setLocalMessages([]);
      }
      await conversations.refetch();
      toast.success("Conversa excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a conversa.");
    }
  };
  const startNewConversation = () => {
    setConversationId(crypto.randomUUID());
    setLocalMessages([]);
    setDraft("");
  };
  const submitMessage = async (value = draft) => {
    const message = value.trim();
    if (!message || send.isPending || radar.isPending || searchBase.isPending || analyzeEdital.isPending) return;
    setLocalMessages(current => [...current, { role: "user", content: message }]);
    setDraft("");

    const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const asksRadar = /\b(radar|compatibilidades|compatíveis|compativeis)\b/.test(normalized) || /\bpara minha empresa\b/.test(normalized)
      && /\b(licitac|oportunidad|pregao|edital)\w*/.test(normalized);
    const opportunityId = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]
      ?? message.match(/\/app\/opportunities\/([0-9a-f-]{36})/i)?.[1];
    const asksSearch = /\b(busque|buscar|encontre|encontrar|ache|achar|pesquis\w*|liste|listar|procure|procurar|localize|localizar|mostre|mostrar)\b/.test(normalized)
      && !/\b(como|porque|por que|explicar|funciona|aprender)\b/.test(normalized);
    const asksAnalysis = /\b(analis(e|ar)|leia|ler|examinar|verificar)\b/.test(normalized)
      && /\b(edital|documento|anexo|retificacao)\w*/.test(normalized);

    try {
      if (asksSearch && !asksRadar) {
        const query = extractOpportunityQuery(message);
        if (query.length < 2) {
          setLocalMessages(current => [...current, { role: "assistant", content: "Diga o produto, serviço ou assunto que deseja localizar. Exemplo: encontre licitações de material hospitalar em PE." }]);
          return;
        }
        const result = await searchBase.mutateAsync({ query, page: 1 });
        const summary = result.items.map((item, index) =>
          `${index + 1}. ${item.title} — ${item.municipality ?? "Município não informado"}/${item.state ?? "UF não informada"}; valor: ${currency(item.estimatedValue)}; prazo: ${dateLabel(item.proposalDeadline)}; fonte: ${item.sourceName}; modalidade: ${item.modality ?? "não informada"}; órgão: ${item.agencyName ?? "não informado"}; link OrbeEdital: ${window.location.origin}/app/opportunities/${item.id}; fonte oficial: ${item.sourceUrl ?? "não informada"}`
        ).join("\n");
        const toolResult = result.total
          ? `Busca realizada na base sincronizada do OrbeEdital para "${query}". Foram encontrados ${result.total} registros abertos; exibindo ${result.items.length}.\n${summary}\nA base reflete as últimas sincronizações concluídas; não representa consulta em tempo real a todos os portais.`
          : `Busca realizada na base sincronizada do OrbeEdital para "${query}". Nenhuma oportunidade aberta correspondente foi encontrada. Tente outros termos ou ajuste os filtros em Oportunidades.`;
        await persistToolResult(toolResult, message);
        setLocalMessages(current => [...current, { role: "assistant", content: result.total
          ? `Consultei a base de oportunidades do OrbeEdital e encontrei ${result.total} registros compatíveis. Mostrei até ${result.items.length} resultados iniciais, com fonte, prazo e link para conferência. A consulta usa os dados da última sincronização concluída, não uma busca ao vivo em todos os portais.`
          : "Consultei a base sincronizada e não encontrei oportunidades abertas com esses termos. Tente uma expressão mais curta ou amplie a busca." }]);
      } else if (asksRadar) {
        const result = await radar.mutateAsync();
        const summary = result.items.slice(0, 12).map((item, index) =>
          `${index + 1}. ${item.title} — ${item.score}% de aderência; ${item.municipality ?? "local não informado"}/${item.state ?? "UF não informada"}; prazo: ${dateLabel(item.proposalDeadline)}; valor: ${currency(item.estimatedValue)}. Motivos: ${item.reasons.join("; ")}. Link OrbeEdital: ${window.location.origin}/app/opportunities/${item.id}${item.sourceUrl ? `; fonte oficial: ${item.sourceUrl}` : ""}`
        ).join("\n");
        const toolResult = result.matchedCount
          ? `Radar executado agora. ${result.candidateCount} oportunidades verificadas; ${result.matchedCount} compatibilidades; ${result.displayedCount} exibidas.\n${summary}\nAderência não representa chance de vitória nem habilitação.`
          : `Radar executado agora. ${result.candidateCount} oportunidades verificadas e nenhuma atingiu o critério mínimo de aderência.`;
        await persistToolResult(toolResult, message);
        setLocalMessages(current => [...current, { role: "assistant", content: "Consultei o Radar diretamente na base do OrbeEdital. " + (result.matchedCount ? `Encontrei ${result.matchedCount} compatibilidades entre ${result.candidateCount} oportunidades verificadas. Registrei os resultados na conversa; veja abaixo minha síntese.` : "Não encontrei oportunidades que atingissem o critério mínimo. Podemos revisar o perfil da empresa.") }]);
      } else if (asksAnalysis && opportunityId) {
        const result = await analyzeEdital.mutateAsync({ id: opportunityId });
        const a = result.analysis;
        const evidence = a.evidence.slice(0, 8).map(item => `- ${item.topic}: “${item.excerpt}” (${item.document ?? "documento não identificado"}${item.page ? ", página " + item.page : ""})`).join("\n");
        const toolResult = `Análise oficial concluída para a oportunidade ${opportunityId}.\nResumo: ${a.executiveSummary}\nDocumentos efetivamente analisados: ${a.documentsAnalyzed.join("; ") || "nenhum PDF processado"}.\nDocumentos localizados e não processados: ${a.documentsNotProcessed.join("; ") || "nenhum informado"}.\nExigências: ${a.qualificationRequirements.join("; ") || "não identificadas"}.\nChecklist: ${a.documentChecklist.join("; ") || "não identificado"}.\nRiscos: ${a.risks.join("; ") || "não identificados"}.\nPontos de atenção: ${a.attentionPoints.join("; ") || "nenhum"}.\nEvidências:\n${evidence}\nInformações ausentes: ${a.missingInformation.join("; ") || "nenhuma informada"}.\nLeitura de documento PDF: ${a.documentAnalyzed ? "sim" : "não; análise limitada aos metadados"}.`;
        await persistToolResult(toolResult);
        setLocalMessages(current => [...current, { role: "assistant", content: `Analisei a oportunidade. ${a.documentAnalyzed ? "Os PDFs listados foram efetivamente enviados para leitura." : "A análise ficou limitada aos metadados, pois nenhum PDF foi processado."} Consulte o resumo, as exigências e as evidências registradas nesta conversa.` }]);
      } else if (asksAnalysis && !opportunityId) {
        setLocalMessages(current => [...current, { role: "assistant", content: "Consigo analisar o edital diretamente. Envie o link da oportunidade no OrbeEdital ou o identificador da oportunidade (UUID), que aparece no endereço da página de detalhes." }]);
      } else {
        await send.mutateAsync({ conversationId, message });
        await Promise.all([history.refetch(), conversations.refetch()]);
      }
    } catch (error) {
      setLocalMessages(current => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Não foi possível concluir essa ação. Tente novamente." }]);
    }
  };

  return <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-5xl flex-col gap-4">
    <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-[#102B4E] via-[#17496b] to-[#087eaa] p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/20 bg-white/10 p-3"><Sparkles size={25}/></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Orbe IA · Plano Profissional</p><h2 className="mt-1 text-2xl font-bold !text-white" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>Seu assistente de licitações</h2></div>
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

      {conversations.data && conversations.data.length > 0 && <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
        {conversations.data.map(item => <div key={item.conversationId} className={`flex max-w-[230px] shrink-0 items-center rounded-lg border transition ${conversationId === item.conversationId ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
          <button type="button" onClick={() => { setConversationId(item.conversationId); setLocalMessages([]); }} className="min-w-0 flex-1 px-3 py-2 text-left text-[11px]"><span className="block truncate font-semibold">{item.preview || "Conversa anterior"}</span><span className="mt-0.5 block">{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</span></button>
          <button type="button" aria-label="Excluir conversa" title="Excluir conversa" disabled={deleteChat.isPending} onClick={() => void removeConversation(item.conversationId)} className="mr-1 rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={15}/></button>
        </div>)}
      </div>}
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
        {(send.isPending || radar.isPending || searchBase.isPending || analyzeEdital.isPending) && <div className="flex items-center gap-3"><div className="rounded-full bg-cyan-100 p-2 text-cyan-900"><Bot size={16}/></div><div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><RefreshCw size={14} className="animate-spin"/> {radar.isPending || searchBase.isPending ? "Consultando oportunidades na base sincronizada…" : analyzeEdital.isPending ? "Lendo edital e documentos oficiais…" : "Analisando sua pergunta…"}</span></div></div>}
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
          <button type="submit" disabled={!draft.trim() || send.isPending || radar.isPending || searchBase.isPending || analyzeEdital.isPending || !conversationId} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#087eaa] text-white transition hover:bg-[#066b91] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem"><Send size={17}/></button>
        </form>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">A Orbe IA pode cometer erros. Confirme exigências, prazos e decisões no edital e nas fontes oficiais. Não substitui análise jurídica ou a conferência do órgão.</p>
      </div>
    </section>
  </div>;
}

export function AdminOrbeAIPage() {
  const [pageSize, setPageSize] = useState(5);
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState("all");
  const [result, setResult] = useState("all");
  const [page, setPage] = useState(1);
  const query = trpc.orbeAi.adminUsage.useQuery(undefined, { refetchInterval: 30000 });
  const items = query.data ?? [];
  const filteredItems = items.filter(item => {
    const searchable = [item.userName, item.userEmail, item.companyName, item.action].join(" ").toLowerCase();
    const action = item.action ?? "";
    const category = action.includes("radar") ? "radar" : action.includes("search") ? "search" : action.includes("chat") ? "chat" : "edital";
    const failed = action.includes("failed");
    return searchable.includes(search.toLowerCase()) && (resource === "all" || category === resource) && (result === "all" || (result === "failed" ? failed : !failed));
  });
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  return <section className="space-y-4">
    <div className="rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#102B4E]">Uso do Orbe IA</h2><p className="mt-1 text-sm text-slate-500">Histórico de execuções do Radar, clientes e volume processado.</p></div><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="rounded-lg border p-2 text-slate-600 disabled:opacity-50" aria-label="Atualizar uso do Orbe IA"><RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""}/></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Execuções registradas</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{items.length}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Clientes distintos</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{new Set(items.map(item => item.userEmail).filter(Boolean)).size}</p></div></div>
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
      <input aria-label="Buscar uso da IA" placeholder="Buscar cliente, empresa ou recurso" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
      <select aria-label="Filtrar recurso da IA" value={resource} onChange={e => { setResource(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm"><option value="all">Todos os recursos</option><option value="radar">Radar</option><option value="search">Busca</option><option value="chat">Chat</option><option value="edital">Leitura de edital</option></select>
      <select aria-label="Filtrar resultado da IA" value={result} onChange={e => { setResult(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm"><option value="all">Todos os resultados</option><option value="completed">Sem falha registrada</option><option value="failed">Falhas</option></select>
    </div>
    <p className="text-xs text-slate-500">Histórico limitado aos 100 eventos mais recentes recebidos do servidor. Busca e filtros atuam sobre esse recorte.</p>
    {query.isLoading ? <p className="p-6 text-center text-sm text-slate-500">Carregando histórico…</p> : query.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{query.error.message}<button type="button" onClick={() => query.refetch()} className="ml-3 rounded-lg border border-rose-300 px-3 py-2 font-semibold">Tentar novamente</button></div> : filteredItems.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Oportunidades verificadas</th><th className="px-4 py-3">Compatíveis</th><th className="px-4 py-3">Interesses aprendidos</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">PDFs lidos</th><th className="px-4 py-3">PDFs pendentes</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Modo / modelo</th></tr></thead><tbody>{visibleItems.map(item => { const details = item.details as Record<string, unknown> | null; const isRadar = item.action === "orbe_ai.radar.executed"; const isSearch = item.action === "orbe_ai.search.executed"; const isChat = item.action === "orbe_ai.chat.message"; const isFailed = item.action === "orbe_ai.edital_analysis.failed"; return <tr key={item.id} className="border-t"><td className="px-4 py-3 text-xs text-slate-500">{dateLabel(item.createdAt)}</td><td className="px-4 py-3 text-xs font-semibold">{isRadar ? "Radar" : isSearch ? "Busca assistida" : isChat ? "Chat Orbe IA" : "Leitura de edital"}</td><td className="px-4 py-3"><p className="font-semibold">{item.userName ?? "Usuário removido"}</p><p className="text-xs text-slate-500">{item.userEmail ?? "—"}</p></td><td className="px-4 py-3">{item.companyName ?? "—"}</td><td className="px-4 py-3 tabular-nums">{isRadar ? String(details?.candidateCount ?? "—") : isSearch ? String(details?.returned ?? "—") : "—"}</td><td className="px-4 py-3 tabular-nums font-semibold">{isRadar ? String(details?.matchedCount ?? "—") : isSearch ? String(details?.total ?? "—") : "—"}</td><td className="px-4 py-3 tabular-nums">{isRadar ? String(details?.learnedInterestTerms ?? 0) : "—"}</td><td className="px-4 py-3 tabular-nums">{String(details?.totalTokenCount ?? "—")}</td><td className="px-4 py-3 tabular-nums">{Array.isArray(details?.documentsAnalyzed) ? details.documentsAnalyzed.length : "—"}</td><td className="px-4 py-3 tabular-nums">{Array.isArray(details?.documentsNotProcessed) ? details.documentsNotProcessed.length : "—"}</td><td className="px-4 py-3 text-xs">{isRadar ? (details?.coverageLimited || details?.itemRowsLimited ? <span className="font-semibold text-amber-700">Cobertura parcial</span> : <span className="text-emerald-700">Concluído</span>) : isSearch ? <span className="text-emerald-700">Concluído</span> : isFailed ? <span className="font-semibold text-rose-700">Falhou</span> : <span className="text-emerald-700">Concluído</span>}</td><td className="px-4 py-3 text-xs text-slate-500">{String(details?.matchingMode ?? details?.model ?? (isSearch ? "base sincronizada" : "—"))}</td></tr>; })}</tbody></table><AdminPagination total={filteredItems.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></div> : <div className="rounded-xl border border-dashed bg-white p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-2 font-semibold text-[#102B4E]">Nenhuma execução registrada</p><p className="mt-1 text-sm text-slate-500">As execuções dos clientes Profissional aparecerão aqui.</p></div>}
    <p className="text-xs text-slate-500">O Radar é processado internamente e não consome tokens de modelo. Leituras de edital registram os tokens informados pelo Gemini; o custo financeiro ainda depende do preço vigente do modelo configurado.</p>
  </section>;
}
