"use client";

import { useEffect, useState } from "react";
import { DataLoading } from "@/app/components/DataLoading";
import { Bar, type BarTone, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import type { PrecipLevel, WeatherPainel } from "@/app/types/meteorologia";

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

/**
 * Formata milímetros, distinguindo ZERO de AUSENTE.
 *
 * O backend passou a devolver null quando não há sensor ou a fonte está
 * fora do ar. Exibir "0,0 mm" nesse caso levaria a concluir que não choveu,
 * quando na verdade não houve medição — diferença que decide se uma equipe
 * é despachada.
 */
function fmtMm(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(1).replace(".", ",");
}

/** Número simples, com o mesmo cuidado: "—" quando não medido. */
function fmtNum(v: number | null | undefined, sufixo = "") {
  if (v == null) return "—";
  return `${v}${sufixo}`;
}

export default function WeatherPage() {
  const { alertMode } = useGardian();
  const [painel, setPainel] = useState<WeatherPainel | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    api
      .get<WeatherPainel>("/metereologia/painel/")
      .then((res) => {
        if (ativo) {
          setPainel(res.data);
          setErro(null);
        }
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível carregar os dados meteorológicos.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (loading) {
    return <DataLoading />;
  }

  if (erro || !painel) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <p className="text-error text-sm">{erro ?? "Dados indisponíveis."}</p>
      </div>
    );
  }

  const W = painel.condicoesAtuais;
  const { chuvaReal, orgaos, pluviometros } = painel;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">METEOROLOGIA · CPTEC + GOES-16</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>ATUALIZADO ÀS {painel.atualizadoEm}</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Vigilância Meteorológica</h1>
        {painel.avisos && painel.avisos.length > 0 && (
          <div className="mt-3 space-y-1">
            {painel.avisos.map((aviso, i) => (
              <p key={i} className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                <Icon name="info" className="text-[14px]" />
                {aviso}
              </p>
            ))}
          </div>
        )}
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
          {orgaos.map((o) => (
            <div key={o.id} className="card-recessed p-6">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-headline font-black text-xl text-primary tracking-tighter">
                  {o.nome}
                </h3>
                <MetaTag>{o.atualizado}</MetaTag>
              </div>
              <p className="text-[10px] text-on-surface-variant mb-5">{o.fonte}</p>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-white mb-4">
                <div className="w-11 h-11 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon name={o.icone} filled className="text-secondary text-[24px]" />
                </div>
                <div className="min-w-0">
                  <MetaTag className="block">
                    {o.id === "cemaden" ? "OBSERVADO" : "PREVISÃO"}
                  </MetaTag>
                  <p className="text-[13px] font-black text-primary leading-tight">{o.previsao}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {o.tempMin != null && o.tempMax != null
                      ? `${o.tempMin}° a ${o.tempMax}°C`
                      : "Temperatura não informada"}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <MetaTag>{o.id === "cemaden" ? "INTENSIDADE 24H" : "CHANCE DE CHUVA"}</MetaTag>
                  <span className="text-[13px] font-black text-primary">
                    {fmtNum(o.chanceChuva, "%")}
                  </span>
                </div>
                <Bar
                  value={o.chanceChuva ?? 0}
                  tone={
                    (o.chanceChuva ?? 0) >= 80
                      ? "error"
                      : (o.chanceChuva ?? 0) >= 50
                        ? "warning"
                        : "secondary"
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="rainy" className="text-error text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {fmtNum(o.precipitacao)}
                  </p>
                  <MetaTag className="block">MM {o.id === "cemaden" ? "MED." : "PRECIP."}</MetaTag>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="humidity_mid" className="text-secondary text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {fmtNum(o.umidade, "%")}
                  </p>
                  <MetaTag className="block">UMIDADE</MetaTag>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <Icon name="air" className="text-orange-500 text-[18px]" />
                  <p className="font-headline font-black text-lg text-primary tracking-tighter mt-1">
                    {fmtNum(o.vento)}
                  </p>
                  <MetaTag className="block">KM/H {o.ventoDir ?? "—"}</MetaTag>
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
                {chuvaReal.temMedicao
                  ? `CHUVA ACUMULADA REAL · MÉDIA DE ${chuvaReal.totalSensores} SENSORES`
                  : "CHUVA ACUMULADA REAL · SEM SENSOR DISPONÍVEL"}
              </span>
              <p className="text-[10px] text-white/60 mb-3">
                {chuvaReal.temMedicao
                  ? "Único dado medido em campo — pluviômetros do CEMADEN"
                  : "Nenhum pluviômetro do CEMADEN respondeu — não há medição de campo"}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-headline font-black text-5xl tracking-tighter">
                  {fmtMm(chuvaReal.media)}
                </span>
                <span className="text-sm font-bold text-white/50">
                  {chuvaReal.temMedicao ? "mm/24h" : "sem medição"}
                </span>
              </div>
            </div>

            {/* Sem sensor não há máximo, mínimo nem desvio a comparar. */}
            <div className="flex flex-wrap gap-2">
              {chuvaReal.temMedicao && (
                <>
                  <span className="px-3 py-2 rounded-lg bg-white/15 text-[10px] font-bold uppercase tracking-mono-tight">
                    MÁX {fmtMm(chuvaReal.max)}mm
                  </span>
                  <span className="px-3 py-2 rounded-lg bg-white/15 text-[10px] font-bold uppercase tracking-mono-tight">
                    MÍN {fmtMm(chuvaReal.min)}mm
                  </span>
                </>
              )}
              {chuvaReal.desvios.map((d) => (
                <span
                  key={d.nome}
                  className="px-3 py-2 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-mono-tight"
                >
                  {d.nome}: {d.desvio > 0 ? "+" : ""}
                  {fmtMm(d.desvio)}mm
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5  grid-cols-12">

        {/* Hero */}
        <div className="col-span-12  flex flex-col gap-5">
          <div className="card-tonal p-8 shadow-ambient-sm relative overflow-hidden">
            <div className="absolute top-4 right-4 opacity-[0.06]">
              <Icon name="thunderstorm" filled className="text-[160px]" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 text-secondary font-bold text-[10px] tracking-mono uppercase mb-2">
                <Icon name="location_on" className="text-[14px]" /> {W.location}
              </div>
              <h2 className="font-headline font-black text-5xl text-primary tracking-tighter mb-1">{W.condition}</h2>
              <p className="text-xs text-slate-400 mb-8">
                Atualizado às {W.updatedAt} · Satélite {painel.satellite}
              </p>
              <div className="flex items-baseline gap-3">
                <span className="font-headline font-black text-8xl text-primary tracking-tighter">
                  {W.temp != null ? `${W.temp}°` : "—"}
                </span>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-slate-300">C</span>
                  {W.critical && <Chip tone="error">CRÍTICO</Chip>}
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry grid */}
          <div className="grid grid-cols-2 gap-4 ">
            {painel.telemetria.map((it, i) => (
              <div key={i} className="card-recessed p-5">
                <div className="flex items-center justify-between mb-4">
                  <MetaTag>{it.label}</MetaTag>
                  <Icon
                    name={it.icon}
                    className={`text-[18px] ${it.tone === "error"
                      ? "text-error"
                      : it.tone === "warning"
                        ? "text-orange-500"
                        : "text-secondary"
                      }`}
                  />
                </div>
                <p className="font-headline font-black text-2xl text-primary tracking-tighter">{it.value}</p>
                {it.bar !== undefined && (
                  <Bar value={it.bar} tone={it.tone as BarTone} className="mt-3" />
                )}
                {it.sub && (
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-mono-tight mt-2">
                    {it.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>



        {/* 5 day forecast */}
        <div className="col-span-12 card-recessed p-8">
          <SectionHeader
            overline="MODELO CPTEC"
            title="Previsão 5 Dias"
            action={
              <div className="flex gap-2">
                <Chip tone="neutral">ESTENDIDO</Chip>
                <Chip tone="primarySoft">CPTEC/INPE</Chip>
              </div>
            }
          />
          {painel.previsao5Dias.length === 0 && (
            /* Sem isso a seção simplesmente sumia, e ninguém entendia por quê. */
            <div className="rounded-xl bg-surface-container-low p-8 text-center">
              <Icon name="cloud_off" className="mb-2 text-[32px] text-on-surface-variant" />
              <p className="text-[13px] font-bold text-primary">
                Previsão indisponível no momento
              </p>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                O CPTEC/INPE não respondeu. Os dados medidos em campo continuam
                sendo exibidos acima.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {painel.previsao5Dias.map((d, i) => (
              <div
                key={i}
                className={`card-tonal p-6 shadow-ambient-sm border-b-4 ${d.color === "error"
                  ? "border-error/60"
                  : d.color === "warning"
                    ? "border-orange-400/60"
                    : "border-secondary/40"
                  }`}
              >
                <p className="text-[10px] font-bold text-slate-400 mb-3 tracking-mono uppercase">{d.day}</p>
                <Icon
                  name={d.icon}
                  filled
                  className={`text-[36px] mb-3 ${d.color === "error"
                    ? "text-error"
                    : d.color === "warning"
                      ? "text-orange-500"
                      : "text-secondary"
                    }`}
                />
                <div className="flex flex-col mb-3">
                  <span className="font-headline font-black text-3xl text-primary tracking-tighter">
                    {d.high != null ? `${d.high}°` : "—"}
                  </span>
                  <span className="text-sm font-bold text-slate-400">
                    {d.low != null ? `${d.low}°` : "—"}
                  </span>
                </div>
                <p
                  className={`text-[10px] font-bold uppercase tracking-mono-tight ${d.color === "error"
                    ? "text-error"
                    : d.color === "warning"
                      ? "text-orange-600"
                      : "text-secondary"
                    }`}
                >
                  {d.label}
                </p>
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
                <Chip tone="secondary" icon="water_drop">
                  Baixa
                </Chip>
                <Chip tone="warning" icon="water_drop">
                  Média
                </Chip>
                <Chip tone="error" icon="water_drop">
                  Alta
                </Chip>
              </div>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {painel.precipitacaoSemanal.map((d, i) => {
              const style = PRECIP_STYLES[d.level];
              return (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-5 flex flex-col items-center text-center gap-3 ${style.bg} ${style.border}`}
                >
                  <p className="text-[10px] font-bold tracking-mono uppercase text-on-surface-variant">{d.day}</p>
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
                  <p className={`font-headline font-black text-3xl tracking-tighter ${style.text}`}>{d.pct}%</p>
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

      {/* ── Pluviômetros CEMADEN ── */}
      <section className="card-tonal p-8 shadow-ambient-sm">
        <SectionHeader
          overline="PAINEL PED DO CEMADEN · COLETA AUTOMÁTICA"
          title="Pluviômetros em Campo"
          action={
            <Chip tone="secondary" icon="sensors">
              {pluviometros.length} ESTAÇÕES
            </Chip>
          }
        />
        {pluviometros.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">
            Nenhum pluviômetro disponível para este município. Verifique o token CEMADEN_PED_TOKEN no backend.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-3 pr-4">
                    <MetaTag>ESTAÇÃO</MetaTag>
                  </th>
                  <th className="py-3 pr-4 text-right">
                    <MetaTag>1H</MetaTag>
                  </th>
                  <th className="py-3 pr-4 text-right">
                    <MetaTag>6H</MetaTag>
                  </th>
                  <th className="py-3 pr-4 text-right">
                    <MetaTag>12H</MetaTag>
                  </th>
                  <th className="py-3 pr-4 text-right">
                    <MetaTag>24H</MetaTag>
                  </th>
                  <th className="py-3 pr-4">
                    <MetaTag>LEITURA</MetaTag>
                  </th>
                  <th className="py-3">
                    <MetaTag>STATUS</MetaTag>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pluviometros.map((p) => (
                  <tr
                    key={p.codigo}
                    className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors"
                  >
                    <td className="py-3.5 pr-4">
                      <p className="text-[13px] font-bold text-primary">{p.nome}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400">{p.codigo}</p>
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] font-mono font-bold text-on-surface text-right">
                      {p.mm1h.toFixed(1)}
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] font-mono font-bold text-on-surface text-right">
                      {p.mm6h.toFixed(1)}
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] font-mono font-black text-primary text-right">
                      {p.mm12h.toFixed(1)}
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] font-mono font-black text-primary text-right">
                      {p.mm24h.toFixed(1)}
                    </td>
                    <td className="py-3.5 pr-4 text-[11px] font-mono font-bold text-slate-400">{p.ultimaLeitura}</td>
                    <td className="py-3.5">
                      <Chip
                        tone={p.status === "critico" ? "error" : p.status === "atencao" ? "warning" : "secondary"}
                      >
                        {p.status === "critico" ? "Crítico" : p.status === "atencao" ? "Atenção" : "Normal"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-on-surface-variant mt-5 flex items-center gap-1.5">
          <Icon name="info" className="text-[14px]" />
          Valores em milímetros acumulados, via API PED do CEMADEN.
        </p>
      </section>
    </div>
  );
}
