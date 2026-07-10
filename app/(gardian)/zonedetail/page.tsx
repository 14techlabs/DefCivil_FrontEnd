"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { api } from "@/app/services/Api";

interface Zona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
}

interface Evento {
  id: number;
  zona: number;
  tipo: "desastre" | "mitigacao";
  nome: string;
  descricao: string;
  data_ocorrido: string;
  status: string | null;
}

interface ZoneDetailResponse {
  zonas: Zona;
  eventos: Evento[];
}

const STATUS_LABEL: Record<string, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  estavel: "Estável",
};

const TIPO_LABEL: Record<string, string> = {
  urbana: "Urbana",
  rural: "Rural",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase()
    .replace(/\./g, "");
}

function formatYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

function ZoneDetailContent() {
  const searchParams = useSearchParams();
  const zoneId = searchParams.get("zone");
  const { alertMode } = useGardian();
  const { router } = useAppNavigation();
  const back = () => router.push("/zones");

  const [data, setData] = useState<ZoneDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zoneId) return;

    let cancelled = false;
    api
      .get<ZoneDetailResponse>(`/zonas/${zoneId}/`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const z = data?.zonas;
  const eventos = useMemo(() => data?.eventos ?? [], [data]);

  const desastres = useMemo(
    () => eventos.filter((e) => e.tipo === "desastre"),
    [eventos],
  );

  const mitigacoes = useMemo(
    () => eventos.filter((e) => e.tipo === "mitigacao"),
    [eventos],
  );

  const allEventsSorted = useMemo(
    () =>
      [...eventos].sort(
        (a, b) =>
          new Date(b.data_ocorrido).getTime() -
          new Date(a.data_ocorrido).getTime(),
      ),
    [eventos],
  );

  if (!zoneId) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-8"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="text-center py-20">
          <Icon
            name="search_off"
            className="text-on-surface-variant text-[48px] mb-4"
          />
          <p className="text-sm text-on-surface-variant">
            Nenhuma zona especificada.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">
            Carregando detalhes da zona…
          </p>
        </div>
      </div>
    );
  }

  if (!z) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-8"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="text-center py-20">
          <Icon
            name="search_off"
            className="text-on-surface-variant text-[48px] mb-4"
          />
          <p className="text-sm text-on-surface-variant">
            Zona não encontrada.
          </p>
        </div>
      </div>
    );
  }

  const tone =
    z.status === "critico"
      ? "error"
      : z.status === "atencao"
        ? "warning"
        : "secondary";

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header>
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-4"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GEO-DATA PROTOCOL · v2.4</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>ZONA #{z.id}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <Chip tone={tone}>{STATUS_LABEL[z.status]}</Chip>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <Chip tone="neutral">{TIPO_LABEL[z.tipo] ?? z.tipo}</Chip>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              {z.nome}
            </h1>
            {z.descricao && (
              <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">
                {z.descricao}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-5">
        {/* Map */}
        <section className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MapPlaceholder
            variant="topo"
            height={500}
            alertMode={alertMode && z.status === "critico"}
          />
        </section>

        {/* Zone Info Card — replaces removed sensor cards */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          <div className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-center justify-between mb-6">
              <MetaTag>Informações da Zona</MetaTag>
              <Icon
                name="info"
                className="text-secondary text-[20px]"
              />
            </div>
            <div className="space-y-5">
              <div>
                <MetaTag className="block mb-1">Nome</MetaTag>
                <p className="font-headline font-black text-2xl text-primary tracking-tighter">
                  {z.nome}
                </p>
              </div>
              <div className="h-px bg-outline-variant/20" />
              <div>
                <MetaTag className="block mb-1">Tipo</MetaTag>
                <p className="font-headline font-black text-2xl text-primary tracking-tighter">
                  {TIPO_LABEL[z.tipo] ?? z.tipo}
                </p>
              </div>
              <div className="h-px bg-outline-variant/20" />
              <div>
                <MetaTag className="block mb-1">Status</MetaTag>
                <p
                  className={`font-headline font-black text-2xl tracking-tighter ${
                    tone === "error"
                      ? "text-error"
                      : tone === "warning"
                        ? "text-orange-600"
                        : "text-secondary"
                  }`}
                >
                  {STATUS_LABEL[z.status]}
                </p>
              </div>
            </div>
          </div>

          {/* Events count card */}
          <div className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-center justify-between mb-6">
              <MetaTag>Eventos</MetaTag>
              <Icon
                name="event"
                filled
                className="text-secondary text-[20px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-low rounded-lg p-4 text-center">
                <MetaTag className="block mb-1">Desastres</MetaTag>
                <p className="font-headline font-black text-3xl text-error tracking-tighter">
                  {String(desastres.length).padStart(2, "0")}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4 text-center">
                <MetaTag className="block mb-1">Mitigações</MetaTag>
                <p className="font-headline font-black text-3xl text-secondary tracking-tighter">
                  {String(mitigacoes.length).padStart(2, "0")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Desastres section — using backend eventos */}
        <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="HISTÓRICO" title="Desastres Registrados" />
          {desastres.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">
              Nenhum desastre registrado para esta zona.
            </p>
          ) : (
            <div className="space-y-3">
              {desastres.map((e) => (
                <div
                  key={e.id}
                  className="bg-surface-container-low p-4 rounded-lg flex gap-4"
                >
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-mono font-black text-error">
                      {formatYear(e.data_ocorrido)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-primary">{e.nome}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed line-clamp-3">
                      {e.descricao}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(e.data_ocorrido)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mitigações section — using backend eventos */}
        <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="SOLUÇÕES APLICADAS" title="Histórico de Mitigação" />
          {mitigacoes.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">
              Nenhuma mitigação registrada para esta zona.
            </p>
          ) : (
            <div className="space-y-4">
              {mitigacoes.map((e) => {
                const concluido =
                  e.status?.toLowerCase() === "concluído" ||
                  e.status?.toLowerCase() === "concluido";
                return (
                  <div
                    key={e.id}
                    className={`p-5 rounded-lg ${
                      concluido
                        ? "bg-secondary/8"
                        : "bg-warning-container/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon
                        name={concluido ? "check_circle" : "pending"}
                        filled
                        className={
                          concluido ? "text-secondary" : "text-orange-600"
                        }
                      />
                      <h5 className="font-bold text-sm text-primary">
                        {e.nome}
                      </h5>
                      {e.status && (
                        <Chip
                          tone={concluido ? "secondary" : "warning"}
                          className="ml-auto"
                        >
                          {concluido ? "CONCLUÍDA" : e.status.toUpperCase()}
                        </Chip>
                      )}
                    </div>
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">
                      {e.descricao}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(e.data_ocorrido)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Timeline of all eventos */}
        {allEventsSorted.length > 0 && (
          <section className="col-span-12 card-tonal p-10 shadow-ambient-sm relative overflow-hidden">
            <SectionHeader
              overline="LINHA DO TEMPO"
              title="Histórico de Eventos & Mitigação"
            />
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/40" />
              <div className="space-y-8 relative">
                {allEventsSorted.map((e) => {
                  const isDesastre = e.tipo === "desastre";
                  const color = isDesastre ? "primary" : "secondary";
                  return (
                    <div key={e.id} className="flex gap-6 pl-8 relative">
                      <div
                        className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full ring-4 ring-white ${
                          color === "primary"
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                        style={{
                          boxShadow:
                            "0 0 0 1px " +
                            (color === "primary" ? "#051125" : "#006A60"),
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-primary text-base">
                            {e.nome}
                          </h5>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-mono">
                            {formatDate(e.data_ocorrido)}
                          </span>
                        </div>
                        <p className="text-[13px] text-on-surface-variant leading-relaxed mb-3">
                          {e.descricao}
                        </p>
                        <div className="flex gap-2">
                          <Chip
                            tone={isDesastre ? "error" : "secondary"}
                          >
                            {isDesastre ? "DESASTRE" : "MITIGAÇÃO"}
                          </Chip>
                          {e.status && (
                            <Chip tone="neutral">{e.status}</Chip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ZoneDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-on-surface-variant">
          Carregando detalhes da zona…
        </div>
      }
    >
      <ZoneDetailContent />
    </Suspense>
  );
}
