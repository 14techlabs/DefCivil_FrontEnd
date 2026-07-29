"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { createMap, addBoundaryLayer } from "@/app/lib/mapShared";
import "maplibre-gl/dist/maplibre-gl.css";

/* ────────────── Types ────────────── */

export interface RouteStop {
  ordem: number;
  local: string;
  motivo: string;
  eta: string;
  lat: number;
  lng: number;
  prioridade: "pessoas_risco" | "zona_alto_indice" | "demais";
  ocorrenciaId?: number | null;
}

interface RouteMapProps {
  stops: RouteStop[];
  height?: number;
  activeStop?: number | null;
  onSelectStop?: (ordem: number) => void;
}

/* ────────────── Cores por prioridade ────────────── */

export const PRIORIDADE_META: Record<
  RouteStop["prioridade"],
  { label: string; color: string; icon: string }
> = {
  pessoas_risco: { label: "Pessoas em área de risco", color: "#BA1A1A", icon: "personal_injury" },
  zona_alto_indice: { label: "Zona de alto índice", color: "#C2570B", icon: "trending_up" },
  demais: { label: "Demais ocorrências", color: "#006A60", icon: "flag" },
};

const SOURCE_ID = "rota-ia";
const LINE_ID = "rota-ia-line";
const ARROW_ID = "rota-ia-arrows";

/* ────────────── Componente ────────────── */

export function RouteMap({ stops, height = 460, activeStop, onSelectStop }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const ordenadas = useMemo(
    () => [...stops].sort((a, b) => a.ordem - b.ordem),
    [stops],
  );

  // cria o mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = ordenadas.length
      ? [ordenadas[0].lng, ordenadas[0].lat]
      : [-39.07, -16.44];

    const map = createMap(containerRef.current, center);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => addBoundaryLayer(map));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // desenha linha da rota + marcadores numerados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const desenhar = () => {
      // linha
      const coords = ordenadas.map((s) => [s.lng, s.lat]);
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      };

      const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
        map.addLayer({
          id: LINE_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#006A60",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
        map.addLayer({
          id: ARROW_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "butt" },
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 2,
            "line-dasharray": [0.5, 2.5],
          },
        });
      }

      // marcadores
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = new maplibregl.LngLatBounds();

      for (const s of ordenadas) {
        const meta = PRIORIDADE_META[s.prioridade];
        const ativo = activeStop === s.ordem;

        const el = document.createElement("div");
        el.style.cssText =
          `width:${ativo ? 38 : 32}px;height:${ativo ? 38 : 32}px;border-radius:50%;display:flex;` +
          "align-items:center;justify-content:center;cursor:pointer;transition:all .15s;" +
          `background:${meta.color};border:3px solid #fff;` +
          `box-shadow:0 4px 14px rgba(0,0,0,${ativo ? 0.4 : 0.25});` +
          `font-weight:900;color:#fff;font-size:${ativo ? 15 : 13}px;font-family:inherit;`;
        el.textContent = String(s.ordem);
        el.addEventListener("click", () => onSelectStop?.(s.ordem));

        const popup = new maplibregl.Popup({ offset: 22, closeButton: false }).setHTML(`
          <div style="font-family:inherit;min-width:200px">
            <p style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${meta.color};margin:0 0 4px">
              Parada ${s.ordem} · ${meta.label}
            </p>
            <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0">${s.local}</p>
            <p style="font-size:11px;color:#475569;margin:4px 0 0">${s.motivo}</p>
            <p style="font-size:11px;color:#0f172a;margin:6px 0 0"><strong>ETA ${s.eta}</strong>${
              s.ocorrenciaId ? ` · Ocorrência #${s.ocorrenciaId}` : ""
            }</p>
          </div>`);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([s.lng, s.lat]);
      }

      if (ordenadas.length === 1) {
        map.easeTo({ center: [ordenadas[0].lng, ordenadas[0].lat], zoom: 14 });
      } else if (ordenadas.length > 1) {
        map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) desenhar();
    else map.once("load", desenhar);
  }, [ordenadas, activeStop, onSelectStop]);

  // centraliza na parada selecionada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeStop == null) return;
    const s = ordenadas.find((x) => x.ordem === activeStop);
    if (s) map.easeTo({ center: [s.lng, s.lat], zoom: 14, duration: 600 });
  }, [activeStop, ordenadas]);

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* legenda de prioridades */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/92 backdrop-blur-sm rounded-lg p-3 shadow-ambient-sm">
        <p className="text-[9px] font-black uppercase tracking-mono text-slate-400 mb-2">
          Ordem de prioridade
        </p>
        <div className="space-y-1.5">
          {(Object.keys(PRIORIDADE_META) as RouteStop["prioridade"][]).map((k, i) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-black text-slate-400 w-3">{i + 1}º</span>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: PRIORIDADE_META[k].color }}
              />
              <span className="text-[10px] font-bold text-primary">{PRIORIDADE_META[k].label}</span>
            </div>
          ))}
        </div>
      </div>

      {ordenadas.length === 0 && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant shadow-ambient-sm">
            Sem rota ativa para este evento
          </span>
        </div>
      )}
    </div>
  );
}
