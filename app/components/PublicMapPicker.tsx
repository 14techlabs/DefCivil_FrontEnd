"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  MAP_STYLE,
  addBoundaryLayer,
  getMultiPolygonCenter,
} from "@/app/lib/mapShared";
import { api } from "@/app/services/Api";

import "maplibre-gl/dist/maplibre-gl.css";

/* ───────────── types ───────────── */

interface PublicMapPickerProps {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  height?: number;
  /** modo monodedicao: desenha apenas a area desta entidade e avisa se o pin sair dela */
  entidadeId?: number;
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

/* ray casting (mesma logica do CoordsPickerMap) */
function pontoEmPoligono(lng: number, lat: number, coordinates: number[][][]): boolean {
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

function pontoDentroDe(mp: GeoJSON.MultiPolygon | null, lng: number, lat: number): boolean {
  if (!mp) return true; // sem area carregada: nao bloqueia nem avisa
  for (const polygon of mp.coordinates) {
    if (pontoEmPoligono(lng, lat, polygon)) return true;
  }
  return false;
}

/* ───────────── componente ───────────── */

// versao publica (sem login): busca as areas das entidades e desenha os
// poligonos; sem entidadeId desenha todas (entidade resolvida no backend),
// com entidadeId desenha apenas a escolhida e avisa se o pin sair dela
export function PublicMapPicker({
  lat, lng, onChange, height = 200, entidadeId,
}: PublicMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const isDragging = useRef(false);
  const onChangeRef = useRef(onChange);
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  onChangeRef.current = onChange;
  latRef.current = lat;
  lngRef.current = lng;

  const [entityCenter, setEntityCenter] = useState<[number, number] | null>(null);
  const [entityArea, setEntityArea] = useState<GeoJSON.MultiPolygon | null>(null);
  const [entidadeNome, setEntidadeNome] = useState<string | null>(null);
  const [foraLimites, setForaLimites] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ── buscar areas (todas ou apenas a escolhida) ── */
  useEffect(() => {
    let cancelled = false;

    api
      .get<{ entidades: { id: number; nome: string; area: GeoJSON.MultiPolygon }[] }>(
        "/entidades/areas/publicas/",
      )
      .then((res) => {
        if (cancelled) return;
        const todas = res.data.entidades ?? [];
        const alvo = entidadeId
          ? todas.filter((e) => e.id === entidadeId)
          : todas;
        // junta os poligonos num unico MultiPolygon (layer unico)
        const areas = alvo
          .map((e) => e.area)
          .filter((a): a is GeoJSON.MultiPolygon => !!a);
        setEntidadeNome(entidadeId ? (alvo[0]?.nome ?? null) : null);
        if (areas.length > 0) {
          const merged: GeoJSON.MultiPolygon = {
            type: "MultiPolygon",
            coordinates: areas.flatMap((a) => a.coordinates),
          };
          setEntityArea(merged);
          setEntityCenter(getMultiPolygonCenter(merged));
        } else {
          setEntityArea(null);
          setEntityCenter([-39.5, -16.0]);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setEntityCenter([-39.5, -16.0]);
          setLoaded(true);
        }
      });

    return () => { cancelled = true; };
  }, [entidadeId]);

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

      // limite da entidade
      if (entityArea) {
        addBoundaryLayer(map, entityArea);
        map.fitBounds(getMultiPolygonBounds(entityArea), {
          padding: 40,
          maxZoom: 12,
          duration: 800,
        });
      }

      // marcador no centro da entidade
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
        setForaLimites(!pontoDentroDe(entityArea, pos.lng, pos.lat));
        onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
      });

      markerRef.current = marker;

      // posiciona o marcador nas coordenadas iniciais (modo edição)
      const initialLat = parseFloat(latRef.current);
      const initialLng = parseFloat(lngRef.current);
      if (!isNaN(initialLat) && !isNaN(initialLng)) {
        marker.setLngLat([initialLng, initialLat]);
        setForaLimites(!pontoDentroDe(entityArea, initialLng, initialLat));
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
      }
      setForaLimites(!pontoDentroDe(entityArea, parsedLng, parsedLat));
    }
  }, [lat, lng, entityArea]);

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
      {foraLimites && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-error text-on-error text-xs font-medium px-3 py-1.5 rounded-full shadow">
          Localização fora da área de {entidadeNome ?? "defesa civil escolhida"}
        </div>
      )}
    </div>
  );
}
