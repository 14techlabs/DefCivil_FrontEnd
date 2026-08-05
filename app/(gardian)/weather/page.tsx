"use client";

import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Bar, type BarTone, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { MOCK_METEO_ORGAOS, MOCK_PLUVIOMETROS, zonaNome } from "@/app/data/mock";

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

/* média / extremos dos pluviômetros — o dado "real" é o acumulado de chuva */
const REAL_MEDIO =
  MOCK_PLUVIOMETROS.reduce((a, p) => a + p.mm24h, 0) / MOCK_PLUVIOMETROS.length;
const REAL_MAX = Math.max(...MOCK_PLUVIOMETROS.map((p) => p.mm24h));
const REAL_MIN = Math.min(...MOCK_PLUVIOMETROS.map((p) => p.mm24h));

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

      {/* ── Fontes oficiais: INMET · CPTEC · CEMADEN ── */}
      <section className="card-tonal p-8 shadow-ambient-sm">
        <SectionHeader
          overline="FONTES OFICIAIS · PRÓXIMAS 24H"
          title="INMET · CPTEC · CEMADEN"
          action={
            <Chip tone="primarySoft" icon="hub">
              3 ÓRGÃOS COMPARADOS
            </Chip>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {MOCK_METEO_ORGAOS.map((o) => (
            <div key={o.id} className="card-recessed p-6">
              {/* identificação da fonte */}
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-headline font-black text-xl text-primary tracking-tighter">
                  {o.nome}
                </h3>
                <MetaTag>{o.atualizado}</MetaTag>
              </div>
              <p className="text-[10px] text-on-surface-variant mb-5">{o.fonte}</p>

              {/* previsão */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-white mb-4">
                <div className="w-11 h-11 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon name={o.icone} filled className="text-secondary text-[24px]" />
                </div>
                <div className="min-w-0">
                  <MetaTag className="block">PREVISÃO</MetaTag>
                  <p className="text-[13px] font-black text-primary leading-tight">{o.previsao}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {o.tempMin}° a {o.tempMax}°C
                  </p>
                </div>
              </div>

              {/* chance de chuva */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <MetaTag>CHANCE DE CHUVA</MetaTag>
                  <span className="text-[13px] font-black text-primary">{o.chanceChuva}%</span>
                </div>
                <Bar
                  value={o.chanceChuva}
                  tone={o.chanceChuva >= 80 ? "error" : o.chanceChuva >= 50 ? "warning" : "secondary"}
                />
              </div>

              {/* precipitação · umidade · vento */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="rainy" className="text-error text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {o.precipitacao}
                  </p>
                  <MetaTag className="block">MM PRECIP.</MetaTag>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="humidity_mid" className="text-secondary text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {o.umidade}%
                  </p>
                  <MetaTag className="block">UMIDADE</MetaTag>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="air" className="text-orange-500 text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {o.vento}
                  </p>
                  <MetaTag className="block">KM/H {o.ventoDir}</MetaTag>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* chuva acumulada real medida em campo */}
        <div className="mt-5 rounded-xl p-6 bg-gradient-to-br from-primary to-primary-container text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-4 opacity-[0.07]">
            <Icon name="rainy" filled className="text-[160px]" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="text-[10px] font-mono tracking-mono uppercase font-bold text-white/60">
                CHUVA ACUMULADA REAL · MÉDIA DE {MOCK_PLUVIOMETROS.length} SENSORES
              </span>
              <p className="text-[10px] text-white/60 mb-3">
                Único dado medido em campo — pluviômetros do CEMADEN
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline font-black text-5xl tracking-tighter">
                  {REAL_MEDIO.toFixed(1).replace(".", ",")}
                </span>
                <span className="text-sm font-bold text-white/50">mm/24h</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-2 rounded-lg bg-white/15 text-[10px] font-bold uppercase tracking-mono-tight">
                MÁX {REAL_MAX.toFixed(1).replace(".", ",")}mm
              </span>
              <span className="px-3 py-2 rounded-lg bg-white/15 text-[10px] font-bold uppercase tracking-mono-tight">
                MÍN {REAL_MIN.toFixed(1).replace(".", ",")}mm
              </span>
              {MOCK_METEO_ORGAOS.map((o) => {
                const desvio = o.precipitacao - REAL_MEDIO;
                return (
                  <span
                    key={o.id}
                    className="px-3 py-2 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-mono-tight"
                  >
                    {o.nome}: {desvio > 0 ? "+" : ""}
                    {desvio.toFixed(1).replace(".", ",")}mm
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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

      {/* ── Pluviômetros CEMADEN (dados reais coletados) ── */}
      <section className="card-tonal p-8 shadow-ambient-sm">
        <SectionHeader
          overline="PAINEL INTERATIVO DO CEMADEN · COLETA AUTOMÁTICA"
          title="Pluviômetros em Campo"
          action={<Chip tone="secondary" icon="sensors">{MOCK_PLUVIOMETROS.length} ESTAÇÕES</Chip>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-3 pr-4"><MetaTag>ESTAÇÃO</MetaTag></th>
                <th className="py-3 pr-4"><MetaTag>ZONA</MetaTag></th>
                <th className="py-3 pr-4 text-right"><MetaTag>1H</MetaTag></th>
                <th className="py-3 pr-4 text-right"><MetaTag>6H</MetaTag></th>
                <th className="py-3 pr-4 text-right"><MetaTag>12H</MetaTag></th>
                <th className="py-3 pr-4 text-right"><MetaTag>24H</MetaTag></th>
                <th className="py-3 pr-4"><MetaTag>LEITURA</MetaTag></th>
                <th className="py-3"><MetaTag>STATUS</MetaTag></th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PLUVIOMETROS.map((p) => (
                <tr key={p.codigo} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                  <td className="py-3.5 pr-4">
                    <p className="text-[13px] font-bold text-primary">{p.nome}</p>
                    <p className="text-[10px] font-mono font-bold text-slate-400">{p.codigo}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{zonaNome(p.zona)}</td>
                  <td className="py-3.5 pr-4 text-[12px] font-mono font-bold text-on-surface text-right">{p.mm1h.toFixed(1)}</td>
                  <td className="py-3.5 pr-4 text-[12px] font-mono font-bold text-on-surface text-right">{p.mm6h.toFixed(1)}</td>
                  <td className="py-3.5 pr-4 text-[12px] font-mono font-black text-primary text-right">{p.mm12h.toFixed(1)}</td>
                  <td className="py-3.5 pr-4 text-[12px] font-mono font-black text-primary text-right">{p.mm24h.toFixed(1)}</td>
                  <td className="py-3.5 pr-4 text-[11px] font-mono font-bold text-slate-400">{p.ultimaLeitura}</td>
                  <td className="py-3.5">
                    <Chip tone={p.status === "critico" ? "error" : p.status === "atencao" ? "warning" : "secondary"}>
                      {p.status === "critico" ? "Crítico" : p.status === "atencao" ? "Atenção" : "Normal"}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-5 flex items-center gap-1.5">
          <Icon name="info" className="text-[14px]" />
          Valores em milímetros acumulados, coletados do painel interativo do CEMADEN.
        </p>
      </section>
    </div>
  );
}
