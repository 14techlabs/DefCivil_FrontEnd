"use client";

import { Icon } from "./Primitives";
import {
  getMonitoringZoneRing,
  type ZoneRing,
} from "@/app/data/monitoringZones";
import {
  PORTO_SEGURO_BBOX,
  PORTO_SEGURO_BOUNDARY,
} from "@/app/data/portoSeguroBoundary";

const CENTER = { lat: -16.4497, lon: -39.0647 };

type Bbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function lonLatToPercent(lon: number, lat: number, bbox: Bbox) {
  const x = ((lon - bbox.west) / (bbox.east - bbox.west)) * 100;
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * 100;
  return { x, y };
}

function ringToSvgPoints(ring: ZoneRing, bbox: Bbox) {
  return ring
    .map(([lon, lat]) => {
      const { x, y } = lonLatToPercent(lon, lat, bbox);
      return `${x},${y}`;
    })
    .join(" ");
}

function ringCentroid(ring: ZoneRing) {
  const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return { lon, lat };
}

const osmEmbedSrc = (bbox: Bbox, marker?: { lat: number; lon: number }) => {
  const { west, south, east, north } = bbox;
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    layer: "mapnik",
  });
  if (marker) {
    params.set("marker", `${marker.lat},${marker.lon}`);
  }
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
};

function ringBbox(ring: ZoneRing, padding = 0.02): Bbox {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    west: Math.min(...lons) - padding,
    east: Math.max(...lons) + padding,
    south: Math.min(...lats) - padding,
    north: Math.max(...lats) + padding,
  };
}

type MonitoringZone = {
  id: string;
  label: string;
  status: "critico" | "atencao" | "estavel";
  ring: ZoneRing;
};

/** Zonas exibidas no mapa principal — status alinhado ao mock em gardian.ts */
const MONITORING_ZONES: MonitoringZone[] = [
  { id: "PT-ZS-01", label: "Zona Sul", status: "critico", ring: getMonitoringZoneRing("PT-ZS-01")!.ring },
  { id: "PT-ZN-02", label: "Vila Esperança", status: "critico", ring: getMonitoringZoneRing("PT-ZN-02")!.ring },
  { id: "PT-MR-04", label: "Morro Esperança", status: "critico", ring: getMonitoringZoneRing("PT-MR-04")!.ring },
  { id: "PT-VA-03", label: "Vale das Acácias", status: "atencao", ring: getMonitoringZoneRing("PT-VA-03")!.ring },
  { id: "PT-CI-05", label: "Centro Industrial", status: "estavel", ring: getMonitoringZoneRing("PT-CI-05")!.ring },
  { id: "PT-RR-06", label: "Rural Norte", status: "estavel", ring: getMonitoringZoneRing("PT-RR-06")!.ring },
];

const fills: Record<
  "critico" | "atencao" | "estavel",
  { fill: string; stroke: string }
> = {
  critico: { fill: "rgba(186,26,26,0.42)", stroke: "#BA1A1A" },
  atencao: { fill: "rgba(194,87,11,0.40)", stroke: "#C2570B" },
  estavel: { fill: "rgba(0,106,96,0.30)", stroke: "#006A60" },
};

