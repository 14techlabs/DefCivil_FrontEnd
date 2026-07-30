"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import {
  createMap,
  patchDrawForMapLibre,
  addBoundaryLayer,
  getMultiPolygonCenter,
  MAP_STYLE,
} from "@/app/lib/mapShared";
import { MAPLIBRE_DRAW_STYLES } from "@/app/lib/maplibreDrawStyles";

import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

/* ─────────── type da geometria do polígono (export) ─────────── */

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type ZonaAreaRecord = {
  id: number;
  nome: string;
  area?: PolygonGeometry | null;
};

const SAVED_SOURCE_ID = "saved-polygon";
const SAVED_FILL_ID = "saved-polygon-fill";
const SAVED_LINE_ID = "saved-polygon-line";

const DEFAULT_CENTER: [number, number] = [-39.5, -16.0];

function getBounds(geometry: PolygonGeometry) {
  const coords = geometry.coordinates[0];
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return new maplibregl.LngLatBounds(
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  );
}

function upsertSavedPolygonLayer(map: maplibregl.Map, geometry: PolygonGeometry) {
  const feature = {
    type: "Feature" as const,
    properties: {},
    geometry,
  };

  if (map.getSource(SAVED_SOURCE_ID)) {
    (map.getSource(SAVED_SOURCE_ID) as maplibregl.GeoJSONSource).setData(feature);
    return;
  }

  map.addSource(SAVED_SOURCE_ID, {
    type: "geojson",
    data: feature,
  });

  map.addLayer({
    id: SAVED_FILL_ID,
    type: "fill",
    source: SAVED_SOURCE_ID,
    paint: {
      "fill-color": "#006A60",
      "fill-opacity": 0.22,
    },
  });

  map.addLayer({
    id: SAVED_LINE_ID,
    type: "line",
    source: SAVED_SOURCE_ID,
    paint: {
      "line-color": "#006A60",
      "line-width": 2.5,
    },
  });
}

