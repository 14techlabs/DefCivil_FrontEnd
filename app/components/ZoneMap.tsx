"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Btn, Icon } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";
import { KIND_META, type MapPoint } from "@/app/components/PointsMap";
import {
  createMap,
  patchDrawForMapLibre,
  addBoundaryLayer,
  addPolygonLayer,
  removePolygonLayer,
  getPolygonBounds,
  getMultiPolygonCenter,
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

interface NeighborZone {
  id: number;
  nome: string;
  area: GeoJSON.Polygon;
}

/* ────────────── Props ────────────── */

interface ZoneMapProps {
  zoneId: number | string;
  zoneName?: string;
  height?: number;
  editable?: boolean;
  onSave?: (zone: ZoneData) => void;
  // pins exibidos no mapa (ocorrências e pontos de apoio da zona)
  pontos?: MapPoint[];
  // pin selecionado na lista lateral → mapa foca nele
  pontoSelecionadoId?: string | number | null;
  // clique num pin do mapa → abre o detalhe na lista lateral
  onSelecionarPonto?: (ponto: MapPoint | null) => void;
}

interface PinEntry {
  marker: maplibregl.Marker;
  ponto: MapPoint;
}

/* ────────────── layer IDs das zonas vizinhas ────────────── */

const NEIGHBOR_SOURCE = "zone-neighbor-zones";
const NEIGHBOR_FILL = "zone-neighbor-fill";
const NEIGHBOR_LINE = "zone-neighbor-line";
const NEIGHBOR_CENTROIDS_SOURCE = "zone-neighbor-centroids";
const NEIGHBOR_LABEL = "zone-neighbor-label";

/* ────────────── helpers dos pins (estilos vêm do PointsMap) ────────────── */

function isDegenerateRing(ring: number[][]): boolean {
  return ring.every((c, i) => i === 0 || (c[0] === ring[0][0] && c[1] === ring[0][1]));
}

/* ────────────── Component ────────────── */

export function ZoneMap({
  zoneId,
  zoneName: _zoneName,
  height = 450,
  editable = false,
  onSave,
  pontos = [],
  pontoSelecionadoId = null,
  onSelecionarPonto,
}: ZoneMapProps) {
  /* ── refs ── */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const pinsRef = useRef<Map<string, PinEntry>>(new Map());
  const onSelecionarPontoRef = useRef(onSelecionarPonto);

  // mantém a callback atual sem recriar os pins a cada render
  useEffect(() => {
    onSelecionarPontoRef.current = onSelecionarPonto;
  });

  /* ── state ── */
  const [mode, setMode] = useState<ZoneMapMode>("loading");
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "secondary" } | null>(null);
  const [neighborZones, setNeighborZones] = useState<NeighborZone[]>([]);
  const { user } = useGardian();

  const [entityArea, setEntityArea] = useState<GeoJSON.MultiPolygon | null>(null);
  const [entityCenter, setEntityCenter] = useState<[number, number] | null>(null);
  const [dataReady, setDataReady] = useState(false);

  const showToast = useCallback((msg: string, tone: "error" | "secondary" = "secondary") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  // refs para valores que o efeito do mapa precisa sem recriar o mapa
  const zoneDataRef = useRef(zoneData);
  const modeRef = useRef(mode);
  const renderZonePolygonRef = useRef(renderZonePolygon);
  zoneDataRef.current = zoneData;
  modeRef.current = mode;
  renderZonePolygonRef.current = renderZonePolygon;

  /* ── buscar dados (entidade + zona) em paralelo antes de criar o mapa ── */
  useEffect(() => {
    if (!user?.entidade) return;
    let cancelled = false;

    Promise.all([
      api.get<{
        area: { id: number; area: GeoJSON.MultiPolygon };
        zonas: { id: number; nome: string; area: GeoJSON.Polygon | null }[];
      }>("/entidades/areas/"),
      api.get<ZoneDetailResponse>(`/zonas/${zoneId}/`),
    ])
      .then(([areaRes, zoneRes]) => {
        if (cancelled) return;
        const area = areaRes.data.area.area;
        setEntityArea(area);
        setEntityCenter(getMultiPolygonCenter(area));
        setZoneData(zoneRes.data.zonas);
        // zonas vizinhas (cinza): todas exceto a atual
        const currentId = Number(zoneId);
        const vizinhas = (areaRes.data.zonas ?? [])
          .filter(
            (z) =>
              z.id !== currentId &&
              z.area &&
              z.area.type === "Polygon" &&
              z.area.coordinates?.length > 0 &&
              !isDegenerateRing(z.area.coordinates[0]),
          )
          .map((z) => ({ id: z.id, nome: z.nome, area: z.area as GeoJSON.Polygon }));
        setNeighborZones(vizinhas);
        setMode("view");
        setDataReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        // If zone fetch failed, show error
        const isZoneError = err?.response?.config?.url?.includes("/zonas/");
        if (isZoneError) {
          setError("Não foi possível carregar a zona.");
          setMode("view");
          // Still set a default center so map can render
          setEntityCenter([-39.5, -16.0]);
          setDataReady(true);
        }
      });
    return () => { cancelled = true; };
  }, [zoneId, user?.entidade]);

  /* ── iniciar o mapa (uma vez, após dataReady) ── */
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current || !dataReady || !entityCenter) return;

    patchDrawForMapLibre(MapboxDraw);

    const map = createMap(container, entityCenter);
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

      // Add boundary layer
      if (entityArea) addBoundaryLayer(map, entityArea);

      // renderizar polígono se tiver dados (usa refs para evitar stale closure)
      if (zoneDataRef.current && modeRef.current === "view") {
        renderZonePolygonRef.current(map, zoneDataRef.current);
      }
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
  }, [dataReady, entityCenter, entityArea]);

  /* ── renderizar zonas vizinhas (cinza) como contexto espacial ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dataReady) return;

    const apply = () => {
      // limpa camadas anteriores se existirem
      for (const id of [NEIGHBOR_LABEL, NEIGHBOR_LINE, NEIGHBOR_FILL]) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ok */ }
      }
      for (const src of [NEIGHBOR_SOURCE, NEIGHBOR_CENTROIDS_SOURCE]) {
        try { if (map.getSource(src)) map.removeSource(src); } catch { /* ok */ }
      }

      if (neighborZones.length === 0) return;

      const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
      const centroids: GeoJSON.Feature<GeoJSON.Point>[] = [];

      for (const z of neighborZones) {
        const ring = z.area.coordinates[0];
        if (isDegenerateRing(ring)) continue;

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

      // insere as camadas abaixo do limite municipal (e da zona focada)
      const boundaryId = "municipal-boundary-line";
      const beforeId = map.getLayer(boundaryId) ? boundaryId : undefined;

      map.addSource(NEIGHBOR_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer(
        {
          id: NEIGHBOR_FILL,
          type: "fill",
          source: NEIGHBOR_SOURCE,
          paint: { "fill-color": "#888", "fill-opacity": 0.15 },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: NEIGHBOR_LINE,
          type: "line",
          source: NEIGHBOR_SOURCE,
          paint: { "line-color": "#888", "line-width": 1.5, "line-dasharray": [3, 2] },
        },
        beforeId,
      );
      map.addSource(NEIGHBOR_CENTROIDS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: centroids },
      });
      map.addLayer(
        {
          id: NEIGHBOR_LABEL,
          type: "symbol",
          source: NEIGHBOR_CENTROIDS_SOURCE,
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
        },
        beforeId,
      );
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return () => {
      for (const id of [NEIGHBOR_LABEL, NEIGHBOR_LINE, NEIGHBOR_FILL]) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ok */ }
      }
      for (const src of [NEIGHBOR_SOURCE, NEIGHBOR_CENTROIDS_SOURCE]) {
        try { if (map.getSource(src)) map.removeSource(src); } catch { /* ok */ }
      }
    };
  }, [neighborZones, dataReady]);

  /* ── pins do mapa (ocorrências e pontos de apoio da zona; ocultos no edit) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dataReady) return;

    const limparPins = () => {
      pinsRef.current.forEach(({ marker }) => marker.remove());
      pinsRef.current.clear();
    };

    limparPins();
    if (mode !== "view") return;

    const apply = () => {
      limparPins();
      for (const ponto of pontos ?? []) {
        const meta = KIND_META[ponto.kind];
        if (!meta || ponto.lat == null || ponto.lng == null) continue;

        // ponto de apoio vira quadrado, igual ao mapa da aba Pontos de Apoio da Entidade
        const quadrado = ponto.kind === "ponto_apoio";
        const el = document.createElement("div");
        el.style.cssText =
          `width:${quadrado ? 30 : 26}px;height:${quadrado ? 30 : 26}px;` +
          `border-radius:${quadrado ? "10px" : "50%"};` +
          "display:flex;align-items:center;justify-content:center;" +
          `background:${meta.color};border:2px solid #fff;cursor:pointer;` +
          (quadrado
            ? "box-shadow:0 4px 12px rgba(0,0,0,0.28);"
            : "box-shadow:0 3px 10px rgba(0,0,0,0.3);");
        el.innerHTML = `<span class="material-symbols-outlined" style="font-size:${quadrado ? 16 : 14}px;color:#fff;font-variation-settings:'FILL' 1">${meta.icon}</span>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ponto.lng, ponto.lat])
          .addTo(map);

        // clique no pin apenas seleciona na lista lateral (sem popup)
        marker.getElement().addEventListener("click", () => {
          onSelecionarPontoRef.current?.(ponto);
        });

        pinsRef.current.set(String(ponto.id), { marker, ponto });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return limparPins;
  }, [mode, pontos, dataReady]);

  /* ── foco e realce do pin selecionado (vindo da lista lateral) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dataReady || mode !== "view") return;

    const chave = pontoSelecionadoId != null ? String(pontoSelecionadoId) : null;

    // realce visual sem recriar os marcadores
    pinsRef.current.forEach(({ marker, ponto }) => {
      const el = marker.getElement();
      const ativo = chave != null && String(ponto.id) === chave;
      el.style.boxShadow = ativo
        ? "0 0 0 3px #fff, 0 0 0 7px rgba(0,0,0,0.25)"
        : "0 3px 10px rgba(0,0,0,0.3)";
      el.style.zIndex = ativo ? "20" : "";
    });

    if (chave == null) return;

    const pin = pinsRef.current.get(chave);
    if (!pin) return;

    map.flyTo({
      center: [pin.ponto.lng, pin.ponto.lat],
      zoom: Math.max(map.getZoom(), 10),
      duration: 700,
    });
  }, [pontoSelecionadoId, dataReady, mode, pontos]);

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

  /* ── re-renderizar polígono ao voltar para view mode ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "view" || !zoneData) return;

    const apply = () => {
      // limpa layers antigas antes de recriar
      removePolygonLayer(map, "zone");
      renderZonePolygon(map, zoneData);
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);

    return () => {
      removePolygonLayer(map, "zone");
    };
  }, [mode, zoneData, renderZonePolygon]);

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
