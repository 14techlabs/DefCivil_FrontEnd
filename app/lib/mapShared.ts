"use client";

import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import {
  PORTO_SEGURO_BOUNDARY,
  PORTO_SEGURO_BBOX,
} from "@/app/data/portoSeguroBoundary";

/* ─────────── estilo do map (raster CARTO tiles) ─────────── */

export const MAP_STYLE: StyleSpecification = {
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

/* ─────────── centro do município ─────────── */

export const MUNICIPIO_CENTER: [number, number] = [
  (PORTO_SEGURO_BBOX.west + PORTO_SEGURO_BBOX.east) / 2,
  (PORTO_SEGURO_BBOX.south + PORTO_SEGURO_BBOX.north) / 2,
];

/* ─────────── polygon helpers ─────────── */

function closeRing(ring: number[][]) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

export function boundaryToPolygon(): GeoJSON.Polygon {
  const ring = closeRing(
    PORTO_SEGURO_BOUNDARY.map(([lon, lat]) => [lon, lat]),
  );
  return { type: "Polygon", coordinates: [ring] };
}

export function getPolygonBounds(
  geometry: GeoJSON.Polygon,
): maplibregl.LngLatBounds {
  const coords = geometry.coordinates[0];
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return new maplibregl.LngLatBounds(
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  );
}

/* ─────────── factory do mapa ─────────── */

export function createMap(
  container: HTMLDivElement,
  center: [number, number],
): maplibregl.Map {
  return new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center,
    zoom: 11,
    attributionControl: { compact: true },
  });
}

/* ─────────── fix MapboxGL-Draw CSS classes for MapLibre ─────────── */

export function patchDrawForMapLibre(MapboxDrawCtor: {
  constants: { classes: Record<string, string> };
}) {
  const cls = MapboxDrawCtor.constants.classes;
  cls.CANVAS = "maplibregl-canvas";
  cls.CONTROL_BASE = "maplibregl-ctrl";
  cls.CONTROL_PREFIX = "maplibregl-ctrl-";
  cls.CONTROL_GROUP = "maplibregl-ctrl-group";
  cls.ATTRIBUTION = "maplibregl-ctrl-attrib";
}

/* ─────────── linha pontilhada ─────────── */

const BOUNDARY_SOURCE_ID = "municipal-boundary";
const BOUNDARY_LINE_ID = "municipal-boundary-line";

export function addBoundaryLayer(map: maplibregl.Map) {
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

/* ─────────── preenchimento do polígono ─────────── */

const SOURCE_PREFIX = "zone-polygon";
const FILL_ID = (pfx: string) => `${pfx}-fill`;
const LINE_ID = (pfx: string) => `${pfx}-line`;

export function addPolygonLayer(
  map: maplibregl.Map,
  prefix: string,
  geometry: GeoJSON.Polygon,
  fillColor: string,
  strokeColor: string,
  fillOpacity = 0.25,
) {
  const sourceId = `${SOURCE_PREFIX}-${prefix}`;
  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry,
    });
    return;
  }

  map.addSource(sourceId, {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry },
  });

  map.addLayer({
    id: FILL_ID(prefix),
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": fillColor,
      "fill-opacity": fillOpacity,
    },
  });

  map.addLayer({
    id: LINE_ID(prefix),
    type: "line",
    source: sourceId,
    paint: {
      "line-color": strokeColor,
      "line-width": 2.5,
    },
  });
}

export function removePolygonLayer(map: maplibregl.Map, prefix: string) {
  const sourceId = `${SOURCE_PREFIX}-${prefix}`;
  try {
    if (map.getLayer(FILL_ID(prefix))) map.removeLayer(FILL_ID(prefix));
    if (map.getLayer(LINE_ID(prefix))) map.removeLayer(LINE_ID(prefix));
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {
    // layers may not exist — ignore
  }
}

/* ─────────── Zona status colors ─────────── */

export const ZONE_STATUS_COLORS: Record<
  string,
  { fill: string; stroke: string; fillOpacity: number }
> = {
  critico: {
    fill: "rgba(186,26,26,0.30)",
    stroke: "#BA1A1A",
    fillOpacity: 0.3,
  },
  atencao: {
    fill: "rgba(194,87,11,0.25)",
    stroke: "#C2570B",
    fillOpacity: 0.25,
  },
  estavel: {
    fill: "rgba(0,106,96,0.20)",
    stroke: "#006A60",
    fillOpacity: 0.2,
  },
};

export const DEFAULT_ZONE_COLOR = {
  fill: "rgba(0,106,96,0.20)",
  stroke: "#006A60",
  fillOpacity: 0.2,
};