/** Mapa em miniatura para feed de vigilância por zona (CCTV). */
export function ZoneFeedMap({
  zoneId,
  status,
}: {
  zoneId: string;
  status: "critico" | "atencao" | "estavel";
}) {
  const zoneData = getMonitoringZoneRing(zoneId);
  if (!zoneData) {
    return (
      <div className="absolute inset-0 bg-surface-container-low flex items-center justify-center">
        <Icon name="map" className="text-on-surface-variant text-[32px]" />
      </div>
    );
  }

  const bbox = ringBbox(zoneData.ring, 0.03);
  const { lon, lat } = ringCentroid(zoneData.ring);
  const f = fills[status];
  const boundaryPoints = ringToSvgPoints(PORTO_SEGURO_BOUNDARY, bbox);
  const zonePoints = ringToSvgPoints(zoneData.ring, bbox);

  return (
    <>
      <iframe
        title={`Mapa · ${zoneData.label}`}
        className="absolute inset-0 w-full h-full border-0 block pointer-events-none"
        src={osmEmbedSrc(bbox, { lat, lon })}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,17,37,0.35) 0%, rgba(10,26,51,0.25) 50%, rgba(5,17,37,0.55) 100%)",
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points={boundaryPoints}
          fill="rgba(0,106,96,0.06)"
          stroke="#006A60"
          strokeWidth="0.4"
          strokeDasharray="1.2 0.8"
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={zonePoints}
          fill={f.fill}
          stroke={f.stroke}
          strokeWidth="0.55"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 6px ${f.stroke}88)` }}
        />
      </svg>
    </>
  );
}

// Mapa OpenStreetMap com demarcação do município de Porto Seguro-BA.
export function MapPlaceholder({
  variant = "topo",
  height = 500,
  selectedZone,
  onSelectZone,
  showZones = true,
  alertMode = false,
}: {
  variant?: "topo" | "dark" | "radar";
  height?: number;
  selectedZone?: string;
  onSelectZone?: (id: string) => void;
  showZones?: boolean;
  alertMode?: boolean;
}) {
  const bbox: Bbox = PORTO_SEGURO_BBOX;
  const isDark = variant === "dark" || variant === "radar";
  const boundaryPoints = ringToSvgPoints(PORTO_SEGURO_BOUNDARY, bbox);
  alertMode = false;
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-surface-container-low"
      style={{ minHeight: height }}
    >
      <iframe
        title="Mapa de Porto Seguro, Bahia"
        className="absolute inset-0 w-full h-full border-0 block"
        src={osmEmbedSrc(bbox, CENTER)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      {/* Variantes escuras / radar: filtro sobre o mapa base */}
      {variant === "dark" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(0,106,96,0.12) 0%, transparent 50%), linear-gradient(135deg, rgba(5,17,37,0.55) 0%, rgba(10,26,51,0.65) 100%)",
          }}
        />
      )}
      {variant === "radar" && (
        <div className="absolute inset-0 radar-bg opacity-40 pointer-events-none" />
      )}

      {/* Demarcação do território municipal */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points={boundaryPoints}
          fill="rgba(0,106,96,0.08)"
          stroke="#006A60"
          strokeWidth="0.35"
          strokeDasharray="1.2 0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Zonas de monitoramento */}
      {showZones && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {MONITORING_ZONES.map((zone) => {
            const f = fills[zone.status];
            const isSel = selectedZone === zone.id;
            return (
              <g
                key={zone.id}
                className="cursor-pointer"
                onClick={() => onSelectZone?.(zone.id)}
              >
                <polygon
                  points={ringToSvgPoints(zone.ring, bbox)}
                  fill={f.fill}
                  stroke={f.stroke}
                  strokeWidth={isSel ? 0.5 : 0.25}
                  strokeDasharray={zone.status === "critico" ? "0" : "0.6 0.4"}
                  vectorEffect="non-scaling-stroke"
                  className="transition-all hover:opacity-80"
                  style={
                    isSel
                      ? { filter: "drop-shadow(0 0 8px rgba(0,106,96,0.6))" }
                      : undefined
                  }
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Rótulos das zonas */}
      {showZones && (
        <div className="absolute inset-0 pointer-events-none">
          {MONITORING_ZONES.map((zone) => {
            const { lon, lat } = ringCentroid(zone.ring);
            const { x, y } = lonLatToPercent(lon, lat, bbox);
            const f = fills[zone.status];
            return (
              <div
                key={zone.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className="px-2 py-0.5 text-[9px] font-black uppercase tracking-mono-tight rounded whitespace-nowrap"
                  style={{ background: f.stroke, color: "#fff" }}
                >
                  {zone.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legenda da demarcação municipal */}
      <div className="absolute top-14 left-4 z-10 pointer-events-none">
        <div
          className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-mono-tight border ${
            isDark
              ? "bg-primary/90 text-white border-white/20"
              : "bg-white/95 text-primary border-outline-variant/30 shadow-ambient-sm"
          }`}
        >
          Limite municipal · Porto Seguro-BA
        </div>
      </div>

      {/* Controles */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <a
          href={`https://www.openstreetmap.org/?mlat=${CENTER.lat}&mlon=${CENTER.lon}#map=11/${CENTER.lat}/${CENTER.lon}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`h-9 w-9 rounded-md flex items-center justify-center transition-all ${
            isDark
              ? "bg-white/10 backdrop-blur-md text-white hover:bg-white/20"
              : "bg-white shadow-ambient-sm text-on-surface-variant hover:bg-surface-container-high"
          }`}
          title="Abrir mapa completo"
        >
          <Icon name="open_in_new" className="text-[18px]" />
        </a>
        {["layers", "add", "remove", "my_location"].map((ic) => (
          <button
            key={ic}
            type="button"
            className={`h-9 w-9 rounded-md flex items-center justify-center transition-all ${
              isDark
                ? "bg-white/10 backdrop-blur-md text-white hover:bg-white/20"
                : "bg-white shadow-ambient-sm text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <Icon name={ic} className="text-[18px]" />
          </button>
        ))}
      </div>

      {/* Telemetria */}
      {/* <div className="absolute top-4 left-4 flex flex-col gap-3 z-10">
        <div
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-mono-tight flex items-center gap-2 ${
            isDark ? "bg-secondary text-white" : "bg-primary text-white"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" />
          Telemetria em Tempo Real
        </div>
      </div> */}

      {/* Coordenadas */}
      <div className="absolute bottom-4 left-4 z-10">
        <div
          className={`px-3 py-2 rounded-md flex items-center gap-3 ${
            isDark
              ? "bg-white/8 backdrop-blur-md text-white/80"
              : "bg-white/90 backdrop-blur-md text-on-surface"
          }`}
        >
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-mono opacity-60">
              Coord
            </p>
            <p className="text-[10px] font-mono font-bold">
              16.4497° S, 39.0647° W
            </p>
          </div>
          <div
            className={`h-6 w-px ${isDark ? "bg-white/20" : "bg-outline-variant/40"}`}
          />
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-mono opacity-60">
              Município
            </p>
            <p className="text-[10px] font-mono font-bold">Porto Seguro-BA</p>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-4 right-4 z-10">
        <div
          className={`p-3 rounded-md ${
            isDark
              ? "bg-primary-container/80 backdrop-blur-md"
              : "bg-white/95 backdrop-blur-md shadow-ambient-sm"
          }`}
        >
          <p
            className={`text-[9px] font-black uppercase tracking-mono mb-2 ${
              isDark ? "text-white/60" : "text-on-surface-variant"
            }`}
          >
            Legenda
          </p>
          <div className="space-y-1.5">
            {[
              { c: "#006A60", l: "Limite municipal", dash: true },
              { c: "#BA1A1A", l: "Crítico" },
              { c: "#C2570B", l: "Atenção" },
              { c: "#006A60", l: "Estável" },
            ].map((item) => (
              <div key={item.l} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{
                    background: item.dash ? "transparent" : item.c,
                    border: item.dash ? `2px dashed ${item.c}` : undefined,
                  }}
                />
                <span
                  className={`text-[10px] font-bold ${isDark ? "text-white/90" : "text-on-surface"}`}
                >
                  {item.l}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerta crítico */}
      {alertMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="px-6 py-3 rounded-lg bg-error/95 backdrop-blur-md shadow-ambient flex items-center gap-3">
            <Icon name="warning" filled className="text-white" />
            <span className="font-headline text-white font-black text-sm uppercase tracking-mono-tight">
              Nível Crítico Detectado
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
