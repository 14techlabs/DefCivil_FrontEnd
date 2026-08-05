"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  MAP_STYLE,
  addBoundaryLayer,
  getMultiPolygonCenter,
} from "@/app/lib/mapShared";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";

import "maplibre-gl/dist/maplibre-gl.css";

/* ───────────── types ───────────── */

interface CoordsPickerMapProps {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  height?: number;
  /** Zone list for name lookup when auto-detecting. */
  zonas?: { id: number; nome: string }[];
  /** Fired when the marker position changes which zone(s) it overlaps. */
  onZoneDetect?: (ids: number[]) => void;
}

/* ───────────── point-in-polygon ───────────── */

function pointInPolygon(
  lng: number,
  lat: number,
  coordinates: number[][][],
): boolean {
  const ring = coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function getMultiPolygonBounds(mp: GeoJSON.MultiPolygon): maplibregl.LngLatBounds {
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
  return new maplibregl.LngLatBounds([minLon, minLat], [maxLon, maxLat]);
}

function polygonBounds(polygon: GeoJSON.Polygon): maplibregl.LngLatBounds {
  const ring = polygon.coordinates[0];
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return new maplibregl.LngLatBounds([minLon, minLat], [maxLon, maxLat]);
}

function polygonCentroid(polygon: GeoJSON.Polygon): [number, number] {
  const ring = polygon.coordinates[0];
  let cx = 0, cy = 0;
  for (const [lon, lat] of ring) { cx += lon; cy += lat; }
  return [cx / ring.length, cy / ring.length];
}

/* ───────────── componente ───────────── */

export function CoordsPickerMap({
  lat, lng, onChange, height = 200,
  zonas: zonasNames, onZoneDetect,
}: CoordsPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const isDragging = useRef(false);
  const { user } = useGardian();
  const onChangeRef = useRef(onChange);
  const onZoneDetectRef = useRef(onZoneDetect);
  const zonasNamesRef = useRef(zonasNames);
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  onChangeRef.current = onChange;
  onZoneDetectRef.current = onZoneDetect;
  zonasNamesRef.current = zonasNames;
  latRef.current = lat;
  lngRef.current = lng;

  // Store fetched zone polygons for point-in-polygon detection
  const zonePolygonsRef = useRef<Map<number, GeoJSON.Polygon>>(new Map());

  const [entityCenter, setEntityCenter] = useState<[number, number] | null>(null);
  const [entityArea, setEntityArea] = useState<GeoJSON.MultiPolygon | null>(null);
  const [loaded, setLoaded] = useState(false);

  const detectZones = useCallback((lngVal: number, latVal: number) => {
    const found: number[] = [];
    zonePolygonsRef.current.forEach((polygon, id) => {
      if (pointInPolygon(lngVal, latVal, polygon.coordinates)) {
        found.push(id);
      }
    });
    onZoneDetectRef.current?.(found);
  }, []);

  /* ── buscar dados da entidade ── */
  useEffect(() => {
    if (!user?.entidade) return;
    let cancelled = false;

    api
      .get<{
        area: { id: number; area: GeoJSON.MultiPolygon };
        zonas: { id: number; area: GeoJSON.Polygon | null }[];
      }>("/entidades/areas/")
      .then((res) => {
        if (cancelled) return;
        const { area, zonas } = res.data;
        setEntityArea(area.area);
        setEntityCenter(getMultiPolygonCenter(area.area));

        // Store zone polygons for detection
        const zonePolys = new Map<number, GeoJSON.Polygon>();
        for (const z of zonas) {
          if (!z.area || !z.area.coordinates?.length) continue;
          const ring = z.area.coordinates[0];
          const isDeg = ring.every(
            (c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]),
          );
          if (isDeg) continue;
          zonePolys.set(z.id, z.area);
        }
        zonePolygonsRef.current = zonePolys;
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setEntityCenter([-39.5, -16.0]);
          setLoaded(true);
        }
      });

    return () => { cancelled = true; };
  }, [user?.entidade]);

  /* ── inicializar mapa (após loaded) ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || !loaded || !entityCenter) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: entityCenter,
      zoom: 11,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    let disposed = false;
    const resize = () => { if (!disposed) map.resize(); };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    window.addEventListener("resize", resize);

    map.on("load", () => {
      resize();

      // Add municipal boundary
      if (entityArea) addBoundaryLayer(map, entityArea);

      // Render zones as grey polygons with centroids
      const NEIGHBOR_SOURCE = "picker-zone-polys";
      const NEIGHBOR_FILL = "picker-zone-fill";
      const NEIGHBOR_LINE = "picker-zone-line";
      const NEIGHBOR_LABEL = "picker-zone-label";

      const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
      const centroids: GeoJSON.Feature<GeoJSON.Point>[] = [];

      zonePolygonsRef.current.forEach((poly, id) => {
        const nome = zonasNamesRef.current?.find((z) => z.id === id)?.nome ?? `Zona #${id}`;
        const [cx, cy] = polygonCentroid(poly);
        features.push({
          type: "Feature",
          properties: { nome },
          geometry: poly,
        });
        centroids.push({
          type: "Feature",
          properties: { nome },
          geometry: { type: "Point", coordinates: [cx, cy] },
        });
      });

      if (features.length > 0) {
        map.addSource(NEIGHBOR_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });

        map.addLayer({
          id: NEIGHBOR_FILL,
          type: "fill",
          source: NEIGHBOR_SOURCE,
          paint: { "fill-color": "#888", "fill-opacity": 0.12 },
        });

        map.addLayer({
          id: NEIGHBOR_LINE,
          type: "line",
          source: NEIGHBOR_SOURCE,
          paint: { "line-color": "#888", "line-width": 1.2, "line-dasharray": [3, 2] },
        });

        map.addSource("picker-centroids", {
          type: "geojson",
          data: { type: "FeatureCollection", features: centroids },
        });

        map.addLayer({
          id: NEIGHBOR_LABEL,
          type: "symbol",
          source: "picker-centroids",
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

      // "Show All" — fit to combined entity + zone bounds
      if (entityArea) {
        const bounds = getMultiPolygonBounds(entityArea);
        zonePolygonsRef.current.forEach((poly) => {
          bounds.extend(polygonBounds(poly));
        });
        map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 800 });
      }

      // Marker at entity center
      const el = document.createElement("div");
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:28px;color:#BA1A1A;font-variation-settings:'FILL' 1">location_on</span>`;
      el.style.cursor = "grab";
      el.style.transform = "translate(-50%, -100%)";

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(entityCenter)
        .addTo(map);

      marker.on("dragstart", () => { isDragging.current = true; });
      marker.on("dragend", () => {
        isDragging.current = false;
        const pos = marker.getLngLat();
        onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
        detectZones(pos.lng, pos.lat);
      });

      markerRef.current = marker;

      // posiciona o marcador nas coordenadas iniciais (modo edição)
      const initialLat = parseFloat(latRef.current);
      const initialLng = parseFloat(lngRef.current);
      if (!isNaN(initialLat) && !isNaN(initialLng)) {
        marker.setLngLat([initialLng, initialLat]);
        detectZones(initialLng, initialLat);
      }
    });

    mapRef.current = map;
    requestAnimationFrame(resize);

    return () => {
      disposed = true;
      ro.disconnect();
      window.removeEventListener("resize", resize);
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [loaded, entityCenter, entityArea]);

  // sincronizar marcador quando lat/lng mudarem por input externo
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      const pos = marker.getLngLat();
      if (
        !isDragging.current &&
        (Math.abs(pos.lat - parsedLat) > 0.0001 ||
          Math.abs(pos.lng - parsedLng) > 0.0001)
      ) {
        marker.setLngLat([parsedLng, parsedLat]);
        detectZones(parsedLng, parsedLat);
      }
    }
  }, [lat, lng, detectZones]);

  if (!loaded) {
    return (
      <div
        className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-xs text-on-surface-variant font-medium">Carregando mapa…</span>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low"
      style={{ height }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
