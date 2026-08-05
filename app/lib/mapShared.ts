"use client";

import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";

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

/* ─────────── polygon helpers ─────────── */

function closeRing(ring: number[][]) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
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

/** Compute the center of a MultiPolygon from its bounding box. */
export function getMultiPolygonCenter(
  mp: GeoJSON.MultiPolygon,
): [number, number] {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const polygon of mp.coordinates) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
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

/* ─────────── linha pontilhada (limite municipal) ─────────── */

const BOUNDARY_SOURCE_ID = "municipal-boundary";
const BOUNDARY_LINE_ID = "municipal-boundary-line";

/**
 * Add a dashed line layer for the municipal boundary.
 * @param map   The MapLibre instance.
 * @param area  A MultiPolygon GeoJSON geometry (the Entidade.area from the backend).
 */
export function addBoundaryLayer(
  map: maplibregl.Map,
  area: GeoJSON.MultiPolygon,
) {
  if (map.getSource(BOUNDARY_SOURCE_ID)) return;

  map.addSource(BOUNDARY_SOURCE_ID, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: area,
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
