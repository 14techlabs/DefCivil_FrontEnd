"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Icon } from "@/app/components/Primitives";
import {
  createMap,
  addBoundaryLayer,
  getPolygonBounds,
  MUNICIPIO_CENTER,
} from "@/app/lib/mapShared";

import "maplibre-gl/dist/maplibre-gl.css";

/* ────────────── types ────────────── */

interface DashboardZone {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
  area: GeoJSON.Polygon | null;
}

interface DashboardMapProps {
  zones: DashboardZone[];
  height?: number;
  onZoneSelect?: (zoneId: number | null) => void;
  selectedZoneId?: number | null;
}

/* ────────────── helpers ────────────── */

function polygonCentroid(coords: number[][]): [number, number] {
  const n = coords.length;
  let cx = 0, cy = 0;
  for (const [x, y] of coords) { cx += x; cy += y; }
  return [cx / n, cy / n];
}

function isDegenerate(coords: number[][]): boolean {
  return coords.every(
    (c, i) => i === 0 || (c[0] === coords[0][0] && c[1] === coords[0][1]),
  );
}

/* ────────────── layer IDs ────────────── */

const ZONES_SOURCE = "dash-zones";
const ZONES_FILL = "dash-zones-fill";
const ZONES_LINE = "dash-zones-line";
const HIGHLIGHT_SOURCE = "dash-highlight";
const HIGHLIGHT_FILL = "dash-highlight-fill";
const HIGHLIGHT_LINE = "dash-highlight-line";
const CENTROIDS_SOURCE = "dash-centroids";
const CENTROIDS_LABEL = "dash-centroids-label";

/** remover todas as layers do mapa */
function removeLayers(map: maplibregl.Map) {
  const ids = [
    CENTROIDS_LABEL,
    HIGHLIGHT_LINE,
    HIGHLIGHT_FILL,
    ZONES_LINE,
    ZONES_FILL,
  ];
  for (const id of ids) {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ok */ }
  }
  const srcs = [CENTROIDS_SOURCE, HIGHLIGHT_SOURCE, ZONES_SOURCE];
  for (const src of srcs) {
    try { if (map.getSource(src)) map.removeSource(src); } catch { /* ok */ }
  }
}

/* ────────────── component ────────────── */

