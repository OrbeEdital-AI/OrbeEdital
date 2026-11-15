import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { MessageCircle, Send, Plus, RefreshCw, Headphones, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const statusLabel: Record<string, string> = {
  open: "Aberto", in_progress: "Em atendimento", waiting_customer: "Aguardando cliente",
  resolved: "Resolvido", closed: "Encerrado",
};
const priorityLabel: Record<string, string> = { normal: "Padrão", high: "Prioritário" };
const dateLabel = (value: string | Date) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SupportPage() {
  const auth = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"general" | "billing" | "technical" | "opportunity" | "account">("general");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  const tickets = trpc.support.myTickets.useQuery();
  const messages = trpc.support.messages.useQuery({ ticketId: selected ?? "" }, { enabled: !!selected, refetchInterval: 15000 });
  const create = trpc.support.create.useMutation({
    onSuccess: async ticket => { toast.success("Atendimento aberto."); setSubject(""); setMessage(""); setCreating(false); setSelected(ticket.id); await utils.support.myTickets.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const send = trpc.support.reply.useMutation({
    onSuccess: async () => { setReply(""); await Promise.all([utils.support.messages.invalidate(), utils.support.myTickets.invalidate()]); },
    onError: error => toast.error(error.message),
  });
  const active = tickets.data?.find(ticket => ticket.id === selected);
  return <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#102B4E]">Meus atendimentos</h2><p className="mt-1 text-sm text-slate-500">Acompanhe suas solicitações e respostas.</p></div><button onClick={() => tickets.refetch()} className="rounded-lg border p-2 text-slate-600" aria-label="Atualizar"><RefreshCw size={16}/></button></div>
        <button onClick={() => setCreating(value => !value)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/> Novo atendimento</button>
        {creating && <form className="mt-4 space-y-3 border-t pt-4" onSubmit={event => { event.preventDefault(); create.mutate({ subject, category, message }); }}>
          <label className="block text-sm font-medium">Assunto<input required minLength={4} maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <label className="block text-sm font-medium">Categoria<select value={category} onChange={event => setCategory(event.target.value as typeof category)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="general">Dúvida geral</option><option value="billing">Pagamento e assinatura</option><option value="technical">Problema técnico</option><option value="opportunity">Oportunidades</option><option value="account">Minha conta</option></select></label>
          <label className="block text-sm font-medium">Como podemos ajudar?<textarea required minLength={1} maxLength={8000} value={message} onChange={event => setMessage(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <button disabled={create.isPending} className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{create.isPending ? "Enviando…" : "Enviar solicitação"}</button>
        </form>}
      </div>
      <div className="space-y-2">
        {tickets.isLoading && <p className="p-5 text-sm text-slate-500">Carregando atendimentos…</p>}
        {tickets.data?.map(ticket => <button key={ticket.id} onClick={() => setSelected(ticket.id)} className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition ${selected === ticket.id ? "border-cyan-600 ring-2 ring-cyan-100" : "border-slate-200 hover:border-cyan-300"}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-800">{statusLabel[ticket.status] ?? ticket.status}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ticket.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{priorityLabel[ticket.priority] ?? ticket.priority}</span></div>
          <p className="mt-2 font-semibold text-[#102B4E]">{ticket.subject}</p><p className="mt-1 text-xs text-slate-500">Atualizado {dateLabel(ticket.lastMessageAt)}</p>
        </button>)}
        {!tickets.isLoading && !tickets.data?.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Você ainda não abriu um atendimento.</p>}
      </div>
    </section>
    <section className="flex min-h-[440px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {active ? <>
        <div className="border-b p-5"><div className="flex items-center gap-2 text-cyan-800"><Headphones size={18}/><span className="text-xs font-bold uppercase tracking-wide">Atendimento OrbeEdital</span></div><h2 className="mt-2 text-lg font-bold text-[#102B4E]">{active.subject}</h2><p className="mt-1 text-xs text-slate-500">Criado em {dateLabel(active.createdAt)} · {statusLabel[active.status] ?? active.status}</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.isLoading && <p className="text-sm text-slate-500">Carregando conversa…</p>}
          {messages.data?.map(item => <div key={item.id} className={`max-w-[88%] rounded-xl p-3 text-sm ${item.senderUserId === auth.user?.id ? "ml-auto bg-cyan-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}><p className="whitespace-pre-wrap">{item.body}</p><p className="mt-2 text-[10px] text-slate-500">{dateLabel(item.createdAt)}</p></div>)}
        </div>
        {["resolved", "closed"].includes(active.status) ? <p className="border-t p-4 text-sm text-slate-500">Este atendimento foi encerrado. Para uma nova solicitação, abra outro atendimento.</p> :
          <form className="flex gap-2 border-t p-4" onSubmit={event => { event.preventDefault(); if (reply.trim()) send.mutate({ ticketId: active.id, message: reply }); }}><textarea aria-label="Sua resposta" value={reply} onChange={event => setReply(event.target.value)} rows={2} maxLength={8000} placeholder="Escreva sua mensagem…" className="min-w-0 flex-1 resize-y rounded-lg border px-3 py-2 text-sm"/><button disabled={!reply.trim() || send.isPending} aria-label="Enviar mensagem" className="self-end rounded-lg bg-[#102B4E] p-3 text-white disabled:opacity-50"><Send size={17}/></button></form>}
      </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><MessageCircle className="mx-auto h-10 w-10 text-cyan-700"/><h2 className="mt-3 font-semibold text-[#102B4E]">Converse com o suporte</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Selecione um atendimento ou abra uma nova solicitação. Nossa equipe responderá por aqui.</p></div></div>}
    </section>
  </div>;
}

export function AdminSupportPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "open" | "in_progress" | "waiting_customer" | "resolved" | "closed">("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const utils = trpc.useUtils();
  const queue = trpc.support.adminQueue.useQuery({ status: statusFilter || undefined, query: search || undefined }, { refetchInterval: 20000 });
  const messages = trpc.support.adminMessages.useQuery({ ticketId: selected ?? "" }, { enabled: !!selected, refetchInterval: 12000 });
  const staff = trpc.adminUsers.list.useQuery({ page: 1, pageSize: 50 });
  const update = trpc.support.adminUpdate.useMutation({ onSuccess: async () => { await queue.refetch(); await utils.support.adminMessages.invalidate(); }, onError: error => toast.error(error.message) });
  const send = trpc.support.adminReply.useMutation({ onSuccess: async () => { setReply(""); await Promise.all([utils.support.adminMessages.invalidate(), queue.refetch()]); toast.success(internal ? "Nota interna registrada." : "Resposta enviada ao cliente."); }, onError: error => toast.error(error.message) });
  const refreshQueue = async () => {
    try {
      await queue.refetch({ cancelRefetch: false, throwOnError: true });
      toast.success("Fila de atendimento atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a fila.");
    }
  };
  const ticket = queue.data?.find(item => item.id === selected);
  const team = staff.data?.items.filter(user => ["superadmin", "admin", "support"].includes(user.role)) ?? [];
  return <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
    <section className="space-y-3">
      <div className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold text-[#102B4E]">Fila de atendimento</h2><button type="button" onClick={refreshQueue} disabled={queue.isFetching} aria-label="Atualizar fila" title="Atualizar fila" className="rounded-lg border p-2 disabled:cursor-wait disabled:opacity-50"><RefreshCw size={15} className={queue.isFetching ? "animate-spin" : ""}/></button></div><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente ou assunto" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"><option value="">Todos os status</option><option value="open">Abertos</option><option value="in_progress">Em atendimento</option><option value="waiting_customer">Aguardando cliente</option><option value="resolved">Resolvidos</option><option value="closed">Encerrados</option></select></div>
      {queue.data?.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm ${selected === item.id ? "border-cyan-600 ring-2 ring-cyan-100" : "border-slate-200"}`}><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-cyan-800">{statusLabel[item.status] ?? item.status}</span><span className="text-[10px] font-bold text-amber-700">{priorityLabel[item.priority] ?? item.priority}</span></div><p className="mt-2 font-semibold text-[#102B4E]">{item.subject}</p><p className="mt-1 text-xs text-slate-500">{item.customerName} · {item.customerEmail}</p><p className="mt-1 text-[11px] text-slate-400">{dateLabel(item.lastMessageAt)}</p></button>)}
      {!queue.isLoading && !queue.data?.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhum atendimento nesta fila.</p>}
    </section>
    <section className="flex min-h-[500px] flex-col rounded-xl border bg-white shadow-sm">
      {ticket ? <>
        <div className="space-y-3 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">#{ticket.id.slice(0,8)} · {ticket.customerName}</p><h2 className="mt-1 text-lg font-bold text-[#102B4E]">{ticket.subject}</h2><p className="text-xs text-slate-500">{ticket.customerEmail}</p></div>
          <div className="grid gap-2 sm:grid-cols-3"><label className="text-xs font-medium">Status<select value={ticket.status} onChange={event => update.mutate({ ticketId: ticket.id, status: event.target.value as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed" })} className="mt-1 w-full rounded border px-2 py-2"><option value="open">Aberto</option><option value="in_progress">Em atendimento</option><option value="waiting_customer">Aguardando cliente</option><option value="resolved">Resolvido</option><option value="closed">Encerrado</option></select></label><label className="text-xs font-medium">Prioridade<select value={ticket.priority} onChange={event => update.mutate({ ticketId: ticket.id, priority: event.target.value as "normal" | "high" })} className="mt-1 w-full rounded border px-2 py-2"><option value="normal">Padrão</option><option value="high">Prioritário</option></select></label><label className="text-xs font-medium">Responsável<select value={ticket.assignedToUserId ?? ""} onChange={event => update.mutate({ ticketId: ticket.id, assignedToUserId: event.target.value || null })} className="mt-1 w-full rounded border px-2 py-2"><option value="">Sem responsável</option>{team.map(user => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></label></div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">{messages.data?.map(item => <div key={item.id} className={`max-w-[90%] rounded-xl p-3 text-sm ${item.isInternal ? "border border-amber-200 bg-amber-50" : item.senderUserId === null ? "bg-slate-100" : "bg-cyan-50"}`}><p className="mb-1 text-[10px] font-bold text-slate-500">{item.isInternal ? "NOTA INTERNA" : item.senderName ?? "Equipe OrbeEdital"}</p><p className="whitespace-pre-wrap">{item.body}</p><p className="mt-2 text-[10px] text-slate-500">{dateLabel(item.createdAt)}</p></div>)}</div>
        <form className="space-y-2 border-t p-4" onSubmit={event => { event.preventDefault(); if (reply.trim()) send.mutate({ ticketId: ticket.id, message: reply, internal }); }}><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={internal} onChange={event => setInternal(event.target.checked)}/> Registrar como nota interna (não visível ao cliente)</label><div className="flex gap-2"><textarea value={reply} onChange={event => setReply(event.target.value)} rows={2} maxLength={8000} placeholder={internal ? "Nota interna…" : "Responder ao cliente…"} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/><button disabled={!reply.trim() || send.isPending} className="self-end rounded-lg bg-[#102B4E] p-3 text-white disabled:opacity-50"><Send size={17}/></button></div></form>
      </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><CheckCircle2 className="mx-auto h-10 w-10 text-cyan-700"/><h2 className="mt-3 font-semibold text-[#102B4E]">Gestão de suporte</h2><p className="mt-1 text-sm text-slate-500">Selecione um chamado para consultar o histórico, atribuir responsável e responder.</p></div></div>}
    </section>
  </div>;
}
