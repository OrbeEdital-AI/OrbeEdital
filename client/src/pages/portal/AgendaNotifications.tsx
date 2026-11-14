import { useMemo, useState } from "react";
import {
  Bell, CalendarClock, CalendarDays, CheckCheck, Clock3, ExternalLink,
  ChevronLeft, ChevronRight, ListFilter, CalendarRange, CalendarCheck2,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type CalendarView = "month" | "week" | "day";
type EventKind = "deadline" | "opening" | "session";
type AgendaItem = {
  id: string;
  title: string;
  agencyName?: string | null;
  municipality?: string | null;
  state?: string | null;
  sourceName: string;
  proposalDeadline?: Date | string | null;
  openingDate?: Date | string | null;
  sessionAt?: Date | string | null;
};

type CalendarEvent = {
  id: string;
  opportunityId: string;
  title: string;
  date: Date;
  kind: EventKind;
  agencyName: string;
  municipality: string;
  state: string;
  sourceName: string;
};

const TIME_ZONE = "America/Sao_Paulo";
const kindMeta: Record<EventKind, { label: string; short: string; dot: string; pill: string }> = {
  deadline: { label: "Prazo de propostas", short: "Prazo", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 border-amber-200" },
  opening: { label: "Abertura", short: "Abertura", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  session: { label: "Sessão pública", short: "Sessão", dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 border-sky-200" },
};

function dateKey(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function shiftDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: TIME_ZONE }).format(date);
}

function formatDay(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, ...options }).format(date);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(value);
}