export function DashboardMap({
  zones,
  height = 420,
  onZoneSelect,
  selectedZoneId,
}: DashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const layersInitialized = useRef(false);
  const hoveredIdRef = useRef<number | string | null>(null);
  const autoFitDone = useRef(false);

  /* ── inicializar o mapa (uma vez apenas) ── */
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = createMap(container, MUNICIPIO_CENTER);
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    let disposed = false;

    const resize = () => { if (!disposed) map.resize(); };
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    window.addEventListener("resize", resize);

    map.on("load", () => {
      resize();
      addBoundaryLayer(map);
    });

    mapRef.current = map;
    requestAnimationFrame(resize);

    return () => {
      disposed = true;
      ro.disconnect();
      window.removeEventListener("resize", resize);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  /* ── adicionar/atualizar layers quando zonas ou selectedZoneId mudam ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // criar GeoJSON válido (skipar áreas nulas ou degeneradas)
      const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
      const centroids: GeoJSON.Feature<GeoJSON.Point>[] = [];

      for (const z of zones) {
        if (!z.area) continue;
        const ring = z.area.coordinates[0];
        if (isDegenerate(ring)) continue;

        const props = {
          id: z.id,
          nome: z.nome,
          status: z.status,
          tipo: z.tipo,
          descricao: z.descricao,
        };

        features.push({
          type: "Feature",
          properties: props,
          geometry: z.area,
        });

        const [cx, cy] = polygonCentroid(ring);
        centroids.push({
          type: "Feature",
          properties: { nome: z.nome, status: z.status },
          geometry: { type: "Point", coordinates: [cx, cy] },
        });
      }

      // remover layers antigas primeiro
      removeLayers(map);

      if (features.length === 0) return;

      /* ── source dos polígonos + layers ── */

      map.addSource(ZONES_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      map.addLayer({
        id: ZONES_FILL,
        type: "fill",
        source: ZONES_SOURCE,
        paint: {
          "fill-color": [
            "match",
            ["get", "status"],
            "critico", "#BA1A1A",
            "atencao", "#C2570B",
            "estavel", "#006A60",
            "#006A60",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.55,
            [
              "match",
              ["get", "status"],
              "critico", 0.3,
              "atencao", 0.25,
              "estavel", 0.2,
              0.2,
            ],
          ],
        },
      });

      map.addLayer({
        id: ZONES_LINE,
        type: "line",
        source: ZONES_SOURCE,
        paint: {
          "line-color": [
            "match",
            ["get", "status"],
            "critico", "#BA1A1A",
            "atencao", "#C2570B",
            "estavel", "#006A60",
            "#006A60",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            3.5,
            2,
          ],
        },
      });

      /* ── destacar source + layers da zona ── */

      map.addSource(HIGHLIGHT_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: HIGHLIGHT_FILL,
        type: "fill",
        source: HIGHLIGHT_SOURCE,
        paint: {
          "fill-color": "#006A60",
          "fill-opacity": 0.18,
        },
      });

      map.addLayer({
        id: HIGHLIGHT_LINE,
        type: "line",
        source: HIGHLIGHT_SOURCE,
        paint: {
          "line-color": "#006A60",
          "line-width": 4,
        },
      });

      /* ── layer da source + label dos centroids ── */

      map.addSource(CENTROIDS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: centroids },
      });

      map.addLayer({
        id: CENTROIDS_LABEL,
        type: "symbol",
        source: CENTROIDS_SOURCE,
        layout: {
          "text-field": ["get", "nome"],
          "text-size": 11,
          "text-offset": [0, -0.5],
          "text-anchor": "bottom",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#051125",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      layersInitialized.current = true;

      // encaixar todas as zonas da tela na
      // primeira vez que a página for carregada
      if (!autoFitDone.current && features.length > 0) {
        autoFitDone.current = true;
        const allBounds = features.reduce((bounds, f) => {
          const b = getPolygonBounds(f.geometry);
          return bounds ? bounds.extend(b) : b;
        }, null as maplibregl.LngLatBounds | null);
        if (allBounds) {
          map.fitBounds(allBounds, { padding: 60, maxZoom: 14, duration: 600 });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return () => {
      layersInitialized.current = false;
      removeLayers(map);
    };
  }, [zones]);

  /* ── atualizar o destaque quando selectedZoneId muda ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersInitialized.current) return;

    const apply = () => {
      const source = map.getSource(HIGHLIGHT_SOURCE) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!source) return;

      if (selectedZoneId == null) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      const zone = zones.find((z) => z.id === selectedZoneId);
      if (!zone?.area) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: zone.area,
          },
        ],
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [selectedZoneId, zones]);

  /* ── atualizar status do filtro ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersInitialized.current) return;

    const apply = () => {
      const filter: maplibregl.FilterSpecification | null =
        statusFilter && statusFilter !== "todas"
          ? (["==", ["get", "status"], statusFilter] as maplibregl.FilterSpecification)
          : null;

      for (const id of [ZONES_FILL, ZONES_LINE, CENTROIDS_LABEL]) {
        try {
          map.setFilter(id, filter);
        } catch { /* pode ser que a layer não exista ainda */ }
      }

      // remover o destaque caso a zona não esteja mais visível devido ao filtro
      if (selectedZoneId != null && statusFilter && statusFilter !== "todas") {
        const selected = zones.find((z) => z.id === selectedZoneId);
        if (!selected || selected.status !== statusFilter) {
          // removendo o destaque
          const hlSource = map.getSource(HIGHLIGHT_SOURCE) as
            | maplibregl.GeoJSONSource
            | undefined;
          hlSource?.setData({ type: "FeatureCollection", features: [] });
          onZoneSelect?.(null);
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [statusFilter, selectedZoneId, zones, onZoneSelect]);

  /* ── click handler (preenchimento/linha das zonas) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [ZONES_FILL, ZONES_LINE],
      });
      if (features.length > 0) {
        const id = features[0].properties?.id;
        if (id != null) onZoneSelect?.(Number(id));
      }
    };

    map.on("click", ZONES_FILL, handleClick);
    map.on("click", ZONES_LINE, handleClick);

    return () => {
      map.off("click", ZONES_FILL, handleClick);
      map.off("click", ZONES_LINE, handleClick);
    };
  }, [onZoneSelect]);

  /* ── hover handler ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleHover = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [ZONES_FILL, ZONES_LINE],
      });
      map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";

      // resetar o hover anterior
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          { source: ZONES_SOURCE, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
      }

      if (features.length > 0 && features[0].id != null) {
        const id = features[0].id;
        map.setFeatureState({ source: ZONES_SOURCE, id }, { hover: true });
        hoveredIdRef.current = id;
      }
    };

    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          { source: ZONES_SOURCE, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
      }
    };

    map.on("mousemove", handleHover);
    map.on("mouseleave", ZONES_FILL, handleLeave);
    map.on("mouseleave", ZONES_LINE, handleLeave);

    return () => {
      map.off("mousemove", handleHover);
      map.off("mouseleave", ZONES_FILL, handleLeave);
      map.off("mouseleave", ZONES_LINE, handleLeave);
    };
  }, []);

  /* ── encaixar todas as zonas ── */
  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = zones.filter(
      (z) =>
        z.area &&
        !isDegenerate(z.area.coordinates[0]),
    );
    if (valid.length === 0) return;

    const allBounds = valid.reduce((bounds, z) => {
      const b = getPolygonBounds(z.area!);
      return bounds ? bounds.extend(b) : b;
    }, null as maplibregl.LngLatBounds | null);

    if (allBounds) {
      map.fitBounds(allBounds, { padding: 60, maxZoom: 14, duration: 600 });
    }
  }, [zones]);

  /* ── opções de filtro do status ── */
  const filterOptions = [
    { id: null, label: "Todas" },
    { id: "critico", label: "Crítico" },
    { id: "atencao", label: "Atenção" },
    { id: "estavel", label: "Estável" },
  ] as const;

  /* ── render ── */

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-surface-container-low w-full"
      style={{ height }}
    >
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* botões de filtro de status da zona */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5">
        {filterOptions.map((opt) => {
          const active = statusFilter === opt.id;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-mono-tight transition-all border ${
                active
                  ? opt.id === "critico"
                    ? "bg-red-50 text-red-700 border-red-200 shadow-ambient-sm"
                    : opt.id === "atencao"
                      ? "bg-orange-50 text-orange-700 border-orange-200 shadow-ambient-sm"
                      : opt.id === "estavel"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-ambient-sm"
                        : "bg-primary text-white border-primary shadow-ambient-sm"
                  : opt.id === "critico"
                    ? "bg-white/90 text-red-600 border-transparent hover:bg-white"
                    : opt.id === "atencao"
                      ? "bg-white/90 text-orange-600 border-transparent hover:bg-white"
                      : opt.id === "estavel"
                        ? "bg-white/90 text-emerald-600 border-transparent hover:bg-white"
                        : "bg-white/90 text-primary border-transparent hover:bg-white"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* botão "Mostrar todas" */}
      <button
        type="button"
        onClick={handleFitAll}
        className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded bg-white/90 text-primary text-[10px] font-bold uppercase tracking-mono-tight hover:bg-white shadow-ambient-sm transition-all"
      >
        <Icon name="fit_screen" className="text-[14px] mr-1 align-text-bottom" />
        Mostrar todas
      </button>

      {/* legenda */}
      <div className="absolute bottom-14 right-4 z-10 pointer-events-none">
        <div className="px-3 py-2 rounded-md bg-white/95 backdrop-blur-md shadow-ambient-sm">
          <p className="text-[9px] font-black uppercase tracking-mono text-on-surface-variant mb-1.5">
            Legenda
          </p>
          <div className="space-y-1">
            {[
              { color: "#006A60", label: "Limite municipal", dashed: true },
              { color: "#BA1A1A", label: "Crítico" },
              { color: "#C2570B", label: "Atenção" },
              { color: "#006A60", label: "Estável" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 shrink-0 ${
                    item.dashed ? "border-2 border-dashed rounded-sm" : "rounded-sm"
                  }`}
                  style={{
                    borderColor: item.dashed ? item.color : undefined,
                    backgroundColor: item.dashed ? "transparent" : `${item.color}55`,
                  }}
                />
                <span className="text-[10px] font-bold text-on-surface">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
