"use client";

import { useEffect, useState } from "react";
import { MapPlaceholder, ZoneFeedMap } from "@/app/components/MapPlaceholder";
import { Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { useAppNavigation } from "@/app/lib/useAppNavigation";

type Zone = (typeof GARDIAN_DATA.ZONES)[number];

function zoneDangerPct(zone: Zone) {
  return 100 - zone.stability;
}

function zoneEventRisks(zone: Zone): string[] {
  if (zone.status === "critico") {
    const risks = ["Deslizamento", "Alagamento"];
    if (zone.primarySensor.label.toLowerCase().includes("solo")) {
      risks.push("Saturação de solo");
    } else if (zone.primarySensor.label.toLowerCase().includes("hidr")) {
      risks.push("Transbordo");
    }
    return risks;
  }
  if (zone.status === "atencao") {
    return ["Alagamento", "Enxurrada", "Erosão leve"];
  }
  return ["Monitoramento padrão"];
}

function zoneDangerText(zone: Zone) {
  if (zone.status === "critico") return "text-error";
  if (zone.status === "atencao") return "text-orange-500";
  return "text-secondary";
}

function ZoneCameraFeed({ zone, alertMode }: { zone: Zone; alertMode: boolean }) {
  const { openZone } = useAppNavigation();
  const danger = zoneDangerPct(zone);
  const risks = zoneEventRisks(zone);
  const dangerText = zoneDangerText(zone);
  const shortName = zone.name.split(" - ").pop() ?? zone.name;
  const mapStatus = zone.status as "critico" | "atencao" | "estavel";

  return (
    <button
      type="button"
      onClick={() => openZone(zone.id)}
      className="group text-left rounded-xl overflow-hidden border border-outline-variant/30 bg-[#0a1628] hover:border-secondary/50 transition-all focus:outline-none focus:ring-2 focus:ring-secondary"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0a1628]">
        <ZoneFeedMap zoneId={zone.id} status={mapStatus} />
        {alertMode && zone.status === "critico" && (
          <div className="absolute inset-0 bg-error/10 animate-pulse pointer-events-none z-[1]" />
        )}

        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
          <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase text-white/90">
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-live-dot" />
            LIVE
          </span>
          <span className="text-[9px] font-mono text-white/50">CAM · {zone.id}</span>
        </div>

        <div className="absolute top-10 left-3 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-mono-tight bg-black/60 text-white/80 border border-white/15">
            Limite municipal
          </span>
        </div>

        <div className="absolute bottom-12 right-3 z-10 text-right pointer-events-none">
          <p className="text-[8px] font-mono uppercase text-white/50 tracking-mono">Perigo</p>
          <p className={`font-headline font-black text-2xl leading-none drop-shadow-md ${dangerText}`}>
            {danger}%
          </p>
        </div>

        {/* Faixa inferior */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2.5 bg-gradient-to-t from-black/85 to-transparent">
          <p className="text-[11px] font-bold text-white truncate">{shortName}</p>
          <p className="text-[9px] text-white/50 font-mono truncate">{zone.district}</p>
        </div>

        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
          }}
        />
      </div>

      <div className="px-3 py-3 bg-surface-container-low border-t border-outline-variant/20 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Chip tone={zone.status === "critico" ? "error" : zone.status === "atencao" ? "warning" : "secondary"}>
            {zone.statusLabel}
          </Chip>
          <span className="text-[10px] font-mono text-on-surface-variant">{zone.occurrences} ocorr.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {risks.map((risk) => (
            <span
              key={risk}
              className="text-[9px] font-bold uppercase tracking-mono-tight px-2 py-0.5 rounded bg-surface-container text-on-surface-variant"
            >
              {risk}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function MonitoringPage() {
  const { alertMode } = useGardian();
  const { KPIS, SENSORS_LIVE: SENSORS, WEATHER, ZONES } = GARDIAN_DATA;
  const INDICATOR_COUNT = 18;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5"><StatusDot tone="secondary" /><MetaTag className="text-secondary">STREAMING · {tick}</MetaTag></span>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Monitoramento</h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          label="Número de Indicadores"
          value={INDICATOR_COUNT}
          tone="secondary"
          icon="analytics"
          sub="Clima, território, meio ambiente e ocorrências"
        />
        <KPI
          label="Ocorrências Ativas"
          value={String(KPIS.ocorrenciasAtivas).padStart(2, "0")}
          tone="error"
          icon="emergency"
          sub="Em triagem, despacho ou acompanhamento"
        />
        <KPI
          label="Zonas em Alerta"
          value={String(KPIS.emAlerta).padStart(2, "0")}
          tone="warning"
          icon="terrain"
          sub={`Risco elevado · ${KPIS.zonasTotal} zonas no município`}
        />
        <KPI
          label="Alerta Climático"
          value={WEATHER.precipitation}
          unit="%"
          tone="warning"
          icon="thunderstorm"
          sub={`${WEATHER.condition} · ${WEATHER.rainfall_3h}mm nas últimas 3h`}
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MapPlaceholder variant="dark" height={520} alertMode={alertMode} />
        </div>

        <div className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="STREAM AO VIVO" title="Indicadores [dados de ia]" action={
            <Chip tone="secondary" icon="sync"><span className="animate-live-dot inline-block w-1.5 h-1.5 rounded-full bg-secondary mr-1" /> ATIVO</Chip>
          } />
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
            {SENSORS.map(s => {
              const tone = s.status === "critical" ? "error" : s.status === "warning" ? "warning" : "secondary";
              const dot = s.status === "critical" ? "bg-error" : s.status === "warning" ? "bg-orange-500" : "bg-secondary";
              return (
                <div key={s.id} className="bg-surface-container-low rounded-lg p-4 flex items-center gap-3 hover:bg-surface-container transition-all">
                  <span className={`w-2 h-2 rounded-full ${dot} animate-live-dot`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono font-black text-primary">#{s.id}</span>
                      <span className="text-[10px] text-on-surface-variant truncate">· {s.zone}</span>
                    </div>
                    <p className="text-[11px] font-bold text-on-surface-variant">{s.type}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-headline font-black text-base ${s.status==="critical"?"text-error":s.status==="warning"?"text-orange-600":"text-secondary"}`}>{s.value}</p>
                    <span className="text-[9px] font-mono uppercase tracking-mono-tight text-slate-400">há {s.lastSeen}</span>
                  </div>
                  <Icon name={s.trend==="up"?"trending_up":s.trend==="down"?"trending_down":"trending_flat"} className={`text-[18px] ${s.status==="critical"?"text-error":s.status==="warning"?"text-orange-500":"text-secondary"}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-5">
        <SectionHeader
          overline="VIGILÂNCIA TERRITORIAL"
          title="Mapas por Zona"
          
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {ZONES.map((zone) => (
            <ZoneCameraFeed key={zone.id} zone={zone} alertMode={alertMode} />
          ))}
        </div>
      </section>
    </div>
  );
}