function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function buildEvents(items: AgendaItem[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const item of items) {
    const common = {
      opportunityId: item.id,
      title: item.title,
      agencyName: item.agencyName ?? "Órgão não informado",
      municipality: item.municipality ?? "",
      state: item.state ?? "",
      sourceName: item.sourceName,
    };
    const dates: Array<[EventKind, Date | string | null | undefined]> = [
      ["deadline", item.proposalDeadline],
      ["opening", item.openingDate],
      ["session", item.sessionAt],
    ];
    for (const [kind, value] of dates) {
      if (!value) continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) continue;
      events.push({ ...common, id: `${item.id}-${kind}`, date, kind });
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function AgendaPage() {
  const agenda = trpc.agenda.list.useQuery();
  const items = (agenda.data ?? []) as AgendaItem[];
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [view, setView] = useState<CalendarView>("month");
  const [kindFilter, setKindFilter] = useState<EventKind | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const events = useMemo(() => buildEvents(items), [items]);
  const sources = useMemo(() => Array.from(new Set(items.map(item => item.sourceName).filter(Boolean))).sort(), [items]);
  const filteredEvents = useMemo(() => events.filter(event =>
    (kindFilter === "all" || event.kind === kindFilter) &&
    (sourceFilter === "all" || event.sourceName === sourceFilter) &&
    (!locationFilter.trim() || `${event.municipality} ${event.state}`.toLocaleLowerCase("pt-BR").includes(locationFilter.trim().toLocaleLowerCase("pt-BR")))
  ), [events, kindFilter, sourceFilter, locationFilter]);
  const eventsByDay = useMemo(() => filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = dateKey(event.date);
    (acc[key] ??= []).push(event);
    return acc;
  }, {}), [filteredEvents]);
  const todayKey = dateKey(new Date());
  const selectedEvents = eventsByDay[selectedDay] ?? [];
  const upcoming = filteredEvents.filter(event => dateKey(event.date) >= todayKey);
  const nextWeek = upcoming.filter(event => {
    const delta = dateFromKey(dateKey(event.date)).getTime() - dateFromKey(todayKey).getTime();
    return delta >= 0 && delta < 7 * 86400000;
  });
  const monthDays = useMemo(() => {
    const first = monthStart(cursor);
    const start = shiftDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => shiftDays(start, index));
  }, [cursor]);
  const weekDays = useMemo(() => {
    const start = getWeekStart(cursor);
    return Array.from({ length: 7 }, (_, index) => shiftDays(start, index));
  }, [cursor]);
  const visibleDays = view === "month" ? monthDays : view === "week" ? weekDays : [dateFromKey(selectedDay)];
  const heading = view === "day"
    ? formatDay(dateFromKey(selectedDay), { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week"
      ? `${formatDay(weekDays[0], { day: "2-digit", month: "short" })} – ${formatDay(weekDays[6], { day: "2-digit", month: "short", year: "numeric" })}`
      : formatMonth(cursor);
  const moveCursor = (direction: number) => {
    if (view === "day") {
      const next = shiftDays(dateFromKey(selectedDay), direction);
      setSelectedDay(dateKey(next));
      setCursor(next);
    } else if (view === "week") {
      setCursor(shiftDays(cursor, direction * 7));
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1, 12));
    }
  };
  const goToday = () => {
    const now = new Date();
    setCursor(now);
    setSelectedDay(dateKey(now));
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#bfd2e0] bg-gradient-to-br from-[#eaf3f8] to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#102b4e] p-3 text-white"><CalendarDays size={22} /></div>
            <div>
              <h2 className="text-lg font-bold text-[#102B4E]">Agenda de licitações</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Visualize os prazos, aberturas e sessões das oportunidades que você acompanha. Os horários são exibidos no fuso de Brasília.</p>
            </div>
          </div>
          <button onClick={goToday} className="rounded-lg border border-[#102b4e] bg-white px-3 py-2 text-sm font-semibold text-[#102b4e] hover:bg-slate-50">Hoje</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Eventos na agenda</p><p className="mt-1 text-2xl font-bold text-[#102B4E]">{filteredEvents.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Próximos 7 dias</p><p className="mt-1 text-2xl font-bold text-amber-700">{nextWeek.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Oportunidades acompanhadas</p><p className="mt-1 text-2xl font-bold text-cyan-800">{items.length}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button aria-label="Período anterior" onClick={() => moveCursor(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft size={18}/></button>
            <button aria-label="Próximo período" onClick={() => moveCursor(1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronRight size={18}/></button>
            <h3 className="ml-1 text-lg font-bold capitalize text-[#102B4E]">{heading}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(["month", "week", "day"] as CalendarView[]).map(option => (
                <button key={option} onClick={() => setView(option)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === option ? "bg-[#102b4e] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>
                  {option === "month" ? "Mês" : option === "week" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 md:col-span-1">
            <ListFilter size={15} className="shrink-0"/>
            <select aria-label="Filtrar tipo de evento" value={kindFilter} onChange={event => setKindFilter(event.target.value as EventKind | "all")} className="w-full bg-transparent outline-none">
              <option value="all">Todos os eventos</option>
              <option value="deadline">Prazos de propostas</option>
              <option value="opening">Aberturas</option>
              <option value="session">Sessões públicas</option>
            </select>
          </label>
          <label className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-1">
            <select aria-label="Filtrar fonte" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} className="w-full bg-transparent text-slate-600 outline-none">
              <option value="all">Todas as fontes</option>
              {sources.map(source => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
          <input aria-label="Filtrar município ou estado" value={locationFilter} onChange={event => setLocationFilter(event.target.value)} placeholder="Município ou UF" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-cyan-700 md:col-span-1"/>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-100 pb-3">
          {(Object.keys(kindMeta) as EventKind[]).map(kind => (
            <span key={kind} className="inline-flex items-center gap-2 text-xs text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${kindMeta[kind].dot}`}/>{kindMeta[kind].label}</span>
          ))}
        </div>

        {agenda.isLoading ? <p className="p-8 text-center text-sm text-slate-500">Carregando calendário…</p> :
          agenda.error ? <p className="p-6 text-sm text-rose-700">{agenda.error.message}</p> :
          !filteredEvents.length ? (
            <div className="py-12 text-center">
              <CalendarCheck2 className="mx-auto text-slate-400" size={34}/>
              <h3 className="mt-3 font-semibold text-[#102B4E]">Nenhum evento encontrado</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Adicione oportunidades aos favoritos para acompanhar aqui os prazos de propostas, aberturas e sessões públicas.</p>
              <Link href="/app/opportunities" className="mt-4 inline-flex rounded-lg bg-[#102B4E] px-4 py-2.5 text-sm font-semibold text-white">Pesquisar licitações</Link>
            </div>
          ) : (
            <div className="mt-3">
              <div className="grid grid-cols-7 border-b border-slate-100">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{day}</div>)}
              </div>
              <div className={`grid grid-cols-7 ${view === "month" ? "" : "min-h-[150px]"}`}>
                {visibleDays.map(day => {
                  const key = dateKey(day);
                  const dayEvents = eventsByDay[key] ?? [];
                  const isCurrentMonth = day.getMonth() === cursor.getMonth();
                  const isSelected = key === selectedDay;
                  const isToday = key === todayKey;
                  return (
                    <button key={key} onClick={() => { setSelectedDay(key); if (view === "day") setCursor(day); }} className={`group min-h-[76px] overflow-hidden border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-cyan-50/60 sm:min-h-[106px] sm:p-2 ${view === "month" && !isCurrentMonth ? "bg-slate-50/70" : "bg-white"} ${isSelected ? "ring-2 ring-inset ring-cyan-700 bg-cyan-50/40" : ""}`}>
                      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? "bg-[#102b4e] text-white" : isCurrentMonth || view !== "month" ? "text-slate-700" : "text-slate-300"}`}>{day.getDate()}</span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, view === "month" ? 2 : 5).map(event => (
                          <div key={event.id} className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold sm:text-[10px] ${kindMeta[event.kind].pill}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kindMeta[event.kind].dot}`}/>
                            <span className="truncate">{kindMeta[event.kind].short}: {event.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > (view === "month" ? 2 : 5) && <p className="px-1 text-[10px] font-medium text-slate-500">+{dayEvents.length - (view === "month" ? 2 : 5)} eventos</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
          <div>
            <h3 className="font-bold capitalize text-[#102B4E]">{formatDay(dateFromKey(selectedDay), { weekday: "long", day: "numeric", month: "long" })}</h3>
            <p className="text-xs text-slate-500">{selectedEvents.length} evento(s) nesta data</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/> Horário de Brasília</span>
        </div>
        {!selectedEvents.length ? <p className="p-6 text-sm text-slate-500">Nenhum evento nesta data. Selecione outro dia no calendário.</p> :
          <div className="divide-y divide-slate-100">
            {selectedEvents.map(event => (
              <article key={event.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${kindMeta[event.kind].pill}`}><span className={`h-1.5 w-1.5 rounded-full ${kindMeta[event.kind].dot}`}/>{kindMeta[event.kind].label}</span>
                  <span className="text-xs text-slate-500">{formatTime(event.date)}</span>
                </div>
                <Link href={`/app/opportunities/${event.opportunityId}`} className="mt-2 block font-semibold leading-6 text-[#102B4E] hover:text-cyan-800">{event.title}</Link>
                <p className="mt-1 text-sm text-slate-600">{event.agencyName}</p>
                <p className="mt-1 text-xs text-slate-500">{[event.municipality, event.state].filter(Boolean).join(" / ") || "Local não informado"} · {event.sourceName}</p>
                <Link href={`/app/opportunities/${event.opportunityId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-800 hover:underline">Ver oportunidade <ExternalLink size={13}/></Link>
              </article>
            ))}
          </div>
        }
      </section>
      <p className="text-xs leading-5 text-slate-500">A agenda reúne os prazos das oportunidades favoritas com datas futuras disponibilizadas pelas fontes conectadas. Confira sempre o edital e a publicação oficial do órgão, pois retificações podem alterar datas e horários.</p>
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
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#102B4E]">{item.title}</h3><span className="text-xs text-slate-500">{formatDay(item.createdAt, { dateStyle: "short", timeStyle: "short" })}</span></div>
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
