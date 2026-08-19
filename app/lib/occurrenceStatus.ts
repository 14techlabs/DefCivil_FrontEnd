import type { ChipTone } from "@/app/components/Primitives";

export type OccurrenceStatusKey =
  | "alta_prioridade"
  | "aguardando"
  | "em_analise"
  | "em_andamento"
  | "concluida";

export interface OccurrenceStatusMeta {
  key: OccurrenceStatusKey | "desconhecido";
  label: string;
  tone: ChipTone;
  color: string;
  accentClass: string;
}

const STATUS_META: Record<OccurrenceStatusKey, OccurrenceStatusMeta> = {
  alta_prioridade: {
    key: "alta_prioridade",
    label: "Alta Prioridade",
    tone: "error",
    color: "#BA1A1A",
    accentClass: "bg-error",
  },
  aguardando: {
    key: "aguardando",
    label: "Aguardando",
    tone: "warning",
    color: "#C2570B",
    accentClass: "bg-orange-500",
  },
  em_analise: {
    key: "em_analise",
    label: "Em Análise",
    tone: "info",
    color: "#2563EB",
    accentClass: "bg-blue-500",
  },
  em_andamento: {
    key: "em_andamento",
    label: "Em Andamento",
    tone: "progress",
    color: "#7C3AED",
    accentClass: "bg-violet-500",
  },
  concluida: {
    key: "concluida",
    label: "Concluída",
    tone: "secondary",
    color: "#006A60",
    accentClass: "bg-secondary",
  },
};

const STATUS_ALIASES: Record<string, OccurrenceStatusKey> = {
  alta_prioridade: "alta_prioridade",
  aguardando: "aguardando",
  em_analise: "em_analise",
  em_andamento: "em_andamento",
  concluida: "concluida",
  concluido: "concluida",
};

export function normalizeOccurrenceStatus(status?: string | null): string {
  return (status ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

export function getOccurrenceStatusMeta(status?: string | null): OccurrenceStatusMeta {
  const normalized = normalizeOccurrenceStatus(status);
  const key = STATUS_ALIASES[normalized];
  if (key) return STATUS_META[key];

  return {
    key: "desconhecido",
    label: normalized ? normalized.replaceAll("_", " ") : "Sem status",
    tone: "neutral",
    color: "#64748B",
    accentClass: "bg-slate-400",
  };
}

