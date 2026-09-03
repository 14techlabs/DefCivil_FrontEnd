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
  /** mostra popup ao clicar no marcador (padrão). Desligue quando a seleção for controlada pelo pai. */
  showPopups?: boolean;
  /** id do marcador selecionado (ganha destaque visual) */
  selectedId?: number | string | null;
  /** chamado ao clicar num marcador */
  onSelect?: (ponto: MapPoint) => void;
  /** pedido de foco: ao mudar a versão, voa até o marcador */
  focusRequest?: { id: number | string; versao: number } | null;
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

/* ────────────── helpers de zona ────────────── */

function centroidDoPoligono(polygon: GeoJSON.Polygon): [number, number] {
  const ring = polygon.coordinates[0];
  let cx = 0;
  let cy = 0;
  for (const [lon, lat] of ring) {
    cx += lon;
    cy += lat;
  }
  return [cx / ring.length, cy / ring.length];
}

// desenha todas as zonas acinzentadas com o nome, como nos outros mapas
function desenharZonasAcinzentadas(
  map: maplibregl.Map,
  zonas: { id: number; nome: string; area: GeoJSON.Polygon | null }[],
) {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const centroides: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const z of zonas) {
    if (!z.area || !z.area.coordinates?.length) continue;
    const ring = z.area.coordinates[0];
    const deg = ring.every(
      (c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]),
    );
    if (deg) continue;
    features.push({
      type: "Feature",
      properties: { nome: z.nome },
      geometry: z.area,
    });
    const [cx, cy] = centroidDoPoligono(z.area);
    centroides.push({
      type: "Feature",
      properties: { nome: z.nome },
      geometry: { type: "Point", coordinates: [cx, cy] },
    });
  }

  if (features.length === 0) return;

  map.addSource("pontos-zonas", {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });
  map.addLayer({
    id: "pontos-zonas-fill",
    type: "fill",
    source: "pontos-zonas",
    paint: { "fill-color": "#888", "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "pontos-zonas-line",
    type: "line",
    source: "pontos-zonas",
    paint: { "line-color": "#888", "line-width": 1.2, "line-dasharray": [3, 2] },
  });
  map.addSource("pontos-zonas-centroides", {
    type: "geojson",
    data: { type: "FeatureCollection", features: centroides },
  });
  map.addLayer({
    id: "pontos-zonas-label",
    type: "symbol",
    source: "pontos-zonas-centroides",
    layout: {
      "text-field": ["get", "nome"],
      "text-size": 9,
      "text-offset": [0, -0.5],
      "text-anchor": "bottom",
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    },
    paint: {
      "text-color": "#666",
      "text-halo-color": "#fff",
      "text-halo-width": 1.5,
    },
  });
}

/* ────────────── Componente ────────────── */

export function PointsMap({
  points,
  height = 420,
  showFilters = true,
  showPopups = true,
  selectedId = null,
  onSelect,
  focusRequest = null,
}: PointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  // atualiza a ref fora da renderização (regra react-hooks/refs)
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
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
            .get<{
              area: { id: number; area: GeoJSON.MultiPolygon };
              zonas: { id: number; nome: string; area: GeoJSON.Polygon | null }[];
            }>("/entidades/areas/")
            .then((res) => {
              addBoundaryLayer(map, res.data.area.area);
              desenharZonasAcinzentadas(map, res.data.zonas);
            })
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

  // (re)desenha marcadores conforme filtro/seleção (e quando o mapa fica pronto)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

    for (const p of filtered) {
      const meta = KIND_META[p.kind];
      const selecionado = selectedId != null && String(selectedId) === String(p.id);

      const el = document.createElement("div");
      el.style.cssText =
        "width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;" +
        `background:${meta.color};border:2px solid #fff;cursor:pointer;` +
        (selecionado
          ? "box-shadow:0 0 0 4px #fff, 0 0 0 8px rgba(2,132,199,0.9), 0 4px 12px rgba(0,0,0,0.35);transform:scale(1.15);z-index:20;"
          : "box-shadow:0 4px 12px rgba(0,0,0,0.28);");
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:#fff;font-variation-settings:'FILL' 1">${meta.icon}</span>`;

      // clicar no marcador seleciona (o pai decide o que fazer com a seleção)
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(p);
      });

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

      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]);
      if (showPopups) {
        marker.setPopup(
          new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(popupHtml),
        );
      }
      marker.addTo(map);

      markersRef.current.push(marker);
    }
  }, [filtered, mapReady, selectedId, showPopups]);

  // enquadra a lista quando ela muda de verdade (não a cada seleção)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || filtered.length === 0) return;
    // quando há foco pendente o voo até o marcador cuida do enquadramento
    if (focusRequest && filtered.some((p) => String(p.id) === String(focusRequest.id))) {
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    filtered.forEach((p) => bounds.extend([p.lng, p.lat]));
    if (filtered.length === 1) {
      map.easeTo({ center: [filtered[0].lng, filtered[0].lat], zoom: 13 });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
    }
  }, [filtered, mapReady, focusRequest]);

  // foca um marcador quando o pai pede (lista ou link profundo)
  useEffect(() => {
    if (!focusRequest || !mapReady) return;
    const alvo = filtered.find((p) => String(p.id) === String(focusRequest.id));
    if (!alvo) return;
    mapRef.current?.easeTo({
      center: [alvo.lng, alvo.lat],
      zoom: Math.max(mapRef.current?.getZoom() ?? 13, 14),
      duration: 600,
    });
  }, [focusRequest, mapReady, filtered]);

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
