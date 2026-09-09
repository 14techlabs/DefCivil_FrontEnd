"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
import { createMap, addBoundaryLayer, getMultiPolygonCenter } from "@/app/lib/mapShared";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";
import "maplibre-gl/dist/maplibre-gl.css";

/* ────────────── Types ────────────── */

interface MonitoringZona {
  id: number;
  nome: string;
  area: GeoJSON.Polygon | null;
}

interface MonitoringOcorrencia {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  descricao: string;
  coordenadas: { lat: number; lng: number } | null;
}

interface MonitoringMapProps {
  height?: number;
}

/* ────────────── layer IDs das zonas (cinza) ────────────── */

const ZONE_SOURCE = "monitoring-zones";
const ZONE_FILL = "monitoring-zone-fill";
const ZONE_LINE = "monitoring-zone-line";
const CENTROID_SOURCE = "monitoring-centroids";
const CENTROID_LABEL = "monitoring-centroid-label";

/* ────────────── helpers de ocorrência ────────────── */

const CATEGORIA_LABEL: Record<string, string> = {
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Prod. Perigosos",
};

const CATEGORIA_ICON: Record<string, string> = {
  geologico: "terrain",
  climatico: "thunderstorm",
  vias_publicas: "directions_car",
  produtos_perigosos: "science",
};

function ocorrenciaColor(status: string): string {
  return getOccurrenceStatusMeta(status).color;
}

