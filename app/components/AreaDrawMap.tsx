"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import {
  PORTO_SEGURO_BBOX,
  PORTO_SEGURO_BOUNDARY,
} from "@/app/data/portoSeguroBoundary";
import { MAPLIBRE_DRAW_STYLES } from "@/app/lib/maplibreDrawStyles";

import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type ZonaAreaRecord = {
  id: number;
  nome: string;
  area?: PolygonGeometry | null;
};

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto",
      type: "raster",
      source: "carto",
    },
  ],
};

const SAVED_SOURCE_ID = "saved-polygon";
const SAVED_FILL_ID = "saved-polygon-fill";
const SAVED_LINE_ID = "saved-polygon-line";
const BOUNDARY_SOURCE_ID = "municipal-boundary";
const BOUNDARY_LINE_ID = "municipal-boundary-line";

function closeRing(ring: number[][]) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function boundaryToPolygon(): PolygonGeometry {
  const ring = closeRing(PORTO_SEGURO_BOUNDARY.map(([lon, lat]) => [lon, lat]));
  return { type: "Polygon", coordinates: [ring] };
}

function addBoundaryLayer(map: maplibregl.Map) {
  if (map.getSource(BOUNDARY_SOURCE_ID)) return;

  map.addSource(BOUNDARY_SOURCE_ID, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: boundaryToPolygon(),
    },
  });

  map.addLayer({
    id: BOUNDARY_LINE_ID,
    type: "line",
    source: BOUNDARY_SOURCE_ID,
    paint: {
      "line-color": "#051125",
      "line-width": 1.5,
      "line-dasharray": [2, 2],
    },
  });
}

function createMap(
  container: HTMLDivElement,
  center: [number, number],
) {
  return new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center,
    zoom: 11,
    attributionControl: { compact: true },
  });
}

function patchDrawForMapLibre() {
  const classes = MapboxDraw.constants.classes as Record<string, string>;
  classes.CANVAS = "maplibregl-canvas";
  classes.CONTROL_BASE = "maplibregl-ctrl";
  classes.CONTROL_PREFIX = "maplibregl-ctrl-";
  classes.CONTROL_GROUP = "maplibregl-ctrl-group";
  classes.ATTRIBUTION = "maplibregl-ctrl-attrib";
}

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

    patchDrawForMapLibre();

    const centerLon = (PORTO_SEGURO_BBOX.west + PORTO_SEGURO_BBOX.east) / 2;
    const centerLat = (PORTO_SEGURO_BBOX.south + PORTO_SEGURO_BBOX.north) / 2;
    const center: [number, number] = [centerLon, centerLat];

    const map = createMap(container, center);
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
      addBoundaryLayer(map);
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