export function AreaDrawMap({ height = 420 }: { height?: number }) {
  const { showToast } = useGardian();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedMeta, setLoadedMeta] = useState<{ id: number; nome: string } | null>(null);

  const renderSavedPolygon = useCallback((geometry: PolygonGeometry, meta?: { id: number; nome: string }) => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      upsertSavedPolygonLayer(map, geometry);
      if (meta) setLoadedMeta(meta);
      map.fitBounds(getBounds(geometry), { padding: 48, maxZoom: 14, duration: 800 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    patchDrawForMapLibre(MapboxDraw);

    const map = createMap(container, DEFAULT_CENTER);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let disposed = false;

    const resizeMap = () => {
      if (!disposed) map.resize();
    };

    const resizeObserver = new ResizeObserver(() => resizeMap());
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeMap);

    const mountDraw = () => {
      if (disposed || drawRef.current) return;

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: "draw_polygon",
        styles: [...MAPLIBRE_DRAW_STYLES],
      });

      map.addControl(draw as unknown as maplibregl.IControl, "top-left");
      drawRef.current = draw;
    };

    const onMapLoad = () => {
      resizeMap();
      mountDraw();
    };

    map.on("load", onMapLoad);

    mapRef.current = map;
    requestAnimationFrame(resizeMap);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      drawRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  const getDrawnPolygon = (): PolygonGeometry | null => {
    const draw = drawRef.current;
    if (!draw) return null;

    const collection = draw.getAll();
    const feature = collection.features.find((f) => f.geometry?.type === "Polygon");
    if (!feature || feature.geometry.type !== "Polygon") return null;

    return {
      type: "Polygon",
      coordinates: feature.geometry.coordinates as number[][][],
    };
  };

  const handleSave = async () => {
    const polygon = getDrawnPolygon();
    if (!polygon) {
      showToast("Desenhe um polígono no mapa antes de salvar.", "error");
      return;
    }

    setSaving(true);
    try {
      const nome = `Área dashboard ${new Date().toLocaleString("pt-BR")}`;
      const res = await api.post<ZonaAreaRecord>("/zonas/", {
        nome,
        descricao: "Polígono criado no painel do dashboard",
        tipo: "urbana",
        status: "estavel",
        area: polygon,
      });

      renderSavedPolygon(polygon, { id: res.data.id, nome: res.data.nome ?? nome });
      showToast("Polígono salvo no banco de dados.");
    } catch {
      showToast("Não foi possível salvar o polígono.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadLatest = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ zonas: ZonaAreaRecord[] }>("/zonas/");
      const latest = res.data.zonas
        .filter((z) => z.area?.type === "Polygon" && z.area.coordinates?.length)
        .sort((a, b) => b.id - a.id)[0];

      if (!latest?.area) {
        showToast("Nenhum polígono encontrado no banco.", "error");
        return;
      }

      const draw = drawRef.current;
      draw?.deleteAll();
      draw?.add({
        type: "Feature",
        properties: {},
        geometry: latest.area,
      });

      renderSavedPolygon(latest.area, { id: latest.id, nome: latest.nome });
      showToast(`Última área carregada: ${latest.nome}`);
    } catch {
      showToast("Não foi possível carregar o último polígono.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <MetaTag className="block mb-1">Mapa operacional</MetaTag>
          <p className="text-xs text-on-surface-variant">
            Use o ícone de polígono para desenhar a área no mapa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="secondary"
            icon="download"
            onClick={handleLoadLatest}
            disabled={loading || saving}
          >
            {loading ? "Carregando…" : "Último do banco"}
          </Btn>
          <Btn
            variant="primary"
            icon="save"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Salvando…" : "Salvar polígono"}
          </Btn>
        </div>
      </div>

      <div
        className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low w-full"
        style={{ height }}
      >
        <div ref={mapContainerRef} className="h-full w-full" />

        {loadedMeta && (
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="px-3 py-2 rounded-md bg-white/95 backdrop-blur-md shadow-ambient-sm flex items-center gap-2">
              <Icon name="map" className="text-secondary text-[18px]" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-mono text-on-surface-variant">
                  Última área exibida
                </p>
                <p className="text-[11px] font-bold text-primary">
                  #{loadedMeta.id} · {loadedMeta.nome}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────── DrawOnlyMap (reutilizável, sem load/save) ────────────── */

interface NeighborZone {
  id: number;
  nome: string;
  area: GeoJSON.Polygon;
}

interface DrawOnlyMapProps {
  height?: number;
  onPolygonChange: (polygon: PolygonGeometry | null) => void;
  neighborZones?: NeighborZone[];
}

export function DrawOnlyMap({ height = 420, onPolygonChange, neighborZones }: DrawOnlyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const autoFitDone = useRef(false);
  const { user } = useGardian();

  const [entityCenter, setEntityCenter] = useState<[number, number] | null>(null);
  const [entityArea, setEntityArea] = useState<GeoJSON.MultiPolygon | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  /* ── buscar área da entidade antes de criar o mapa ── */
  useEffect(() => {
    if (!user?.entidade) return;
    let cancelled = false;

    api
      .get<{ area: { id: number; area: GeoJSON.MultiPolygon } }>(
        "/entidades/areas/",
      )
      .then((res) => {
        if (cancelled) return;
        const area = res.data.area.area;
        setEntityArea(area);
        setEntityCenter(getMultiPolygonCenter(area));
        setDataLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setEntityCenter([-39.5, -16.0]);
          setDataLoaded(true);
        }
      });

    return () => { cancelled = true; };
  }, [user?.entidade]);

  /* ── iniciar o mapa (após dataLoaded) ── */
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current || !dataLoaded || !entityCenter) return;

    patchDrawForMapLibre(MapboxDraw);

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: entityCenter,
      zoom: 11,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    let disposed = false;

    const resizeMap = () => {
      if (!disposed) map.resize();
    };

    const resizeObserver = new ResizeObserver(() => resizeMap());
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeMap);

    const onMapLoad = () => {
      resizeMap();

      // Add municipal boundary (no flyTo — let neighborZones handle Show All)
      if (entityArea) addBoundaryLayer(map, entityArea);

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: "draw_polygon",
        styles: [...MAPLIBRE_DRAW_STYLES],
      });

      map.addControl(draw as unknown as maplibregl.IControl, "top-left");
      drawRef.current = draw;

      const update = () => {
        const collection = draw.getAll();
        const feature = collection.features.find((f) => f.geometry?.type === "Polygon");
        if (feature && feature.geometry.type === "Polygon") {
          onPolygonChange({
            type: "Polygon",
            coordinates: feature.geometry.coordinates as number[][][],
          });
        } else {
          onPolygonChange(null);
        }
      };

      map.on("draw.create", (e) => {
        // remove polígonos antigos, mantém só o que acabou de ser desenhado
        const all = draw.getAll().features;
        const polys = all.filter((f) => f.geometry?.type === "Polygon");
        if (polys.length > 1) {
          const toRemove = polys
            .filter((f) => f.id !== e.features[0]?.id)
            .map((f) => f.id)
            .filter(Boolean) as string[];
          if (toRemove.length > 0) draw.delete(toRemove);
        }
        update();
      });
      map.on("draw.update", update);
      map.on("draw.delete", () => onPolygonChange(null));
    };

    map.on("load", onMapLoad);
    mapRef.current = map;
    requestAnimationFrame(resizeMap);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      drawRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [dataLoaded, entityCenter, entityArea, onPolygonChange]);

  /* renderizar zonas vizinhas (cinza) quando neighborZones mudar */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !neighborZones || neighborZones.length === 0) return;

    const apply = () => {
      const NEIGHBOR_SOURCE = "neighbor-zones";
      const NEIGHBOR_FILL = "neighbor-zones-fill";
      const NEIGHBOR_LINE = "neighbor-zones-line";
      const NEIGHBOR_LABEL = "neighbor-zones-label";

      // limpar layers anteriores
      for (const id of [NEIGHBOR_LABEL, NEIGHBOR_LINE, NEIGHBOR_FILL]) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ok */ }
      }
      try { if (map.getSource(NEIGHBOR_SOURCE)) map.removeSource(NEIGHBOR_SOURCE); } catch { /* ok */ }

      const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
      const centroids: GeoJSON.Feature<GeoJSON.Point>[] = [];

      for (const z of neighborZones) {
        const ring = z.area.coordinates[0];
        const isDeg = ring.every((c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]));
        if (isDeg) continue;

        features.push({
          type: "Feature",
          properties: { nome: z.nome },
          geometry: z.area,
        });

        const cx = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const cy = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        centroids.push({
          type: "Feature",
          properties: { nome: z.nome },
          geometry: { type: "Point", coordinates: [cx, cy] },
        });
      }

      if (features.length === 0) return;

      map.addSource(NEIGHBOR_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      map.addLayer({
        id: NEIGHBOR_FILL,
        type: "fill",
        source: NEIGHBOR_SOURCE,
        paint: { "fill-color": "#888", "fill-opacity": 0.15 },
      });

      map.addLayer({
        id: NEIGHBOR_LINE,
        type: "line",
        source: NEIGHBOR_SOURCE,
        paint: { "line-color": "#888", "line-width": 1.5, "line-dasharray": [3, 2] },
      });

      if (centroids.length > 0) {
        try { if (map.getSource("neighbor-centroids")) map.removeSource("neighbor-centroids"); } catch { /* ok */ }

        map.addSource("neighbor-centroids", {
          type: "geojson",
          data: { type: "FeatureCollection", features: centroids },
        });

        map.addLayer({
          id: NEIGHBOR_LABEL,
          type: "symbol",
          source: "neighbor-centroids",
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
        });
      }

      // dar zoom para caber todas as zonas (só na primeira vez)
      if (!autoFitDone.current) {
        autoFitDone.current = true;
        const bounds = features.reduce((b, f) => {
          const coords = f.geometry.coordinates[0];
          const lons = coords.map((c) => c[0]);
          const lats = coords.map((c) => c[1]);
          const fb = new maplibregl.LngLatBounds(
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          );
          return b ? b.extend(fb) : fb;
        }, null as maplibregl.LngLatBounds | null);

        if (bounds) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return () => {
      for (const id of ["neighbor-zones-label", "neighbor-zones-line", "neighbor-zones-fill"]) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ok */ }
      }
      try { if (map.getSource("neighbor-zones")) map.removeSource("neighbor-zones"); } catch { /* ok */ }
      try { if (map.getSource("neighbor-centroids")) map.removeSource("neighbor-centroids"); } catch { /* ok */ }
    };
  }, [neighborZones]);

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low w-full"
      style={{ height }}
    >
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