function isDegenerateRing(ring: number[][]): boolean {
  return ring.every((c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function popupOcorrenciaHtml(o: MonitoringOcorrencia, color: string): string {
  const status = escapeHtml(getOccurrenceStatusMeta(o.status).label.toUpperCase());
  const titulo = escapeHtml(o.titulo ?? "");
  const categoria = escapeHtml(CATEGORIA_LABEL[o.categoria] ?? o.categoria);
  const coords = o.coordenadas
    ? `${o.coordenadas.lat.toFixed(4)}, ${o.coordenadas.lng.toFixed(4)}`
    : "";
  const descricao =
    o.descricao && o.descricao.length > 140
      ? escapeHtml(`${o.descricao.slice(0, 140)}…`)
      : escapeHtml(o.descricao ?? "");
  return `
    <div style="font-family:inherit;min-width:220px">
      <p style="font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${color};margin:0 0 2px">Ocorrência #${o.id} · ${status}</p>
      <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 4px">${titulo}</p>
      <p style="font-size:11px;color:#475569;margin:0 0 4px">${categoria}${coords ? ` · ${coords}` : ""}</p>
      ${descricao ? `<p style="font-size:11px;color:#64748b;margin:0 0 8px;line-height:1.4">${descricao}</p>` : ""}
      <button data-ver-ocorrencia style="width:100%;display:flex;align-items:center;justify-content:center;gap:4px;padding:7px 10px;border:none;border-radius:8px;background:${color};color:#fff;font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer">
        <span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' 1">open_in_new</span>
        Ver ocorrência
      </button>
    </div>`;
}

/* ────────────── Componente ────────────── */

export function MonitoringMap({ height = 520 }: MonitoringMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const openPopupRef = useRef<maplibregl.Popup | null>(null);
  const autoFitDone = useRef(false);
  const router = useRouter();
  const { user } = useGardian();

  const [entityArea, setEntityArea] = useState<GeoJSON.MultiPolygon | null>(null);
  const [entityCenter, setEntityCenter] = useState<[number, number] | null>(null);
  const [zonas, setZonas] = useState<MonitoringZona[]>([]);
  const [ocorrencias, setOcorrencias] = useState<MonitoringOcorrencia[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  /* ── busca entidade + zonas + ocorrências antes de criar o mapa ── */
  useEffect(() => {
    if (!user?.entidade) return;
    let cancelled = false;

    Promise.all([
      api.get<{
        area: { id: number; area: GeoJSON.MultiPolygon };
        zonas: { id: number; nome: string; area: GeoJSON.Polygon | null }[];
      }>("/entidades/areas/"),
      // ocorrências não bloqueiam o mapa (fallback vazio em erro)
      api
        .get<{ ocorrencias: MonitoringOcorrencia[] }>("/ocorrencias/")
        .catch(() => ({ data: { ocorrencias: [] } })),
    ])
      .then(([areaRes, occRes]) => {
        if (cancelled) return;
        const area = areaRes.data.area.area;
        setEntityArea(area);
        setEntityCenter(getMultiPolygonCenter(area));
        setZonas(
          (areaRes.data.zonas ?? []).filter(
            (z) =>
              z.area &&
              z.area.type === "Polygon" &&
              z.area.coordinates?.length > 0 &&
              !isDegenerateRing(z.area.coordinates[0]),
          ),
        );
        setOcorrencias((occRes.data.ocorrencias ?? []).filter((o) => o.coordenadas != null));
        setDataReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setDataReady(true);
      });

    return () => { cancelled = true; };
  }, [user?.entidade]);

  /* ── camadas de zonas (cinza) ── */
  const addZoneLayers = (map: maplibregl.Map, zonas: MonitoringZona[]) => {
    if (zonas.length === 0) return;

    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    const centroids: GeoJSON.Feature<GeoJSON.Point>[] = [];

    for (const z of zonas) {
      if (!z.area) continue;
      const ring = z.area.coordinates[0];
      if (isDegenerateRing(ring)) continue;

      features.push({
        type: "Feature",
        properties: { nome: z.nome },
        geometry: z.area,
      });

      // centroide = média dos vértices do anel externo
      const cx = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const cy = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      centroids.push({
        type: "Feature",
        properties: { nome: z.nome },
        geometry: { type: "Point", coordinates: [cx, cy] },
      });
    }

    if (features.length === 0) return;

    // insere as camadas abaixo do limite municipal
    const beforeId = map.getLayer("municipal-boundary-line")
      ? "municipal-boundary-line"
      : undefined;

    map.addSource(ZONE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });
    map.addLayer(
      {
        id: ZONE_FILL,
        type: "fill",
        source: ZONE_SOURCE,
        paint: { "fill-color": "#888", "fill-opacity": 0.15 },
      },
      beforeId,
    );
    map.addLayer(
      {
        id: ZONE_LINE,
        type: "line",
        source: ZONE_SOURCE,
        paint: { "line-color": "#888", "line-width": 1.5, "line-dasharray": [3, 2] },
      },
      beforeId,
    );
    map.addSource(CENTROID_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: centroids },
    });
    map.addLayer(
      {
        id: CENTROID_LABEL,
        type: "symbol",
        source: CENTROID_SOURCE,
        layout: {
          "text-field": ["get", "nome"],
          "text-size": 10,
          "text-offset": [0, -0.5],
          "text-anchor": "bottom",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#666",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
        },
      },
      beforeId,
    );
  };

  /* ── pins das ocorrências ── */
  const addOcorrenciaMarkers = (map: maplibregl.Map, ocorrencias: MonitoringOcorrencia[]) => {
    if (ocorrencias.length === 0) return;

    for (const o of ocorrencias) {
      if (!o.coordenadas) continue;
      const color = ocorrenciaColor(o.status);
      const icon = CATEGORIA_ICON[o.categoria] ?? "emergency";

      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
        `background:${color};box-shadow:0 3px 10px rgba(0,0,0,0.3);border:2px solid #fff;cursor:pointer;`;
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;color:#fff;font-variation-settings:'FILL' 1">${icon}</span>`;

      const popup = new maplibregl.Popup({ offset: 16, maxWidth: "280px" }).setHTML(
        popupOcorrenciaHtml(o, color),
      );

      // atalho para a página de ocorrências dentro do popup (onclick substitui, evita acumular listeners)
      popup.on("open", () => {
        const btn = popup.getElement().querySelector<HTMLElement>("[data-ver-ocorrencia]");
        if (btn) {
          btn.onclick = () => {
            openPopupRef.current?.remove();
            openPopupRef.current = null;
            router.push(`/occurrences?id=${o.id}`);
          };
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([o.coordenadas.lng, o.coordenadas.lat])
        .setPopup(popup)
        .addTo(map);

      // só um popup aberto por vez
      marker.getElement().addEventListener("click", () => {
        if (openPopupRef.current && openPopupRef.current !== popup) {
          openPopupRef.current.remove();
        }
        openPopupRef.current = popup;
      });

      markersRef.current.push(marker);
    }
  };

  /* ── "show all" uma única vez ── */
  const fitAll = (
    map: maplibregl.Map,
    entityArea: GeoJSON.MultiPolygon | null,
    zonas: MonitoringZona[],
    ocorrencias: MonitoringOcorrencia[],
  ) => {
    if (autoFitDone.current) return;
    autoFitDone.current = true;

    const bounds = new maplibregl.LngLatBounds();

    // entidade
    if (entityArea) {
      for (const polygon of entityArea.coordinates) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) bounds.extend([lng, lat]);
        }
      }
    }

    // zonas
    for (const z of zonas) {
      if (!z.area) continue;
      for (const [lng, lat] of z.area.coordinates[0]) bounds.extend([lng, lat]);
    }

    // ocorrências
    for (const o of ocorrencias) {
      if (o.coordenadas) bounds.extend([o.coordenadas.lng, o.coordenadas.lat]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 14 });
    }
  };

  /* ── cria o mapa uma única vez, após os dados estarem prontos ── */
  useEffect(() => {
    if (!dataReady || !entityCenter || !containerRef.current) return;

    const map = createMap(containerRef.current, entityCenter);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // 1. limite municipal
      if (entityArea) addBoundaryLayer(map, entityArea);

      // 2. zonas cinza + labels de centroid (abaixo do limite municipal)
      addZoneLayers(map, zonas);

      // 3. pins das ocorrências
      addOcorrenciaMarkers(map, ocorrencias);

      // 4. "show all": ajusta para entidade + zonas + ocorrências
      fitAll(map, entityArea, zonas, ocorrencias);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      openPopupRef.current?.remove();
      openPopupRef.current = null;
      map.remove();
      mapRef.current = null;
      autoFitDone.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, entityCenter]);

  /* ── camadas de zonas vizinhas (cinza) ── */
  /* ── estados de carregamento e erro ── */
  if (loadError) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low gap-2"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-[36px]">map</span>
        <p className="text-sm text-on-surface-variant font-medium">
          Não foi possível carregar o mapa de monitoramento.
        </p>
      </div>
    );
  }

  if (!dataReady) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl bg-surface-container-low"
      >
        <p className="text-sm text-on-surface-variant font-medium">Carregando mapa…</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden"
    />
  );
}
