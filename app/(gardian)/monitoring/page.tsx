"use client";

import { useEffect, useState } from "react";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";

export default function MonitoringPage() {
  const { alertMode } = useGardian();
  const SENSORS = GARDIAN_DATA.SENSORS_LIVE;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">TELEMETRIA AO VIVO · LORAWAN</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5"><StatusDot tone="secondary" /><MetaTag className="text-secondary">STREAMING · {tick}</MetaTag></span>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Monitoramento</h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI label="Sensores Online" value="892" tone="secondary" icon="sensors" sub="0 falhas detectadas" />
        <KPI label="Pacotes /min" value="12.4k" tone="primary" icon="cell_tower" sub="Latência méd. 12ms" />
        <KPI label="Sensores Críticos" value="04" tone="error" icon="warning" sub="Acima do threshold" />
        <KPI label="Cobertura" value="99.8%" tone="secondary" icon="public" sub="42 zonas mapeadas" />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MapPlaceholder variant="dark" height={520} alertMode={alertMode} />
        </div>

        <div className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="STREAM AO VIVO" title="Sensores em Campo" action={
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
    </div>
  );
}
