"use client";

import { useMemo, useState } from "react";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Btn, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { ADAPTABRASIL } from "@/app/data/adaptabrasil";

type GeoNode = {
  id: string;
  label: string;
  description?: string;
  value?: number;
  parent?: string;
  leaf?: boolean;
  composition?: { id: string; label: string; value: number }[];
  factors?: { label: string; weight: number }[];
};

// AdaptaBrasil gauge — 5-color gradient scale with needle at value (0..1)
function AdaptaGauge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const LEVELS = ADAPTABRASIL.LEVELS;
  const level = LEVELS.find(l => value >= l.range[0] && value <= l.range[1]) || LEVELS[0];
  const pct = value * 100;
  const heightCls = size === "lg" ? "h-4" : size === "sm" ? "h-2" : "h-3";
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-headline font-black text-5xl tracking-tighter" style={{ color: level.color }}>
          {value.toFixed(2).replace(".", ",")}
        </span>
        <span className="font-headline font-black text-xl tracking-tight" style={{ color: level.color }}>
          {level.label}
        </span>
      </div>
      <div className="relative">
        <div className={`w-full ${heightCls} rounded-sm overflow-hidden flex`}>
          {LEVELS.map(l => (
            <div key={l.id} className="flex-1" style={{ background: l.color }} />
          ))}
        </div>
        {/* Needle */}
        <div className="absolute top-[-4px] bottom-[-4px] w-[3px] bg-primary" style={{ left: `${pct}%`, transform: "translateX(-1.5px)" }} />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono font-bold text-slate-400">0</span>
          <span className="text-[10px] font-mono font-bold text-slate-400">1,00</span>
        </div>
      </div>
    </div>
  );
}

// Mini inline gauge for composition rows
function MiniGauge({ value }: { value: number }) {
  const LEVELS = ADAPTABRASIL.LEVELS;
  const pct = value * 100;
  return (
    <div className="relative flex-1 max-w-[180px]">
      <div className="w-full h-2 rounded-sm overflow-hidden flex">
        {LEVELS.map(l => <div key={l.id} className="flex-1" style={{ background: l.color }} />)}
      </div>
      <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-primary" style={{ left: `${pct}%`, transform: "translateX(-1px)" }} />
    </div>
  );
}

