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
  sourceUrl: string | null;
  isFavorite?: boolean;
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
export function statusLabel(status: string) {
  return (
    (
      {
        receiving_proposals: "Recebendo propostas",
        published: "Publicada no PNCP",
        open: "Aberta",
        in_progress: "Em andamento",
        unknown: "Situação não informada",
        suspended: "Suspensa",
        closed: "Encerrada",
      } as Record<string, string>
    )[status] ?? status
  );
}
