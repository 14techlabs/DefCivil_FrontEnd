"use client";

import { useEffect, useState } from "react";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import {
  Bar,
  type BarTone,
  Btn,
  Chip,
  type ChipTone,
  Icon,
  KPI,
  MetaTag,
  SectionHeader,
  StatusDot,
} from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { useAppNavigation } from "@/app/lib/useAppNavigation";

export default function DashboardPage() {
  const { alertMode } = useGardian();
  const { go } = useAppNavigation();
  const { KPIS, ZONES, OCCURRENCES } = GARDIAN_DATA;

  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>Painel Geral · Porto Seguro - Bahia</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5">
            <StatusDot tone={alertMode ? "error" : "secondary"} />
            <MetaTag className={alertMode ? "text-error" : "text-secondary"}>{alertMode ? "Estado de Alerta" : "Operacional"}</MetaTag>
          </span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Centro de Comando</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xl">Visão consolidada da operação · Última varredura há 2 minutos · 892 sensores transmitindo</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" icon="play_circle" onClick={() => go("monitoring")}>Modo Comando</Btn>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI label="Total de Zonas" value={KPIS.zonasTotal} icon="hub" tone="secondary" sub="32 urbanas · 10 rurais" />
        <KPI label="Em Alerta" value={alertMode ? KPIS.emAlerta : 3} icon="warning" tone={alertMode ? "error" : "warning"} sub={`${alertMode?2:1} críticas · ${alertMode?3:2} atenção`} />
        <KPI label="Sensores Ativos" value={KPIS.sensoresAtivos} icon="sensors" tone="secondary" sub="LoRaWAN · AES-256" />
        <KPI label="Acurácia IA" value={`${KPIS.acuraciaIA}%`} icon="psychology" tone="primary" sub="Janela 90 dias · 1,247 eventos" />
      </div>

      {/* Hero IA + Critical indicators */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 bg-gradient-to-br from-primary to-primary-container rounded-xl p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-[0.04]">
            <Icon name="psychology" filled className="text-[400px]" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <Chip tone="secondary" className="!bg-secondary/20 !text-secondary-container">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" /> IA PREDITIVA ATIVA
            </Chip>
            <h2 className="font-headline font-black text-4xl tracking-tighter mt-5 leading-tight">
              Alto risco de deslizamento em<br/>
              <span className="text-secondary-container">Porto Seguro - Bahia - Zona Sul</span>
            </h2>
            <p className="text-white/70 text-sm mt-4 leading-relaxed max-w-xl">
              Padrões de saturação de solo detectados via sensores IoT cruzados com previsão de 45mm/h.
              Recomendação: Evacuação preventiva imediata no Setor 7.
            </p>
            <div className="flex items-center gap-6 mt-6 text-[10px] font-mono uppercase tracking-mono font-bold text-white/50">
              <span>CONFIANÇA: <strong className="text-secondary-container">94.2%</strong></span>
              <span>JANELA: <strong className="text-white/80">PRÓX. 3H</strong></span>
              <span>FONTES: <strong className="text-white/80">CPTEC + IoT + ADAPTABRASIL</strong></span>
            </div>
            <div className="flex gap-3 mt-8">
              <Btn variant="success" icon="groups" iconRight="arrow_forward">Mobilizar Equipes</Btn>
              <button onClick={() => go("zones")} className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/10 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-mono-tight hover:bg-white/20 transition-all">
                Ver Detalhes do Alerta <Icon name="arrow_forward" className="text-[16px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Critical Indicators Sidebar */}
        <div className="col-span-12 lg:col-span-4 card-tonal p-7 shadow-ambient-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <MetaTag className="block mb-1">Indicadores</MetaTag>
              <h3 className="font-headline font-black text-xl text-primary tracking-tight">Críticos</h3>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-secondary">QUERY_STATS</span>
          </div>
          <div className="space-y-5">
            {[
              { l: "Saturação do Solo", v: "88%", n: 88, t: "error" },
              { l: "Pressão Atmosférica", v: "984 hPa", n: 35, t: "warning" },
              { l: "Nível do Reservatório", v: "42%", n: 42, t: "warning" },
              { l: "Velocidade do Vento", v: "22 km/h", n: 30, t: "secondary" },
            ].map((it, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-on-surface-variant">{it.l}</span>
                  <span className={`text-sm font-headline font-black ${it.t==="error"?"text-error":it.t==="warning"?"text-orange-600":"text-secondary"}`}>{it.v}</span>
                </div>
                <Bar value={it.n} tone={it.t as BarTone} />
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-outline-variant/30 flex items-center justify-between">
            <MetaTag>Última Atualização</MetaTag>
            <span className="text-[10px] font-mono font-bold text-secondary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-live-dot" /> 14:32:01 SYNC LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Source Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { tag: "CPTEC · CHUVAS", icon: "rainy", color: "bg-blue-100 text-blue-700", value: "28.4", unit: "mm", note: "Acumulado nas últimas 3 horas. Tendência de alta acentuada." },
          { tag: "CPTEC · VENTO", icon: "air", color: "bg-slate-100 text-slate-600", value: "22", unit: "km/h", note: "Rajadas vindas do SE. Condições estáveis para aeronaves." },
          { tag: "ADAPTABRASIL · SOLO", icon: "landscape", color: "bg-error-container text-on-error-container", value: "R3", unit: "Crítico", note: "Instabilidade geológica em encostas com declividade > 45°." },
          { tag: "GOES-16 · UMIDADE", icon: "humidity_percentage", color: "bg-cyan-100 text-cyan-700", value: "92", unit: "%", note: "Umidade relativa em ponto de orvalho. Visibilidade reduzida." },
        ].map((c, i) => (
          <div key={i} className="card-tonal p-6 shadow-ambient-sm">
            <div className="flex items-center justify-between mb-5">
              <Chip className={`!normal-case !tracking-normal !text-[10px] ${c.color}`}>{c.tag}</Chip>
              <Icon name={c.icon} filled className="text-on-surface-variant text-[20px]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline font-black text-4xl text-primary tracking-tighter">{c.value}</span>
              <span className="text-xs font-bold text-slate-400">{c.unit}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">{c.note}</p>
          </div>
        ))}
      </div>

      {/* Map + Impact signals */}
      <div className="grid grid-cols-12 gap-5 items-stretch">
        <div className="col-span-12 lg:col-span-8 min-h-0">
          <div className="card-tonal p-2 shadow-ambient-sm h-full">
            <MapPlaceholder variant="topo" height={420} alertMode={false} />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 card-tonal p-7 shadow-ambient-sm flex flex-col min-h-0 h-full lg:max-h-[436px]">
          <SectionHeader
            overline="EM CAMPO"
            title="Sinalizadores de Impacto"
            className="shrink-0 !mb-4"
          />
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
            {[
              { icon: "warning", iconColor: "text-orange-700", iconBg: "bg-orange-100", label: "BLOQUEIO DE VIAS", sub: "Percentual estimado de vias afetadas no município", status: "40%", statusTone: "warning" },
              { icon: "cell_tower", iconColor: "text-violet-700", iconBg: "bg-violet-100", label: "SINAL DE TELEFONIA", sub: "Tempo agressivo · qualidade de cobertura irregular", status: "MÉDIO", statusTone: "warning" },
              { icon: "waves", iconColor: "text-cyan-700", iconBg: "bg-cyan-100", label: "VOLUME DO MAR", sub: "Maré e ressaca acima do patamar habitual", status: "ALTO", statusTone: "error" },
              { icon: "flight", iconColor: "text-indigo-700", iconBg: "bg-indigo-100", label: "AEROPORTO", sub: "Operações com restrições por condição meteorológica", status: "ATENÇÃO", statusTone: "warning" },
              { icon: "thunderstorm", iconColor: "text-amber-700", iconBg: "bg-amber-100", label: "SITUAÇÃO DO CLIMA", sub: "Chuva intensa, vento e visibilidade reduzida", status: "ADVERSO", statusTone: "warning" },
              { icon: "bolt", iconColor: "text-rose-700", iconBg: "bg-rose-100", label: "REDE ELÉTRICA", sub: "Tempo agressivo · qualidade de cobertura irregular", status: "MÉDIO", statusTone: "warning" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-all">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${s.iconBg}`}>
                  <Icon name={s.icon} filled className={`text-[18px] ${s.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-mono-tight text-primary">{s.label}</p>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2">{s.sub}</p>
                </div>
                <Chip tone={s.statusTone as ChipTone} className="shrink-0">{s.status}</Chip>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer rail */}
      {/* <div className="card-tonal p-7 shadow-ambient-sm flex items-center justify-between gap-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-live-dot" />
            <MetaTag>STATUS · REDE LORAWAN OPERACIONAL</MetaTag>
          </div>
          <h4 className="font-headline font-black text-2xl text-primary">Núcleo Operacional Saudável</h4>
          <p className="text-xs text-on-surface-variant mt-1">Último pacote há 42s · Criptografia AES-256 · 0 falhas nas últimas 24h</p>
        </div>
        <div className="flex gap-12">
          {[
            { l: "Latência", v: "12ms" },
            { l: "Bateria Méd.", v: "94%" },
            { l: "Sinal Méd.", v: "-82dBm" },
            { l: "Uptime", v: "99.98%" },
          ].map(s => (
            <div key={s.l} className="text-center">
              <MetaTag className="block mb-1">{s.l}</MetaTag>
              <p className="font-headline font-black text-2xl text-secondary">{s.v}</p>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}
