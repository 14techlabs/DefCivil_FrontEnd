"use client";

import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Bar, type BarTone, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";

type PrecipLevel = "low" | "medium" | "high";

const PRECIP_STYLES: Record<
  PrecipLevel,
  { label: string; text: string; bg: string; border: string; bar: string; drops: number }
> = {
  low: {
    label: "Baixa",
    text: "text-secondary",
    bg: "bg-secondary/10",
    border: "border-secondary/40",
    bar: "bg-secondary",
    drops: 1,
  },
  medium: {
    label: "Média",
    text: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-400/50",
    bar: "bg-orange-500",
    drops: 2,
  },
  high: {
    label: "Alta",
    text: "text-error",
    bg: "bg-error-container/40",
    border: "border-error/50",
    bar: "bg-error",
    drops: 3,
  },
};

export default function WeatherPage() {
  const { alertMode } = useGardian();
  const W = GARDIAN_DATA.WEATHER;
  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">METEOROLOGIA · CPTEC + GOES-16</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>ATUALIZADO ÀS {W.updatedAt}</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Vigilância Meteorológica</h1>
      </header>

      <div className="grid grid-cols-12 gap-5">
        {/* Hero */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          <div className="card-tonal p-8 shadow-ambient-sm relative overflow-hidden">
            <div className="absolute top-4 right-4 opacity-[0.06]">
              <Icon name="thunderstorm" filled className="text-[160px]" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 text-secondary font-bold text-[10px] tracking-mono uppercase mb-2">
                <Icon name="location_on" className="text-[14px]" /> {W.location}
              </div>
              <h2 className="font-headline font-black text-5xl text-primary tracking-tighter mb-1">{W.condition}</h2>
              <p className="text-xs text-slate-400 mb-8">Atualizado às {W.updatedAt} · Satélite {W.satellite}</p>
              <div className="flex items-baseline gap-3">
                <span className="font-headline font-black text-8xl text-primary tracking-tighter">{W.temp}°</span>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-300">C</span>
                  <Chip tone="error">CRÍTICO</Chip>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: "Sensação", v: `${W.feels}°C`, icon: "thermometer", tone: "secondary", bar: 50 },
              { l: "Precíp.", v: `${W.precipitation}%`, icon: "rainy", tone: "error", bar: W.precipitation },
              { l: "Vento", v: `${W.wind} km/h`, icon: "air", tone: "warning", sub: W.windDir },
              { l: "Umidade", v: `${W.humidity}%`, icon: "humidity_mid", tone: "error", bar: W.humidity },
              { l: "Índice UV", v: `${W.uv}`, sub: W.uvLabel, icon: "light_mode", tone: "secondary" },
              { l: "Pressão", v: `${W.pressure} hPa`, icon: "compress", tone: "warning", sub: W.pressureLabel },
            ].map((it, i) => (
              <div key={i} className="card-recessed p-5">
                <div className="flex items-center justify-between mb-4">
                  <MetaTag>{it.l}</MetaTag>
                  <Icon name={it.icon} className={`text-[18px] ${it.tone==="error"?"text-error":it.tone==="warning"?"text-orange-500":"text-secondary"}`} />
                </div>
                <p className="font-headline font-black text-2xl text-primary tracking-tighter">{it.v}</p>
                {it.bar !== undefined && (
                  <Bar value={it.bar} tone={it.tone as BarTone} className="mt-3" />
                )}
                {it.sub && <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-mono-tight mt-2">{it.sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Radar Map */}
        <div className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MapPlaceholder variant="radar" height={650} alertMode={alertMode} />
        </div>

        {/* 5 day forecast */}
        <div className="col-span-12 card-recessed p-8">
          <SectionHeader overline="MODELO ECMWF" title="Previsão 5 Dias" action={
            <div className="flex gap-2">
              <Chip tone="neutral">ESTENDIDO</Chip>
              <Chip tone="primarySoft">ECMWF</Chip>
            </div>
          } />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {W.forecast.map((d, i) => (
              <div key={i} className={`card-tonal p-6 shadow-ambient-sm border-b-4 ${
                d.color==="error"?"border-error/60":d.color==="warning"?"border-orange-400/60":"border-secondary/40"
              }`}>
                <p className="text-[10px] font-bold text-slate-400 mb-3 tracking-mono uppercase">{d.day}</p>
                <Icon name={d.icon} filled className={`text-[36px] mb-3 ${d.color==="error"?"text-error":d.color==="warning"?"text-orange-500":"text-secondary"}`} />
                <div className="flex flex-col mb-3">
                  <span className="font-headline font-black text-3xl text-primary tracking-tighter">{d.high}°</span>
                  <span className="text-sm font-bold text-slate-400">{d.low}°</span>
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-mono-tight ${d.color==="error"?"text-error":d.color==="warning"?"text-orange-600":"text-secondary"}`}>{d.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly precipitation */}
        <div className="col-span-12 card-tonal p-8 shadow-ambient-sm">
          <SectionHeader
            overline="PREVISÃO SEMANAL"
            title="Precipitação"
            action={
              <div className="flex flex-wrap gap-2">
                <Chip tone="secondary" icon="water_drop">Baixa</Chip>
                <Chip tone="warning" icon="water_drop">Média</Chip>
                <Chip tone="error" icon="water_drop">Alta</Chip>
              </div>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {W.weeklyPrecipitation.map((d, i) => {
              const style = PRECIP_STYLES[d.level];
              return (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-5 flex flex-col items-center text-center gap-3 ${style.bg} ${style.border}`}
                >
                  <p className="text-[10px] font-bold tracking-mono uppercase text-on-surface-variant">
                    {d.day}
                  </p>
                  <div className="flex items-end justify-center gap-0.5 h-8">
                    {Array.from({ length: style.drops }).map((_, j) => (
                      <Icon
                        key={j}
                        name="water_drop"
                        filled
                        className={`text-[22px] ${style.text} ${j === 1 ? "scale-110" : j === 2 ? "scale-125" : ""}`}
                        style={{ marginBottom: j * 2 }}
                      />
                    ))}
                  </div>
                  <p className={`font-headline font-black text-3xl tracking-tighter ${style.text}`}>
                    {d.pct}%
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all`}
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-mono-tight ${style.text}`}>
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
