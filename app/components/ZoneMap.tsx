"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Btn, Icon } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";
import {
  createMap,
  patchDrawForMapLibre,
  addBoundaryLayer,
  addPolygonLayer,
  removePolygonLayer,
  getPolygonBounds,
  MUNICIPIO_CENTER,
  ZONE_STATUS_COLORS,
  DEFAULT_ZONE_COLOR,
} from "@/app/lib/mapShared";
import { MAPLIBRE_DRAW_STYLES } from "@/app/lib/maplibreDrawStyles";

import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

/* ────────────── Types ────────────── */

export interface ZoneData {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
  area: GeoJSON.Polygon | null;
}

type ZoneMapMode = "loading" | "view" | "edit";

interface ZoneDetailResponse {
  zonas: ZoneData;
  eventos: unknown[];
}

/* ────────────── Props ────────────── */

interface ZoneMapProps {
  zoneId: number | string;
  zoneName?: string;
  height?: number;
  editable?: boolean;
  onSave?: (zone: ZoneData) => void;
}

/* ────────────── Labels ────────────── */


/* ────────────── Component ────────────── */

export function ZoneMap({
  zoneId,
  zoneName: _zoneName,
  height = 450,
  editable = false,
  onSave,
}: ZoneMapProps) {
  /* ── refs ── */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  /* ── state ── */
  const [mode, setMode] = useState<ZoneMapMode>("loading");
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "secondary" } | null>(null);

  const showToast = useCallback((msg: string, tone: "error" | "secondary" = "secondary") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── pegar dados da zona ── */
  useEffect(() => {
    let cancelled = false;

    api
      .get<ZoneDetailResponse>(`/zonas/${zoneId}/`)
      .then((res) => {
        if (!cancelled) {
          setZoneData(res.data.zonas);
          setMode("view");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar a zona.");
          setMode("view");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  /* ── renderizar poligono em view mode ── */
  const renderZonePolygon = useCallback(
    (map: maplibregl.Map, data: ZoneData) => {
      if (!data.area) return;

      const ring = data.area.coordinates[0];
      const isDegenerate = ring.every(
        (c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]),
      );
      if (isDegenerate) return;

      const colors =
        ZONE_STATUS_COLORS[data.status] ?? DEFAULT_ZONE_COLOR;

      addPolygonLayer(
        map,
        "zone",
        data.area,
        colors.fill,
        colors.stroke,
        colors.fillOpacity,
      );

      map.fitBounds(getPolygonBounds(data.area), {
        padding: 48,
        maxZoom: 14,
        duration: 600,
      });
    },
    [],
  );

  /* ── iniciar o mapa (uma vez só) ── */
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    patchDrawForMapLibre(MapboxDraw);

    const map = createMap(container, MUNICIPIO_CENTER);
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    let disposed = false;

    const resizeMap = () => {
      if (!disposed) map.resize();
    };

    const resizeObserver = new ResizeObserver(() => resizeMap());
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeMap);

    map.on("load", () => {
      resizeMap();
      addBoundaryLayer(map);
    });

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

  /* ── reagir a mudanças em zonaData (view mode) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zoneData || mode !== "view") return;

    const apply = () => {
      renderZonePolygon(map, zoneData);
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return () => {
      removePolygonLayer(map, "zone");
    };
  }, [zoneData, mode, renderZonePolygon]);

  /* ── edit mode ── */
  const enterEditMode = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // remover polígono
    removePolygonLayer(map, "zone");

    // começar o draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: zoneData?.area ? "simple_select" : "draw_polygon",
      styles: MAPLIBRE_DRAW_STYLES as unknown as Record<string, unknown>[],
    });

    map.addControl(draw as unknown as maplibregl.IControl, "top-left");

    // preencher com polígono existente (se houver)
    if (zoneData?.area) {
      const ring = zoneData.area.coordinates[0];
      const isDegenerate = ring.every(
        (c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]),
      );
      if (!isDegenerate) {
        draw.add({
          type: "Feature",
          properties: {},
          geometry: zoneData.area,
        });
      }
    }

    drawRef.current = draw;
    setMode("edit");
  }, [zoneData]);

  /* ── sair do edit mode ── */
  const exitEditMode = useCallback(() => {
    const map = mapRef.current;
    const draw = drawRef.current;

    if (map && draw) {
      map.removeControl(draw as unknown as maplibregl.IControl);
    }
    drawRef.current = null;
    setMode("view");
    // useEffect para quando voltar para view mode, o polígono será renderizado novamente
  }, []);

  /* ── salvar polígono editado ── */
  const handleSave = useCallback(async () => {
    const draw = drawRef.current;
    if (!draw) return;

    const collection = draw.getAll();
    const polygonFeatures = collection.features.filter(
      (f): f is GeoJSON.Feature<GeoJSON.Polygon> =>
        f.geometry?.type === "Polygon",
    );
    const polygonFeature = polygonFeatures[polygonFeatures.length - 1];

    if (!polygonFeature) {
      showToast("Desenhe um polígono antes de salvar.", "error");
      return;
    }

    // rejeitar polígono "degenerado" (todos os pontos iguais)
    const ring = polygonFeature.geometry.coordinates[0];
    const isDegenerate = ring.every(
      (c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]),
    );
    if (isDegenerate) {
      showToast("Polígono inválido — todos os pontos são iguais.", "error");
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch<ZoneData>(`/zonas/${zoneId}/`, {
        area: polygonFeature.geometry,
      });

      // remover draw do mapa
      const map = mapRef.current;
      if (map && draw) {
        map.removeControl(draw as unknown as maplibregl.IControl);
      }
      drawRef.current = null;

      setZoneData(res.data);
      setMode("view");
      showToast("Área da zona atualizada.");
      onSave?.(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      const msg =
        axiosErr?.response?.status === 400
          ? "Formato de polígono inválido. Verifique se o polígono é válido."
          : "Erro ao salvar a zona.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [zoneId, showToast, onSave]);

  /* ── label (só em view mode) ── */
  const zoneLabel = zoneData?.nome ?? _zoneName ?? `Zona #${zoneId}`;

  /* ── render ── */

  return (
    <div className="flex flex-col">
      {/* map container */}
      <div
        className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low w-full"
        style={{ height }}
      >
        {/* loading state */}
        {mode === "loading" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-container-low/80">
            <p className="text-sm text-on-surface-variant font-medium">
              Carregando mapa…
            </p>
          </div>
        )}

        {/* map DOM container */}
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* overlay do botão de edição view-mode */}
        {mode === "view" && editable && zoneData?.area && (
          <div className="absolute top-2 right-12 z-10">
            <Btn variant="primary" icon="map_edit" onClick={enterEditMode}>
              Editar Zona
            </Btn>
          </div>
        )}
        {mode === "view" && editable && !zoneData?.area && (
          <div className="absolute top-2 right-12 z-10">
            <Btn variant="primary" icon="draw" onClick={enterEditMode}>
              Definir Área
            </Btn>
          </div>
        )}

        {/* overlay dos botões de salvar/cancelar edit-mode */}
        {mode === "edit" && editable && (
          <div className="absolute top-2 right-12 z-10 flex gap-2">
            <Btn variant="secondary" icon="close" onClick={exitEditMode} disabled={saving}>
              Cancelar
            </Btn>
            <Btn variant="primary" icon="save" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar Alterações"}
            </Btn>
          </div>
        )}

        {/* overlay label da zona */}
        {mode === "view" && zoneData?.area && (
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="px-3 py-2 rounded-md bg-white/95 backdrop-blur-md shadow-ambient-sm flex items-center gap-2">
              <Icon name="map" className="text-secondary text-[18px]" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-mono text-on-surface-variant">
                  Área
                </p>
                <p className="text-[11px] font-bold text-primary">
                  {zoneLabel}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* placeholder quando não tem área */}
        {mode === "view" && !zoneData?.area && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <Icon
              name="map"
              className="text-on-surface-variant text-[48px] mb-3"
            />
            <p className="text-sm text-on-surface-variant font-medium">
              Nenhuma área definida para esta zona.
            </p>
          </div>
        )}

        {/* error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Icon
              name="error_outline"
              className="text-error text-[48px] mb-3"
            />
            <p className="text-sm text-error font-medium">{error}</p>
          </div>
        )}

        {/* legenda */}
        {mode === "view" && zoneData?.area && (
          <div className="absolute bottom-10 right-3.25 z-10 pointer-events-none">
            <div className="px-3 py-2 rounded-md bg-white/95 backdrop-blur-md shadow-ambient-sm">
              <p className="text-[9px] font-black uppercase tracking-mono text-on-surface-variant mb-1.5">
                Legenda
              </p>
              <div className="space-y-1">
                {[
                  {
                    color: "#006A60",
                    label: "Limite municipal",
                    dashed: true,
                  },
                  {
                    color: "#BA1A1A",
                    label: "Crítico",
                    dashed: false,
                    hasBg: true,
                  },
                  {
                    color: "#C2570B",
                    label: "Atenção",
                    dashed: false,
                    hasBg: true,
                  },
                  {
                    color: "#006A60",
                    label: "Estável",
                    dashed: false,
                    hasBg: true,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 shrink-0 ${
                        item.dashed
                          ? "border-2 border-dashed rounded-sm"
                          : "rounded-sm"
                      }`}
                      style={{
                        borderColor: item.dashed ? item.color : undefined,
                        backgroundColor: item.hasBg
                          ? `${item.color}55`
                          : "transparent",
                      }}
                    />
                    <span className="text-[10px] font-bold text-on-surface">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* notificação */}
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div
              className={`px-4 py-2 rounded-lg shadow-ambient flex items-center gap-2 ${
                toast.tone === "error" ? "bg-error text-white" : "bg-secondary text-white"
              }`}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {toast.tone === "error" ? "error" : "check_circle"}
              </span>
              <span className="text-xs font-bold">{toast.msg}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
