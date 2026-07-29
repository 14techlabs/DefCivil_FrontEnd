"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { createMap, addBoundaryLayer } from "@/app/lib/mapShared";
import "maplibre-gl/dist/maplibre-gl.css";

/* ────────────── Types ────────────── */

export interface MapPoint {
  id: number | string;
  lat: number;
  lng: number;
  titulo: string;
  subtitulo?: string;
  kind: "ocorrencia_aberta" | "ocorrencia_andamento" | "ocorrencia_concluida" | "evento";
  tecnicoNoLocal?: string | null;
}

interface PointsMapProps {
  points: MapPoint[];
  height?: number;
  showFilters?: boolean;
}

/* ────────────── Config visual por tipo ────────────── */

const KIND_META: Record<
  MapPoint["kind"],
  { label: string; color: string; icon: string }
> = {
  ocorrencia_aberta: { label: "Em aberto", color: "#C2570B", icon: "emergency" },
  ocorrencia_andamento: { label: "Em andamento", color: "#BA1A1A", icon: "engineering" },
  ocorrencia_concluida: { label: "Concluídas", color: "#006A60", icon: "check_circle" },
  evento: { label: "Eventos", color: "#1D4ED8", icon: "cyclone" },
};

/* ────────────── Componente ────────────── */

export function PointsMap({ points, height = 420, showFilters = true }: PointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [visible, setVisible] = useState<Record<MapPoint["kind"], boolean>>({
    ocorrencia_aberta: true,
    ocorrencia_andamento: true,
    ocorrencia_concluida: true,
    evento: true,
  });

  const filtered = useMemo(
    () => points.filter((p) => visible[p.kind]),
    [points, visible],
  );

  // cria o mapa uma única vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = points.length
      ? [points[0].lng, points[0].lat]
      : [-39.07, -16.44];

    const map = createMap(containerRef.current, center);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      addBoundaryLayer(map);
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (re)desenha marcadores conforme filtro
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();

    for (const p of filtered) {
      const meta = KIND_META[p.kind];

      const el = document.createElement("div");
      el.style.cssText =
        "width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;" +
        `background:${meta.color};box-shadow:0 4px 12px rgba(0,0,0,0.28);border:2px solid #fff;cursor:pointer;`;
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:#fff;font-variation-settings:'FILL' 1">${meta.icon}</span>`;

      const popupHtml = `
        <div style="font-family:inherit;min-width:180px">
          <p style="font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${meta.color};margin:0 0 4px">${meta.label}</p>
          <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0">${p.titulo}</p>
          ${p.subtitulo ? `<p style="font-size:11px;color:#475569;margin:4px 0 0">${p.subtitulo}</p>` : ""}
          ${
            p.tecnicoNoLocal
              ? `<p style="font-size:11px;color:#0f172a;margin:6px 0 0;display:flex;align-items:center;gap:4px">
                   <span class="material-symbols-outlined" style="font-size:14px;color:#006A60">engineering</span>
                   <strong>${p.tecnicoNoLocal}</strong>&nbsp;no local
                 </p>`
              : ""
          }
        </div>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHtml))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([p.lng, p.lat]);
    }

    if (filtered.length === 1) {
      map.easeTo({ center: [filtered[0].lng, filtered[0].lat], zoom: 13 });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
    }
  }, [filtered]);

  // tipos presentes nos dados (pra não mostrar filtro de algo que não existe)
  const kindsPresent = useMemo(() => {
    const s = new Set(points.map((p) => p.kind));
    return (Object.keys(KIND_META) as MapPoint["kind"][]).filter((k) => s.has(k));
  }, [points]);

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />

      {showFilters && kindsPresent.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 max-w-[70%]">
          {kindsPresent.map((k) => {
            const meta = KIND_META[k];
            const on = visible[k];
            const count = points.filter((p) => p.kind === k).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-mono-tight transition-all shadow-ambient-sm ${
                  on ? "text-white" : "bg-white/90 text-slate-400"
                }`}
                style={on ? { background: meta.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: on ? "#fff" : meta.color }}
                />
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant shadow-ambient-sm">
            Nenhum ponto para exibir com os filtros atuais
          </span>
        </div>
      )}
    </div>
  );
}
