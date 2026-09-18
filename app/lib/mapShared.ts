"use client";

import maplibregl from "maplibre-gl";

/* ─────────── estilo do mapa (openfreemap vector tiles) ─────────── */

export const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron",
  bright: "https://tiles.openfreemap.org/styles/bright",
} as const;

export const MAP_STYLE: string =
  process.env.NEXT_PUBLIC_MAP_STYLE || OPENFREEMAP_STYLES.positron;

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
  let minLon = Infinity,
    maxLon = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;
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

/* ─────────── limpa camadas ruidosas do basemap ─────────── */

export function declutterBasemap(map: maplibregl.Map): void {
  const style = map.getStyle();
  if (!style || !style.layers) return;

  for (const layer of style.layers) {
    // oculta pontos de interesse comerciais e caminhos pedestres
    if (layer.id.startsWith("poi_") || layer.id === "highway-name-path") {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch {
        // ignora camadas que nao permitam alteracao de layout
      }
    } else if (layer.id === "highway-name-minor") {
      // suaviza nomes de ruas residenciais para nao competir com as zonas
      try {
        map.setPaintProperty(layer.id, "text-opacity", 0.35);
      } catch {
        // ignora
      }
    } else if (layer.id === "highway-name-major") {
      // suaviza nomes de vias principais
      try {
        map.setPaintProperty(layer.id, "text-opacity", 0.45);
      } catch {
        // ignora
      }
    }
  }
}

/* ─────────── factory do mapa ─────────── */

export function createMap(
  container: HTMLDivElement,
  center: [number, number],
): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: MAP_STYLE,
    center,
    zoom: 11,
    attributionControl: { compact: true },
  });

  map.on("style.load", () => {
    declutterBasemap(map);
  });

  return map;
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

/* ─────────── pills em webgl para rotulos de zonas ─────────── */

export const PILL_IMAGE_ACTIVE = "pill-badge-active";
export const PILL_IMAGE_MUTED = "pill-badge-muted";

export const DEFAULT_CENTROIDS_SOURCE_ID = "zone-centroids-source";
export const DEFAULT_CENTROIDS_LAYER_ID = "zone-centroids-layer";

export interface ZoneCentroidItem {
  id: number;
  nome: string;
  area?: GeoJSON.Polygon | null;
  status?: string;
}

export interface ZoneCentroidPillOptions {
  sourceId?: string;
  layerId?: string;
  greyedOut?: boolean;
  beforeId?: string;
}

function drawPillCanvas(
  fillColor: string,
  strokeColor?: string,
  strokeWidth = 1,
): ImageData | null {
  if (typeof document === "undefined") return null;

  const width = 48;
  const height = 24;
  const radius = 12;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  const x = strokeWidth / 2;
  const y = strokeWidth / 2;
  const w = width - strokeWidth;
  const h = height - strokeWidth;
  const r = radius - strokeWidth / 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, width, height);
}

export function ensurePillImages(map: maplibregl.Map): void {
  if (typeof document === "undefined") return;

  if (!map.hasImage(PILL_IMAGE_ACTIVE)) {
    const active = drawPillCanvas("#009ea0", "#007d7f", 1.2);
    if (active) {
      map.addImage(PILL_IMAGE_ACTIVE, active, {
        stretchX: [[14, 34]],
        stretchY: [[7, 17]],
      });
    }
  }

  if (!map.hasImage(PILL_IMAGE_MUTED)) {
    const muted = drawPillCanvas("#5b9597", "#4a787a", 1);
    if (muted) {
      map.addImage(PILL_IMAGE_MUTED, muted, {
        stretchX: [[14, 34]],
        stretchY: [[7, 17]],
      });
    }
  }
}

export function addZoneCentroidPills(
  map: maplibregl.Map,
  zones: ZoneCentroidItem[],
  options: ZoneCentroidPillOptions = {},
): void {
  const {
    sourceId = DEFAULT_CENTROIDS_SOURCE_ID,
    layerId = DEFAULT_CENTROIDS_LAYER_ID,
    greyedOut = false,
    beforeId,
  } = options;

  ensurePillImages(map);

  const features: GeoJSON.Feature<GeoJSON.Point>[] = zones
    .filter((z) => z.area && z.area.coordinates && z.area.coordinates.length > 0)
    .map((z) => {
      const bounds = getPolygonBounds(z.area!);
      const center = bounds.getCenter();
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [center.lng, center.lat],
        },
        properties: {
          id: z.id,
          nome: z.nome,
          status: z.status,
        },
      };
    });

  const sourceData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features,
  };

  const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existingSource && typeof existingSource.setData === "function") {
    existingSource.setData(sourceData);
    if (map.getLayer(layerId)) {
      return;
    }
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: sourceData,
    });
  }

  const iconName = greyedOut ? PILL_IMAGE_MUTED : PILL_IMAGE_ACTIVE;
  const textColor = "#FFFFFF";
  const textOpacity = greyedOut ? 0.8 : 1.0;
  const iconOpacity = greyedOut ? 0.6 : 1.0;
  const textSize = greyedOut ? 10 : 11;

  // insere antes de beforeId se a camada de referencia existir no mapa
  const validBeforeId = beforeId && map.getLayer(beforeId) ? beforeId : undefined;

  map.addLayer(
    {
      id: layerId,
      type: "symbol",
      source: sourceId,
      layout: {
        "icon-image": iconName,
        "icon-text-fit": "both",
        "icon-text-fit-padding": greyedOut ? [2, 6, 2, 6] : [3, 8, 3, 8],
        "text-field": ["get", "nome"],
        "text-size": textSize,
        "text-font": ["Noto Sans Bold", "Open Sans Bold", "Arial Unicode MS Bold"],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.05,
        "text-allow-overlap": false,
        "icon-allow-overlap": false,
      },
      paint: {
        "text-color": textColor,
        "text-opacity": textOpacity,
        "icon-opacity": iconOpacity,
      },
    },
    validBeforeId,
  );
}

export function removeZoneCentroidPills(
  map: maplibregl.Map,
  sourceId = DEFAULT_CENTROIDS_SOURCE_ID,
  layerId = DEFAULT_CENTROIDS_LAYER_ID,
): void {
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {
    // ignora se nao existir
  }
}
