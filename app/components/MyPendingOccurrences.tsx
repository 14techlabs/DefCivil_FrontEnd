"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/app/services/Api";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
import { pendingForUser, type PendingOccurrence } from "@/app/lib/pendingOccurrences";
import { Btn, Chip, Icon } from "./Primitives";

export function MyPendingOccurrences({ userId }: { userId: number }) {
  const [items, setItems] = useState<PendingOccurrence[]>([]);
  const [zones, setZones] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get<{ ocorrencias: PendingOccurrence[] }>("/ocorrencias/minhas/")
      .then(({ data }) => {
        if (!cancelled) {
          setItems(pendingForUser(data.ocorrencias, userId));
          setError(false);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, attempt]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ zonas: { id: number; nome: string }[] } | { id: number; nome: string }[]>("/zonas/", { params: { lookup: "1" } })
      .then(({ data }) => {
        if (!cancelled) setZones(Object.fromEntries((Array.isArray(data) ? data : data.zonas).map((zone) => [zone.id, zone.nome])));
      })
      .catch(() => { /* O número da zona continua disponível. */ });
    return () => { cancelled = true; };
  }, [userId]);

  const urgent = items.filter((item) => getOccurrenceStatusMeta(item.status).key === "alta_prioridade").length;

  return (
    <section aria-labelledby="my-pending-title" aria-busy={loading} className="card-tonal overflow-hidden border border-secondary/20 shadow-ambient-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 id="my-pending-title" className="flex items-center gap-2 font-headline text-xl font-bold text-primary">
            <Icon name="assignment_ind" className="text-secondary" /> Minhas pendências
          </h2>
          {!loading && !error && <p className="mt-2 text-sm text-on-surface-variant">{items.length === 0 ? "Você não possui ocorrências pendentes." : `Você tem ${items.length} ocorrência${items.length === 1 ? " pendente" : "s pendentes"}.`}</p>}
        </div>
        {!loading && !error && urgent > 0 && <Chip tone="error">{urgent} em alta prioridade</Chip>}
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-2 px-6 pb-6 text-sm text-on-surface-variant"><Icon name="progress_activity" className="animate-spin" /> Carregando suas pendências…</p>
      ) : error ? (
        <div className="px-6 pb-6">
          <p role="alert" className="mb-3 text-sm text-error">Não foi possível carregar suas pendências.</p>
          <Btn variant="secondary" icon="refresh" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Tentar novamente</Btn>
        </div>
      ) : items.length > 0 && (
        <>
          <ul className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-secondary">#{item.id}</span><Chip tone={getOccurrenceStatusMeta(item.status).tone}>{getOccurrenceStatusMeta(item.status).label}</Chip></div>
                  <p className="mt-2 break-words text-sm font-bold text-primary">{item.titulo}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{item.zona == null ? "Sem zona vinculada" : zones[item.zona] ?? `Zona ${item.zona}`}</p>
                </div>
                <Link href={`/occurrences?minhas=1&id=${item.id}`} aria-label={`Ver ocorrência #${item.id}: ${item.titulo}`} className="rounded-lg bg-secondary/10 px-4 py-3 text-xs font-bold text-secondary hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">Ver ocorrência</Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-outline-variant/20 px-6 py-4">
            <Link href="/occurrences?minhas=1" className="rounded text-sm font-bold text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">Ver todas as minhas pendências ({items.length})</Link>
          </div>
        </>
      )}
    </section>
  );
}
