import { useState } from "react";
import { Search, RefreshCw, ShieldCheck, ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { timeZone: "America/Recife" });
}

export default function AdminAuditPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const audit = trpc.adminUsers.audit.useQuery(
    { query: query.trim() || undefined, page, pageSize: 25 },
    { retry: false, placeholderData: previous => previous }
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-cyan-50 p-2 text-cyan-800"><ShieldCheck size={19}/></span>
          <div>
            <h2 className="font-semibold text-[#102B4E]">Trilha de auditoria</h2>
            <p className="mt-1 text-sm text-slate-500">Eventos persistidos no banco. Ações administrativas passam a ser registradas pelas operações instrumentadas.</p>
          </div>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Filtrar ação, entidade ou identificador" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-700"/>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-3 text-sm text-slate-500">
          <span>{audit.data?.total ?? 0} eventos encontrados</span>
          <button onClick={() => audit.refetch()} disabled={audit.isFetching} className="inline-flex items-center gap-2 font-medium text-cyan-800 disabled:opacity-50"><RefreshCw className={audit.isFetching ? "animate-spin" : ""} size={14}/> Atualizar</button>
        </div>
        {audit.isLoading ? (
          <p className="p-10 text-center text-sm text-slate-500">Carregando registros de auditoria…</p>
        ) : audit.error ? (
          <div className="p-8 text-center"><p className="text-sm font-semibold text-rose-800">Não foi possível carregar a trilha de auditoria.</p><p className="mt-2 break-words text-xs text-rose-700">{audit.error.message}</p><button onClick={() => audit.refetch()} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">Tentar novamente</button></div>
        ) : audit.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Data</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Entidade</th><th className="px-4 py-3">Detalhes</th></tr>
              </thead>
              <tbody>
                {audit.data.items.map(item => (
                  <tr key={item.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{item.actorName ?? "Sistema"}</p><p className="text-xs text-slate-500">{item.actorEmail ?? "Evento sem usuário associado"}</p></td>
                    <td className="px-4 py-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900">{item.action}</span></td>
                    <td className="px-4 py-3">{item.entityType}{item.entityId ? <p className="max-w-[180px] truncate text-xs text-slate-500">{item.entityId}</p> : null}</td>
                    <td className="max-w-[320px] px-4 py-3 text-xs text-slate-600"><details className="group"><summary className="cursor-pointer select-none font-semibold text-cyan-800 hover:text-cyan-950">Ver detalhes do evento</summary><pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-700">{JSON.stringify(item.details ?? {}, null, 2)}</pre></details></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <ClipboardList className="h-8 w-8 text-slate-300"/>
            <p className="mt-3 font-medium text-slate-700">Nenhum evento encontrado</p>
            <p className="mt-1 text-sm text-slate-500">As próximas operações administrativas instrumentadas aparecerão aqui.</p>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-slate-500">Página {audit.data?.page ?? page} de {Math.max(1, audit.data?.pageCount ?? 1)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
            <button disabled={page >= (audit.data?.pageCount ?? 1)} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button>
          </div>
        </div>
      </div>
    </section>
  );
}
