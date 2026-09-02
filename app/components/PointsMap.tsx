"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { createMap, addBoundaryLayer } from "@/app/lib/mapShared";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
import "maplibre-gl/dist/maplibre-gl.css";

/* ────────────── Types ────────────── */

export interface MapPoint {
  id: number | string;
  lat: number;
  lng: number;
  titulo: string;
  subtitulo?: string;
  kind:
    | "ocorrencia_alta_prioridade"
    | "ocorrencia_aguardando"
    | "ocorrencia_em_analise"
    | "ocorrencia_em_andamento"
    | "ocorrencia_concluida"
    | "evento"
    | "ponto_apoio";
  tecnicoNoLocal?: string | null;
}

interface PointsMapProps {
  points: MapPoint[];
  height?: number;
  showFilters?: boolean;
}

/* ────────────── Config visual por tipo ────────────── */

export const KIND_META: Record<
  MapPoint["kind"],
  { label: string; color: string; icon: string }
> = {
  ocorrencia_alta_prioridade: { ...getOccurrenceStatusMeta("alta_prioridade"), icon: "priority_high" },
  ocorrencia_aguardando: { ...getOccurrenceStatusMeta("aguardando"), icon: "hourglass_top" },
  ocorrencia_em_analise: { ...getOccurrenceStatusMeta("em_analise"), icon: "search" },
  ocorrencia_em_andamento: { ...getOccurrenceStatusMeta("em_andamento"), icon: "engineering" },
  ocorrencia_concluida: { ...getOccurrenceStatusMeta("concluida"), icon: "check_circle" },
  evento: { label: "Eventos", color: "#1D4ED8", icon: "cyclone" },
  ponto_apoio: { label: "Pontos de apoio", color: "#7C4DFF", icon: "home_work" },
};

/* ────────────── Componente ────────────── */

export function PointsMap({ points, height = 420, showFilters = true }: PointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { user } = useGardian();

  const [visible, setVisible] = useState<Record<MapPoint["kind"], boolean>>({
    ocorrencia_alta_prioridade: true,
    ocorrencia_aguardando: true,
    ocorrencia_em_analise: true,
    ocorrencia_em_andamento: true,
    ocorrencia_concluida: true,
    evento: true,
    ponto_apoio: true,
  });

  // vira true só depois que o mapa existe de verdade (criação é assíncrona)
  const [mapReady, setMapReady] = useState(false);

  const filtered = useMemo(
    () => points.filter((p) => visible[p.kind]),
    [points, visible],
  );

  /* ── iniciar o mapa (uma vez, só com o container dimensionado) ──
     Mesmo padrão do ZoneMap: não criar o mapa no primeiro frame (aba
     recém-aberta ainda sem layout / double-mount do StrictMode derruba o
     contexto WebGL → "WebGL context was lost" e mapa em branco). */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const center: [number, number] = points.length
      ? [points[0].lng, points[0].lat]
      : [-39.07, -16.44];

    let disposed = false;
    let attempts = 0;

    const resizeMap = () => {
      if (!disposed && mapRef.current) mapRef.current.resize();
    };

    const create = () => {
      if (disposed || mapRef.current) return;

      // espera o container ter tamanho real antes de pedir contexto WebGL
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        if (attempts < 60) {
          attempts += 1;
          requestAnimationFrame(create);
        }
        return;
      }

      const map = createMap(container, center);
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const ro = new ResizeObserver(() => {
        resizeMap();
        // caso o container só ganhe tamanho depois (aba oculta), tenta criar de novo
        if (!disposed && !mapRef.current && container.clientWidth > 0 && container.clientHeight > 0) {
          create();
        }
      });
      ro.observe(container);
      window.addEventListener("resize", resizeMap);

      // se o navegador derrubar e restaurar o contexto, redimensiona o canvas
      map.on("webglcontextrestored", resizeMap);

      map.on("load", () => {
        resizeMap();
        if (user?.entidade) {
          api
            .get<{ area: { id: number; area: GeoJSON.MultiPolygon } }>(
              "/entidades/areas/",
            )
            .then((res) => addBoundaryLayer(map, res.data.area.area))
            .catch(() => {});
        }
      });

      mapRef.current = map;
      requestAnimationFrame(resizeMap);
      setMapReady(true);
    };

    create();

    return () => {
      disposed = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const map = mapRef.current;
      mapRef.current = null;
      setMapReady(false);
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (re)desenha marcadores conforme filtro (e quando o mapa fica pronto)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

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
  }, [filtered, mapReady]);

  // tipos presentes nos dados (pra não mostrar filtro de algo que não existe)
  const kindsPresent = useMemo(() => {
    const s = new Set(points.map((p) => p.kind));
    return (Object.keys(KIND_META) as MapPoint["kind"][]).filter((k) => s.has(k));
  }, [points]);

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />

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
