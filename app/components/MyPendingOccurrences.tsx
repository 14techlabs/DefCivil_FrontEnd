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
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-5">
        <div>
          <h2 id="my-pending-title" className="flex items-center gap-2 font-headline text-lg font-bold text-primary">
            <Icon name="assignment_ind" className="text-[20px] text-secondary" /> Minhas pendências
          </h2>
          {!loading && !error && items.length === 0 && <p className="mt-1 text-xs text-on-surface-variant">Você não possui ocorrências pendentes.</p>}
        </div>
        {!loading && !error && urgent > 0 && <Chip tone="error">{urgent} em alta prioridade</Chip>}
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-2 px-4 pb-3 text-xs text-on-surface-variant"><Icon name="progress_activity" className="animate-spin text-[18px]" /> Carregando suas pendências…</p>
      ) : error ? (
        <div className="px-4 pb-3">
          <p role="alert" className="mb-3 text-sm text-error">Não foi possível carregar suas pendências.</p>
          <Btn variant="secondary" icon="refresh" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Tentar novamente</Btn>
        </div>
      ) : items.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-3 px-4 md:grid-cols-3">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col rounded-lg border border-outline-variant/20 bg-surface-container-low/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-[13px] font-bold leading-snug text-primary">{item.id} · {item.titulo}</p>
                  <span className="ml-auto shrink-0"><Chip tone={getOccurrenceStatusMeta(item.status).tone}>{getOccurrenceStatusMeta(item.status).label}</Chip></span>
                </div>
                <p className="mb-3 mt-1 flex items-center gap-1 text-xs text-on-surface-variant"><Icon name="location_on" className="shrink-0 text-[14px]" /><span className="min-w-0 break-words">{item.zona == null ? "Sem zona vinculada" : zones[item.zona] ?? `Zona ${item.zona}`}</span></p>
                <div className="mt-auto border-t border-outline-variant/20 pt-2">
                  <Link href={`/occurrences?minhas=1&id=${item.id}`} aria-label={`Ver ocorrência ${item.id}: ${item.titulo}`} className="flex items-center justify-between gap-2 rounded py-1 text-xs font-bold text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">Ver ocorrência <Icon name="arrow_forward" className="text-[16px]" /></Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-4">
            <Link href="/occurrences?minhas=1" className="rounded text-[13px] font-bold text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">Ver todas as minhas pendências ({items.length})</Link>
          </div>
        </>
      )}
    </section>
  );
}
