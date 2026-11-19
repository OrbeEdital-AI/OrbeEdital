import { CircleAlert, RefreshCw, Shield } from "lucide-react";

export type AnyOpportunity = {
  id: string;
  title: string;
  agencyName: string | null;
  municipality: string | null;
  state: string | null;
  modality: string | null;
  status: string;
  estimatedValue: string | null;
  publicationDate?: Date | string | null;
  proposalDeadline: Date | string | null;
  sourceName?: string;
  lastSyncedAt?: Date | string | null;
  sourceUrl: string | null;
  isFavorite?: boolean;
  deadlineExtended?: boolean;
};
export const money = (value: string | number | null | undefined) => {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
};
export const date = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Não informado";
export const dateTime = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Não informado";
export const brazilGreeting = (value = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(value));
  return hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
};
export function NoPermission() {
  return (
    <div className="rounded-xl border border-rose-200 bg-white p-8 text-center">
      <Shield className="mx-auto text-rose-700" />
      <h2 className="mt-3 font-semibold">Acesso não autorizado</h2>
      <p className="mt-2 text-sm text-slate-500">
        Seu perfil não tem permissão para consultar este módulo.
      </p>
    </div>
  );
}
export function Loading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
      <RefreshCw
        className="mx-auto mb-3 animate-spin text-cyan-700"
        size={20}
      />
      {label}
    </div>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-white p-6"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 text-rose-700" size={18} />
        <div>
          <p className="font-semibold text-rose-900">
            Não foi possível carregar os dados
          </p>
          <p className="mt-1 break-words text-sm text-slate-600">{message}</p>
          {onRetry && (
            <button
              className="mt-3 rounded-md border px-3 py-1.5 text-sm"
              onClick={onRetry}
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export function OpportunityStatusBadges({
  status,
  deadlineExtended = false,
}: {
  status: string;
  deadlineExtended?: boolean;
}) {
  const statusClasses: Record<string, string> = {
    receiving_proposals: "bg-emerald-50 text-emerald-800",
    published: "bg-sky-50 text-sky-800",
    open: "bg-emerald-50 text-emerald-800",
    in_progress: "bg-emerald-50 text-emerald-800",
    judging: "bg-violet-50 text-violet-800",
    homologated: "bg-slate-100 text-slate-800",
    awarded: "bg-indigo-50 text-indigo-800",
    suspended: "bg-amber-100 text-amber-900",
    revoked: "bg-rose-100 text-rose-800",
    annulled: "bg-rose-100 text-rose-800",
    closed: "bg-slate-100 text-slate-700",
    unknown: "bg-slate-100 text-slate-700",
  };
  const showStatus = status !== "unknown" || !deadlineExtended;

  return (
    <>
      {showStatus && (
        <span
          aria-label={`Situação: ${statusLabel(status)}`}
          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses[status] ?? statusClasses.unknown}`}
        >
          {statusLabel(status)}
        </span>
      )}
      {deadlineExtended && (
        <span
          aria-label="Prazo prorrogado"
          title="A fonte informa que o prazo foi prorrogado."
          className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800"
        >
          Prazo prorrogado
        </span>
      )}
    </>
  );
}
export function statusLabel(status: string) {
  return (
    (
      {
        receiving_proposals: "Recebendo propostas",
        published: "Publicada no PNCP",
        open: "Aberta",
        in_progress: "Em andamento",
        judging: "Em julgamento",
        homologated: "Homologada",
        awarded: "Adjudicada",
        unknown: "Situação não informada",
        suspended: "Suspensa",
        revoked: "Revogada",
        annulled: "Anulada",
        closed: "Encerrada",
      } as Record<string, string>
    )[status] ?? status
  );
}

/** Estados administrativos compartilhados: texto e cor sempre representam a mesma situação. */
export function AdminStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = String(status ?? "unknown").toLowerCase();
  const states: Record<string, { label: string; className: string }> = {
    approved: { label: "Pago", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    completed: { label: "Concluído", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    success: { label: "Concluído", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    active: { label: "Ativo", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    pending: { label: "Pendente", className: "bg-amber-50 text-amber-900 border-amber-200" },
    running: { label: "Em andamento", className: "bg-sky-50 text-sky-800 border-sky-200" },
    processing: { label: "Processando", className: "bg-sky-50 text-sky-800 border-sky-200" },
    failed: { label: "Com falha", className: "bg-rose-50 text-rose-800 border-rose-200" },
    error: { label: "Com falha", className: "bg-rose-50 text-rose-800 border-rose-200" },
    cancelled: { label: "Cancelado", className: "bg-slate-100 text-slate-700 border-slate-200" },
    canceled: { label: "Cancelado", className: "bg-slate-100 text-slate-700 border-slate-200" },
    refunded: { label: "Estornado", className: "bg-slate-100 text-slate-700 border-slate-200" },
    disabled: { label: "Desabilitado", className: "bg-slate-100 text-slate-500 border-slate-200" },
    paused: { label: "Pausado", className: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const state = states[normalized] ?? { label: status || "Não informado", className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${state.className}`}>{state.label}</span>;
}

export function EmptyState({ message }: { message: string }) {
  return <p role="status" className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">{message}</p>;
}

/** Paginação compartilhada: 5, 10, 20 ou 50 itens por página. */
export function AdminPagination({ total, page, pageSize, onPageChange, onPageSizeChange }: {
  total: number; page: number; pageSize: number;
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = total ? (current - 1) * pageSize + 1 : 0;
  const end = Math.min(current * pageSize, total);
  const first = Math.max(1, Math.min(current - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  return <nav aria-label="Paginação da lista" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
    <div className="flex flex-wrap items-center gap-2"><label htmlFor="admin-page-size">Exibir:</label>
      <select id="admin-page-size" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="rounded-md border bg-white px-2 py-1.5 text-sm">{[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}</select>
      <span>{start}–{end} de {total} itens</span>
    </div>
    <div className="flex flex-wrap items-center gap-1"><span className="mr-1">Página:</span>
      <button type="button" aria-label="Página anterior" disabled={current <= 1} onClick={() => onPageChange(current - 1)} className="rounded border px-2 py-1.5 disabled:opacity-40">‹</button>
      {first > 1 && <span aria-hidden="true">…</span>}
      {numbers.map(n => <button key={n} type="button" aria-label={`Página ${n}`} aria-current={n === current ? "page" : undefined} onClick={() => onPageChange(n)} className={`min-w-7 rounded border px-2 py-1.5 ${n === current ? "border-cyan-700 bg-cyan-700 font-bold text-white" : "bg-white hover:bg-slate-50"}`}>{n}</button>)}
      {first + numbers.length - 1 < pages && <span aria-hidden="true">…</span>}
      <button type="button" aria-label="Próxima página" disabled={current >= pages} onClick={() => onPageChange(current + 1)} className="rounded border px-2 py-1.5 disabled:opacity-40">›</button>
    </div>
  </nav>;
}
