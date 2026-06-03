"use client";

import { useState } from "react";
import { Bar, Btn, Chip, Icon, MetaTag, Tab } from "@/app/components/Primitives";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { useAppNavigation } from "@/app/lib/useAppNavigation";

export default function ZonesPage() {
  const ZONES = GARDIAN_DATA.ZONES;
  const { openZone } = useAppNavigation();
  const [filter, setFilter] = useState("todas");

  const filtered = ZONES.filter(z => {
    if (filter === "todas") return true;
    if (filter === "criticas") return z.status === "critico";
    if (filter === "atencao") return z.status === "atencao";
    if (filter === "estaveis") return z.status === "estavel";
    if (filter === "urbanas") return z.type === "urbana";
    if (filter === "rurais") return z.type === "rural";
  });

  const toneFor = (s: string) =>
    s === "critico" ? "error" : s === "atencao" ? "warning" : "secondary";
  const accentFor = (s: string) =>
    s === "critico" ? "bg-error" : s === "atencao" ? "bg-orange-500" : "bg-secondary";

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GEO-DATA PROTOCOL · v2.4</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{ZONES.length} ZONAS · 3 EM ALERTA</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Gerenciamento de Zonas</h1>
            <p className="text-sm text-on-surface-variant mt-2">Mapeamento territorial completo · Defesa Civil · Distritos urbanos e rural</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="filter_list">Filtros Avançados</Btn>
            <Btn variant="primary" icon="add">Nova Zona</Btn>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "todas", l: "Todas", c: ZONES.length },
          { id: "criticas", l: "Críticas", c: ZONES.filter(z=>z.status==="critico").length },
          { id: "atencao", l: "Atenção", c: ZONES.filter(z=>z.status==="atencao").length },
          { id: "estaveis", l: "Estáveis", c: ZONES.filter(z=>z.status==="estavel").length },
          { id: "urbanas", l: "Urbanas", c: ZONES.filter(z=>z.type==="urbana").length },
          { id: "rurais", l: "Rurais", c: ZONES.filter(z=>z.type==="rural").length },
        ].map(t => (
          <Tab key={t.id} active={filter===t.id} onClick={() => setFilter(t.id)}>
            {t.l} <span className="opacity-60">({t.c})</span>
          </Tab>
        ))}
      </div>

      {/* Zone cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(z => (
          <button key={z.id} onClick={() => openZone(z.id)} className="card-tonal p-6 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group">
            <span className={`absolute top-0 left-0 right-0 h-1 ${accentFor(z.status)}`} />
            <div className="flex items-start justify-between mb-5 mt-1">
              <Chip tone={toneFor(z.status)}>{z.statusLabel}</Chip>
              <Icon name={z.status==="critico" ? "warning" : z.status==="atencao" ? "trending_up" : "check_circle"}
                filled className={`text-[20px] ${z.status==="critico"?"text-error":z.status==="atencao"?"text-orange-500":"text-secondary"}`} />
            </div>
            <h3 className="font-headline font-black text-xl text-primary tracking-tight">{z.name}</h3>
            <p className="text-[11px] font-bold text-on-surface-variant mt-1">Distrito: {z.district}</p>

            <div className="grid grid-cols-2 gap-4 mt-6 mb-5">
              <div className="bg-surface-container-low rounded-lg p-3">
                <MetaTag className="block mb-1">Ocorrências</MetaTag>
                <p className="font-headline font-black text-3xl text-primary tracking-tighter">{String(z.occurrences).padStart(2,"0")}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <MetaTag className="block mb-1">Estabilidade</MetaTag>
                <p className={`font-headline font-black text-3xl tracking-tighter ${z.status==="critico"?"text-error":z.status==="atencao"?"text-orange-600":"text-secondary"}`}>{z.stability}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">{z.primarySensor.label}</span>
                <span className={`text-[11px] font-headline font-black ${z.status==="critico"?"text-error":z.status==="atencao"?"text-orange-600":"text-secondary"}`}>
                  {z.primarySensor.value}{z.primarySensor.unit}
                </span>
              </div>
              <Bar value={typeof z.primarySensor.value === "number" ? z.primarySensor.value : 50} tone={toneFor(z.status)} />
            </div>

            <div className="mt-5 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">{z.id}</span>
              <span className="text-[10px] font-bold uppercase tracking-mono-tight text-primary group-hover:text-secondary transition-colors flex items-center gap-1">
                Detalhes Telemetria <Icon name="arrow_forward" className="text-[14px]" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
