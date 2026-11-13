import { Bell, CalendarClock, CalendarDays, CheckCheck, Clock3, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function dayLabel(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function AgendaPage() {
  const agenda = trpc.agenda.list.useQuery();
  const items = agenda.data ?? [];
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.proposalDeadline ? new Date(item.proposalDeadline).toISOString().slice(0, 10) : "sem-data";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#bfd2e0] bg-gradient-to-br from-[#eaf3f8] to-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#102b4e] p-3 text-white"><CalendarDays size={22} /></div>
          <div>
            <h2 className="text-lg font-bold text-[#102B4E]">Agenda de licitações</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Acompanhe os prazos das oportunidades que você marcou como favoritas. A agenda mostra os próximos 90 dias.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Na agenda</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{items.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Próximos 7 dias</p><p className="mt-1 text-2xl font-bold text-amber-700">{items.filter(item => item.proposalDeadline && new Date(item.proposalDeadline).getTime() <= Date.now() + 7 * 86400000).length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Com sessão definida</p><p className="mt-1 text-2xl font-bold text-cyan-800">{items.filter(item => item.sessionAt || item.openingDate).length}</p></div>
        </div>
      </section>
      {agenda.isLoading ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500">Carregando agenda…</p> :
        agenda.error ? <p className="rounded-xl border border-rose-200 bg-white p-5 text-sm text-rose-700">{agenda.error.message}</p> :
        !items.length ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <CalendarClock className="mx-auto text-slate-400" size={30} />
            <h3 className="mt-3 font-semibold text-[#102B4E]">Sua agenda ainda está vazia</h3>
            <p className="mt-1 text-sm text-slate-500">Marque oportunidades como favoritas para acompanhar aqui os prazos dos próximos 90 dias.</p>
            <Link href="/app/opportunities" className="mt-4 inline-flex rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white">Pesquisar licitações</Link>
          </section>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([day, dayItems]) => (
              <section key={day} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-[#102B4E]"><CalendarDays size={16} />{day === "sem-data" ? "Data não informada" : dayLabel(day + "T12:00:00")}</div>
                <div className="divide-y divide-slate-100">
                  {dayItems.map(item => (
                    <article key={item.id} className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">Prazo de propostas</span><span>{item.agencyName ?? "Órgão não informado"}</span></div>
                      <Link href={`/app/opportunities/${item.id}`} className="mt-2 block font-semibold leading-6 text-[#102B4E] hover:text-cyan-800">{item.title}</Link>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Clock3 size={15} />{formatDate(item.proposalDeadline)}</p>
                      <p className="mt-1 text-xs text-slate-500">{[item.municipality, item.state].filter(Boolean).join(" / ") || "Local não informado"} · {item.sourceName}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      }
    </div>
  );
}

export function NotificationsPage() {
  const utils = trpc.useUtils();
  const query = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: async () => { await utils.notifications.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const data = query.data;
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#bfd2e0] bg-gradient-to-br from-[#eaf3f8] to-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#102b4e] p-3 text-white"><Bell size={22} /></div>
          <div><h2 className="text-lg font-bold text-[#102B4E]">Central de notificações</h2><p className="mt-1 text-sm text-slate-600">{data?.unread ?? 0} não lida(s)</p></div>
        </div>
        {!!data?.unread && <button disabled={markRead.isPending} onClick={() => markRead.mutate({ all: true })} className="inline-flex items-center gap-2 rounded-lg border border-[#102B4E] px-3 py-2 text-sm font-semibold text-[#102B4E] hover:bg-slate-50 disabled:opacity-50"><CheckCheck size={16} />Marcar todas como lidas</button>}
      </section>
      {query.isLoading ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500">Carregando notificações…</p> :
        query.error ? <p className="rounded-xl border border-rose-200 bg-white p-5 text-sm text-rose-700">{query.error.message}</p> :
        !data?.items.length ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Bell className="mx-auto text-slate-400" size={30} /><h3 className="mt-3 font-semibold text-[#102B4E]">Nenhuma notificação por enquanto</h3><p className="mt-1 text-sm text-slate-500">Os avisos relacionados aos prazos das suas oportunidades favoritas aparecerão aqui.</p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {data.items.map(item => (
                <article key={item.id} className={`p-4 sm:p-5 ${item.readAt ? "bg-white" : "bg-cyan-50/60"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-slate-300" : "bg-cyan-600"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#102B4E]">{item.title}</h3><span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span></div>
                      {item.message && <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {item.href && <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-800 hover:underline">Ver oportunidade <ExternalLink size={13} /></Link>}
                        {!item.readAt && <button onClick={() => markRead.mutate({ id: item.id })} className="text-sm font-medium text-slate-500 hover:text-[#102B4E]">Marcar como lida</button>}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      }
    </div>
  );
}
