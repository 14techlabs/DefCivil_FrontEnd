"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { PORTO_SEGURO_BBOX } from "@/app/data/portoSeguroBoundary";
import { MAP_STYLE } from "@/app/lib/mapShared";

import "maplibre-gl/dist/maplibre-gl.css";

/* ───────────── types ───────────── */

interface CoordsPickerMapProps {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  height?: number;
}

/* ───────────── componente ───────────── */

export function CoordsPickerMap({ lat, lng, onChange, height = 200 }: CoordsPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const isDragging = useRef(false);

  const centerLon = (PORTO_SEGURO_BBOX.west + PORTO_SEGURO_BBOX.east) / 2;
  const centerLat = (PORTO_SEGURO_BBOX.south + PORTO_SEGURO_BBOX.north) / 2;

  // inicializar mapa (uma vez)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [centerLon, centerLat],
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

      // marcador padrão, visível só quando lat/lng forem válidos
      const el = document.createElement("div");
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:28px;color:#BA1A1A;font-variation-settings:'FILL' 1">location_on</span>`;
      el.style.cursor = "grab";
      el.style.transform = "translate(-50%, -100%)";

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([centerLon, centerLat])
        .addTo(map);

      marker.on("dragstart", () => { isDragging.current = true; });
      marker.on("dragend", () => {
        isDragging.current = false;
        const pos = marker.getLngLat();
        onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
      });

      markerRef.current = marker;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sincronizar marcador quando lat/lng mudarem por input externo
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      const pos = marker.getLngLat();
      // só move se a diferença for significativa e não vier do próprio drag
      if (
        !isDragging.current &&
        (Math.abs(pos.lat - parsedLat) > 0.0001 ||
          Math.abs(pos.lng - parsedLng) > 0.0001)
      ) {
        marker.setLngLat([parsedLng, parsedLat]);
      }
    }
  }, [lat, lng]);

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low"
      style={{ height }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
