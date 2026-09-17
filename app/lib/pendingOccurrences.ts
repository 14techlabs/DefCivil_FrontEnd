import { getOccurrenceStatusMeta } from "./occurrenceStatus";

export interface PendingOccurrence {
  id: number;
  titulo: string;
  status: string;
  zona: number | null;
  tecnico_responsavel: number | null;
  created_at: string;
}

export function pendingForUser<T extends PendingOccurrence>(items: T[], userId: number): T[] {
  return items
    .filter((item) => item.tecnico_responsavel === userId && getOccurrenceStatusMeta(item.status).key !== "concluida")
    .sort((a, b) => {
      const priority = Number(getOccurrenceStatusMeta(b.status).key === "alta_prioridade")
        - Number(getOccurrenceStatusMeta(a.status).key === "alta_prioridade");
      return priority || (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || a.id - b.id;
    });
}
