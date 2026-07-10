"use client";

import { useEffect, useState } from "react";
import { Btn, Chip, Icon, MetaTag, Tab } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";
import { useAppNavigation } from "@/app/lib/useAppNavigation";

interface Zona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
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

export default function ZonesPage() {
  const { openZone } = useAppNavigation();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todas");

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ zonas: Zona[] }>("/zonas/")
      .then((res) => {
        if (!cancelled) setZonas(res.data.zonas);
      })
      .catch(() => {
        if (!cancelled) setZonas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = zonas.filter((z) => {
    if (filter === "todas") return true;
    if (filter === "criticas") return z.status === "critico";
    if (filter === "atencao") return z.status === "atencao";
    if (filter === "estaveis") return z.status === "estavel";
    if (filter === "urbanas") return z.tipo === "urbana";
    if (filter === "rurais") return z.tipo === "rural";
    return true;
  });

  const toneFor = (s: string) =>
    s === "critico" ? "error" : s === "atencao" ? "warning" : "secondary";

  const accentFor = (s: string) =>
    s === "critico" ? "bg-error" : s === "atencao" ? "bg-orange-500" : "bg-secondary";

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">Carregando zonas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GEO-DATA PROTOCOL · v2.4</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>
            {zonas.length} ZONAS ·{" "}
            {zonas.filter((z) => z.status === "critico").length} EM ALERTA
          </MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Gerenciamento de Zonas
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Mapeamento territorial completo · Defesa Civil · Distritos urbanos e rural
            </p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="filter_list">
              Filtros Avançados
            </Btn>
            <Btn variant="primary" icon="add">
              Nova Zona
            </Btn>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "todas", l: "Todas", c: zonas.length },
          { id: "criticas", l: "Críticas", c: zonas.filter((z) => z.status === "critico").length },
          { id: "atencao", l: "Atenção", c: zonas.filter((z) => z.status === "atencao").length },
          { id: "estaveis", l: "Estáveis", c: zonas.filter((z) => z.status === "estavel").length },
          { id: "urbanas", l: "Urbanas", c: zonas.filter((z) => z.tipo === "urbana").length },
          { id: "rurais", l: "Rurais", c: zonas.filter((z) => z.tipo === "rural").length },
        ].map((t) => (
          <Tab key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>
            {t.l} <span className="opacity-60">({t.c})</span>
          </Tab>
        ))}
      </div>

      {/* Zone cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((z) => (
          <button
            key={z.id}
            onClick={() => openZone(String(z.id))}
            className="card-tonal p-6 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group"
          >
            <span className={`absolute top-0 left-0 right-0 h-1 ${accentFor(z.status)}`} />
            <div className="flex items-start justify-between mb-4 mt-1">
              <Chip tone={toneFor(z.status)}>{STATUS_LABEL[z.status]}</Chip>
              <Icon
                name={
                  z.status === "critico"
                    ? "warning"
                    : z.status === "atencao"
                      ? "trending_up"
                      : "check_circle"
                }
                filled
                className={`text-[20px] ${z.status === "critico" ? "text-error" : z.status === "atencao" ? "text-orange-500" : "text-secondary"}`}
              />
            </div>

            <h3 className="font-headline font-black text-xl text-primary tracking-tight">
              {z.nome}
            </h3>

            {z.descricao && (
              <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed line-clamp-2">
                {z.descricao}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div className="bg-surface-container-low rounded-lg p-3">
                <MetaTag className="block mb-1">Tipo</MetaTag>
                <p className="font-headline font-black text-xl text-primary tracking-tighter">
                  {TIPO_LABEL[z.tipo] ?? z.tipo}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <MetaTag className="block mb-1">Código</MetaTag>
                <p className="font-headline font-black text-xl text-primary tracking-tighter">
                  #{z.id}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-on-surface-variant">
                {TIPO_LABEL[z.tipo] ?? z.tipo} · {STATUS_LABEL[z.status]}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-mono-tight text-primary group-hover:text-secondary transition-colors flex items-center gap-1">
                Detalhes <Icon name="arrow_forward" className="text-[14px]" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-20">
          <Icon name="search_off" className="text-on-surface-variant text-[48px] mb-4" />
          <p className="text-sm text-on-surface-variant">Nenhuma zona encontrada para este filtro.</p>
        </div>
      )}
    </div>
  );
}
