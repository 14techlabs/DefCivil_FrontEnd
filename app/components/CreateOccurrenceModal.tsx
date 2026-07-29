"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

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

/* ───────────── types ───────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  zonas: { id: number; nome: string }[];
}

type Categoria = "geologico" | "climatico" | "vias_publicas" | "produtos_perigosos";
type StatusOcorrencia = "em_analise" | "alta_prioridade" | "aguardando" | "concluido";

const CATEGORIA_OPCOES: { id: Categoria; label: string; icon: string }[] = [
  { id: "geologico", label: "Geológico", icon: "terrain" },
  { id: "climatico", label: "Climático", icon: "thunderstorm" },
  { id: "vias_publicas", label: "Vias Públicas", icon: "directions_car" },
  { id: "produtos_perigosos", label: "Prod. Perigosos", icon: "science" },
];

const STATUS_LABEL: Record<StatusOcorrencia, string> = {
  em_analise: "Em Análise",
  alta_prioridade: "Alta Prioridade",
  aguardando: "Aguardando",
  concluido: "Concluído",
};

/* ───────────── componente ───────────── */

export function CreateOccurrenceModal({ open, onClose, onCreated, zonas }: Props) {
  const { showToast } = useGardian();

  // form state
  const [categoria, setCategoria] = useState<Categoria>("geologico");
  const [titulo, setTitulo] = useState("");
  const [status, setStatus] = useState<StatusOcorrencia>("em_analise");
  const [descricao, setDescricao] = useState("");
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; tamanho: string; tipo: string }[]>([]);

  // shared
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // reset ao abrir
  useEffect(() => {
    if (open) {
      setCategoria("geologico");
      setTitulo("");
      setStatus("em_analise");
      setDescricao("");
      setZonaId(null);
      setLat("");
      setLng("");
      setAnexos([]);
      setSaving(false);
      setError("");
    }
  }, [open]);

  /* ── anexos ── */
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos = Array.from(files).map((f) => ({
      nome: f.name,
      tamanho:
        f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
          : `${Math.max(1, Math.round(f.size / 1024))} KB`,
      tipo: f.type.startsWith("video")
        ? "video"
        : f.type.startsWith("image")
          ? "foto"
          : "documento",
    }));
    setAnexos((prev) => [...prev, ...novos]);
  };

  const removerAnexo = (i: number) =>
    setAnexos((prev) => prev.filter((_, idx) => idx !== i));

  /* ── submit ── */
  const handleSubmit = async () => {
    // validação
    if (!titulo.trim()) { setError("preencha o título."); return; }
    if (!descricao.trim()) { setError("preencha o relato."); return; }
    if (!lat.trim() || !lng.trim()) { setError("preencha as coordenadas (lat / lng)."); return; }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) { setError("coordenadas inválidas."); return; }

    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        categoria,
        status,
        descricao: descricao.trim(),
        coordenadas: { lat: parsedLat, lng: parsedLng },
      };
      if (zonaId !== null) body.zona = zonaId;
      if (anexos.length > 0) body.anexos = anexos;

      await api.post("/ocorrencias/", body);
      showToast("ocorrência registrada com sucesso.");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 400) {
        setError("dados inválidos. verifique os campos obrigatórios.");
      } else {
        setError("erro ao registrar ocorrência. tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      {/* cabeçalho */}
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>NOVA OCORRÊNCIA</MetaTag>
        <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">
          Registrar Nova Ocorrência
        </h2>
      </div>

      {/* corpo */}
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
              onChange={(e) => setStatus(e.target.value as StatusOcorrencia)}
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
            >
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
        <CoordsPickerMap lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />

        {/* zona (opcional) */}
        <div>
          <MetaTag className="block mb-2">Zona (opcional)</MetaTag>
          <select
            value={zonaId ?? ""}
            onChange={(e) => setZonaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
          >
            <option value="">— sem zona —</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>{z.nome}</option>
            ))}
          </select>
        </div>

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
          <MetaTag className="block mb-2">Anexos (opcional)</MetaTag>
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
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

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
                  <button
                    type="button"
                    onClick={() => removerAnexo(i)}
                    className="p-1 rounded-md hover:bg-surface-container"
                    aria-label="Remover anexo"
                  >
                    <Icon name="close" className="text-on-surface-variant text-[16px]" />
                  </button>
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

      {/* rodapé */}
      <div className="px-8 py-5 flex gap-3 border-t border-outline-variant/20">
        <Btn variant="secondary" onClick={onClose} disabled={saving} full>
          Cancelar
        </Btn>
        <Btn variant="primary" icon="save" onClick={handleSubmit} disabled={saving} full>
          {saving ? "Salvando…" : "Registrar Ocorrência"}
        </Btn>
      </div>
    </ModalShell>
  );
}