function LevelLegend() {
  const LEVELS = ADAPTABRASIL.LEVELS;
  return (
    <div className="card-tonal p-5 shadow-ambient-sm">
      <MetaTag className="block mb-3">ESCALA ADAPTABRASIL · IPCC</MetaTag>
      <div className="space-y-2">
        {LEVELS.map(l => (
          <div key={l.id} className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[12px] font-bold text-primary flex-1">{l.label}</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">{l.rangeLabel}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <span className="w-4 h-4 rounded-sm bg-slate-200 flex-shrink-0" />
          <span className="text-[12px] font-bold text-slate-400 flex-1">Dado indisponível</span>
        </div>
      </div>
    </div>
  );
}

export default function GeologyPage() {
  const { alertMode } = useGardian();
  const TYPES = ADAPTABRASIL.TYPES;
  const GEO = ADAPTABRASIL.GEO as Record<string, GeoNode>;

  const [selectedType, setSelectedType] = useState("geohidrologicos");
  const [path, setPath] = useState<string[]>(["root"]);
  const currentId = path[path.length - 1];
  const current = GEO[currentId] || GEO.root;

  const drillInto = (id: string) => {
    if (GEO[id] && !GEO[id].leaf) setPath([...path, id]);
  };
  const goBack = (idx: number) => {
    setPath(path.slice(0, idx + 1));
  };

  const breadcrumb = useMemo(() => {
    return path.map((id) => ({ id, label: GEO[id]?.label || id }));
  }, [path, GEO]);

  const selectedTypeData = TYPES.find((t) => t.id === selectedType) ?? TYPES[0];

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ADAPTABRASIL · MCTI</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>BASE CONCEITUAL CONFORME DEFINIÇÕES DO IPCC</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>PORTO SEGURO - BAHIA</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Risco Climático</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">Indicadores de impacto integrados por tipo de situação · Foco em desastres geo-hidrológicos · Escala de 0,00 a 1,00</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" icon="tune">Opções</Btn>
          </div>
        </div>
      </header>

      {/* Type selector — 7 impact types */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MetaTag className="text-secondary">TIPOS DE IMPACTO</MetaTag>
          <span className="text-[10px] text-on-surface-variant">Selecione para explorar indicadores</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {TYPES.map(t => {
            const active = selectedType === t.id;
            return (
              <button key={t.id} onClick={() => { setSelectedType(t.id); setPath(["root"]); }}
                className={`p-5 rounded-xl text-left transition-all relative overflow-hidden ${
                  active ? "shadow-ambient -translate-y-0.5" : "shadow-ambient-sm hover:-translate-y-0.5"
                }`}
                style={{
                  background: active ? t.color : "#fff",
                  color: active ? "#fff" : undefined,
                }}>
                {t.focus && !active && (
                  <span className="absolute top-2 right-2 text-[8px] font-mono font-black uppercase tracking-mono text-white px-1.5 py-0.5 rounded" style={{ background: t.color }}>FOCO</span>
                )}
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: active ? "rgba(255,255,255,0.18)" : t.color + "1A" }}>
                  <Icon name={t.icon} filled className="text-[22px]" style={{ color: active ? "#fff" : t.color }} />
                </div>
                <p className={`text-[12px] font-headline font-black leading-tight tracking-tight ${active ? "text-white" : "text-primary"}`}>{t.label}</p>
                <p className={`text-[10px] mt-1 ${active ? "text-white/70" : "text-on-surface-variant"}`}>
                  {t.subcategories.length} indicadores
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main drill-down area (only for geohidrologicos; others show a soft placeholder) */}
      {selectedType !== "geohidrologicos" ? (
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: selectedTypeData.color + "1A" }}>
            <Icon name={selectedTypeData.icon} filled className="text-[32px]" style={{ color: selectedTypeData.color }} />
          </div>
          <h3 className="font-headline font-black text-2xl text-primary tracking-tight">{selectedTypeData.label}</h3>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">Dados AdaptaBrasil disponíveis · Clique em "Desastres Geo-hidrológicos" para explorar a árvore completa de indicadores no foco atual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Left column — drill-down indicator detail */}
          <div className="col-span-12 lg:col-span-7 space-y-5">
            {/* Breadcrumb drill-down path */}
            <div className="card-tonal p-5 shadow-ambient-sm">
              <MetaTag className="block mb-3">NAVEGAÇÃO</MetaTag>
              <div className="space-y-2">
                {["Todos os Impactos", "Desastres Geo-hidrológicos", "Deslizamento de terra"].map((l, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-container-low">
                    <Icon name="chevron_left" className="text-on-surface-variant text-[16px]" />
                    <span className="text-[12px] font-bold text-primary">{l}</span>
                  </div>
                ))}
                {breadcrumb.slice(1).map((b, i) => (
                  <button key={b.id} onClick={() => goBack(i + 1)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/10 w-full text-left hover:bg-secondary/15">
                    <Icon name="chevron_left" className="text-secondary text-[16px]" />
                    <span className="text-[12px] font-bold text-secondary">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Current indicator */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#9C27B01A" }}>
                  <Icon name="landslide" filled className="text-[24px]" style={{ color: "#9C27B0" }} />
                </div>
                <div className="flex-1">
                  <MetaTag className="block mb-1">{current.parent ? current.parent.toUpperCase() : "DESLIZAMENTO DE TERRA"}</MetaTag>
                  <h2 className="font-headline font-black text-2xl text-primary tracking-tight leading-tight">{current.label}</h2>
                </div>
              </div>

              <AdaptaGauge value={current.value ?? 0} size="lg" />

              <p className="text-[13px] text-on-surface-variant leading-relaxed mt-5">{current.description}</p>

              <button className="text-[12px] font-bold text-secondary mt-3 hover:underline">Mais sobre esse dado →</button>
            </div>

            {/* Composition */}
            {current.composition && current.composition.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">Composição</h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2">
                  {current.composition.map(c => {
                    const hasDrill = GEO[c.id] && !GEO[c.id].leaf;
                    return (
                      <button key={c.id} onClick={() => drillInto(c.id)}
                        disabled={!hasDrill}
                        className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-all ${
                          hasDrill ? "bg-surface-container-low hover:bg-secondary/8 cursor-pointer" : "bg-surface-container-low opacity-75 cursor-default"
                        }`}>
                        <Icon name="arrow_forward" className="text-secondary text-[14px]" />
                        <span className="text-[13px] font-bold text-secondary flex-1">{c.label}</span>
                        <MiniGauge value={c.value} />
                        {hasDrill && <Icon name="chevron_right" className="text-on-surface-variant text-[18px]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fatores influenciadores */}
            {current.factors && current.factors.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">Fatores Influenciadores</h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {current.factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-surface-container-low">
                      <Icon name="expand_more" className="text-secondary text-[16px]" />
                      <span className="text-[12px] text-secondary flex-1 leading-snug">{f.label}</span>
                      <div className="w-24 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500" style={{ width: `${Math.min(100, f.weight * 4)}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-primary w-12 text-right">{f.weight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Map + Legend */}
          <div className="col-span-12 lg:col-span-5 space-y-5">
            <div className="card-tonal p-2 shadow-ambient-sm relative">
              {alertMode && (
                <div className="absolute top-6 left-6 z-20">
                  <div className="bg-error text-white px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-mono-tight flex items-center gap-2 shadow-ambient">
                    <Icon name="warning" filled className="text-[16px]" /> NÍVEL CRÍTICO DETECTADO
                  </div>
                </div>
              )}
              <MapPlaceholder variant="topo" height={420} />
            </div>

            <LevelLegend />

            {/* Quick zone ranking by current indicator */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="RANKING · PRESENTE" title="Zonas por Índice" />
              <div className="space-y-2">
                {[
                  { zone: "Morro da Esperança", val: 0.89 },
                  { zone: "Porto Seguro - Bahia - Zona Sul", val: 0.82 },
                  { zone: "Vila Esperança - Setor B", val: 0.74 },
                  { zone: "Vale das Acácias", val: 0.51 },
                  { zone: "Zona Rural Norte", val: 0.28 },
                  { zone: "Centro Industrial", val: 0.12 },
                ].map((r, i) => {
                  const lvl = ADAPTABRASIL.LEVELS.find((l) => r.val >= l.range[0] && r.val <= l.range[1]);
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-surface-container-low">
                      <span className="text-[10px] font-mono font-black text-slate-400 w-5">{String(i+1).padStart(2,"0")}</span>
                      <span className="text-[12px] font-bold text-primary flex-1 truncate">{r.zone}</span>
                      <MiniGauge value={r.val} />
                      <span className="text-[11px] font-headline font-black w-12 text-right" style={{ color: lvl?.color ?? "#5b6370" }}>
                        {r.val.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
