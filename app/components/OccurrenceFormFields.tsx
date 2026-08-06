"use client";

import dynamic from "next/dynamic";
import { Icon, MetaTag } from "@/app/components/Primitives";

const CoordsPickerMap = dynamic(
  () => import("@/app/components/CoordsPickerMap").then((m) => m.CoordsPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low h-[200px]">
        <span className="text-xs text-on-surface-variant font-medium">carregando mapa…</span>
      </div>
    ),
  },
);

/* ───────────── tipos ───────────── */

export type Categoria = "geologico" | "climatico" | "vias_publicas" | "produtos_perigosos";
export type StatusOcorrencia = "em_analise" | "alta_prioridade" | "aguardando" | "em_andamento" | "concluida";

export const CATEGORIA_OPCOES: { id: Categoria; label: string; icon: string }[] = [
  { id: "geologico", label: "Geológico", icon: "terrain" },
  { id: "climatico", label: "Climático", icon: "thunderstorm" },
  { id: "vias_publicas", label: "Vias Públicas", icon: "directions_car" },
  { id: "produtos_perigosos", label: "Prod. Perigosos", icon: "science" },
];

export const STATUS_LABEL: Record<StatusOcorrencia, string> = {
  em_analise: "Em Análise",
  alta_prioridade: "Alta Prioridade",
  aguardando: "Aguardando",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
};

interface AnexoItem {
  nome: string;
  tamanho: string;
  tipo: string;
}

interface OccurrenceFormFieldsProps {
  // valores do formulário
  categoria: string;
  titulo: string;
  status: string;
  descricao: string;
  lat: string;
  lng: string;
  zonaId: number | null;
  detectedZonaIds: number[];
  zonas: { id: number; nome: string }[];
  // setters
  setCategoria: (v: string) => void;
  setTitulo: (v: string) => void;
  setStatus: (v: string) => void;
  setDescricao: (v: string) => void;
  setLat: (v: string) => void;
  setLng: (v: string) => void;
  setZonaId: (id: number | null) => void;
  onZoneDetect: (ids: number[]) => void;
  // anexos
  anexos: AnexoItem[];
  onFiles: (files: FileList | null) => void;
  onRemoveAnexo: (index: number) => void;
  anexosReadOnly?: boolean;
  coordsHint?: boolean;
  // erro
  error: string;
}

/* ───────────── campos compartilhados ───────────── */

export function OccurrenceFormFields({
  categoria,
  titulo,
  status,
  descricao,
  lat,
  lng,
  zonaId,
  detectedZonaIds,
  zonas,
  setCategoria,
  setTitulo,
  setStatus,
  setDescricao,
  setLat,
  setLng,
  setZonaId,
  onZoneDetect,
  anexos,
  onFiles,
  onRemoveAnexo,
  anexosReadOnly = false,
  coordsHint = false,
  error,
}: OccurrenceFormFieldsProps) {
  return (
    <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
      {/* categoria */}
      <div>
        <MetaTag className="block mb-2">Categoria</MetaTag>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIA_OPCOES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoria(c.id)}
              className={`flex flex-col items-center gap-2 py-4 rounded-lg transition-all ${
                categoria === c.id
                  ? "bg-primary text-white shadow-ambient-sm"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <Icon name={c.icon} filled={categoria === c.id} className="text-[20px]" />
              <span className="text-[10px] font-black uppercase tracking-mono-tight text-center leading-tight">
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* título + status (2 colunas) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <MetaTag className="block mb-2">Título</MetaTag>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="ex: rachadura em encosta"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
          />
        </div>

        <div>
          <MetaTag className="block mb-2">Status</MetaTag>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
          >
            {status && !(status in STATUS_LABEL) && (
              <option value={status}>{status}</option>
            )}
            {(Object.entries(STATUS_LABEL) as [StatusOcorrencia, string][]).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* coordenadas + zona (2 colunas) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <MetaTag className="block mb-2">Latitude</MetaTag>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="ex: -22.5050"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
          />
        </div>
        <div>
          <MetaTag className="block mb-2">Longitude</MetaTag>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="ex: -43.1788"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
          />
        </div>
      </div>

      {/* mapa de coordenadas */}
      {coordsHint && !lat.trim() && !lng.trim() && (
        <div className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Arraste o marcador no mapa para definir a localização.
        </div>
      )}
      <CoordsPickerMap
        lat={lat}
        lng={lng}
        zonas={zonas}
        onZoneDetect={onZoneDetect}
        onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
      />

      {/* zona; auto-detectada pelo mapa */}
      {detectedZonaIds.length > 1 && (
        <div>
          <MetaTag className="block mb-2">Zonas sobrepostas — selecione uma</MetaTag>
          <select
            value={zonaId ?? ""}
            onChange={(e) => setZonaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
          >
            <option value="">— selecione —</option>
            {detectedZonaIds.map((id) => {
              const z = zonas.find((z) => z.id === id);
              return <option key={id} value={id}>{z?.nome ?? `Zona #${id}`}</option>;
            })}
          </select>
        </div>
      )}
      {detectedZonaIds.length === 0 && (
        <div className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Nenhuma zona detectada para estas coordenadas.
        </div>
      )}
      {detectedZonaIds.length === 1 && (
        <div className="text-[11px] text-secondary font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
          Zona detectada: {zonas.find((z) => z.id === detectedZonaIds[0])?.nome ?? `Zona #${detectedZonaIds[0]}`}
        </div>
      )}

      {/* descrição */}
      <div>
        <MetaTag className="block mb-2">Relato Detalhado</MetaTag>
        <textarea
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="descreva o que foi observado, dimensões aproximadas, número de pessoas afetadas…"
          className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60 resize-none"
        />
      </div>

      {/* anexos */}
      <div>
        <MetaTag className="block mb-2">
          {anexosReadOnly ? `Anexos (${anexos.length})` : "Anexos (opcional)"}
        </MetaTag>
        {!anexosReadOnly && (
          <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg bg-surface-container-low border-2 border-dashed border-outline-variant/40 cursor-pointer hover:bg-surface-container transition-all">
            <Icon name="upload_file" className="text-secondary text-[24px]" />
            <span className="text-[12px] font-bold text-primary">
              Clique para anexar fotos, vídeos ou documentos
            </span>
            <span className="text-[10px] text-on-surface-variant">
              JPG, PNG, MP4 ou PDF
            </span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        )}

        {anexos.length > 0 && (
          <div className="space-y-2 mt-3">
            {anexos.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
              >
                <Icon
                  name={a.tipo === "video" ? "movie" : a.tipo === "documento" ? "description" : "image"}
                  className="text-secondary text-[18px]"
                />
                <span className="font-bold text-primary flex-1 truncate">{a.nome}</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">{a.tamanho}</span>
                {!anexosReadOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveAnexo(i)}
                    className="p-1 rounded-md hover:bg-surface-container"
                    aria-label="Remover anexo"
                  >
                    <Icon name="close" className="text-on-surface-variant text-[16px]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* erro */}
      {error && (
        <p className="text-[12px] text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
