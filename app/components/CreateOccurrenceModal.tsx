"use client";

import { useEffect, useState } from "react";
import { Btn, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import {
  OccurrenceFormFields,
  type Categoria,
  type StatusOcorrencia,
} from "@/app/components/OccurrenceFormFields";

/* ───────────── types ───────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  zonas: { id: number; nome: string }[];
}

/* ───────────── componente ───────────── */

export function CreateOccurrenceModal({ open, onClose, onCreated, zonas }: Props) {
  const { showToast } = useGardian();

  // form state
  const [categoria, setCategoria] = useState<Categoria>("geologico");
  const [titulo, setTitulo] = useState("");
  const [status, setStatus] = useState<StatusOcorrencia>("em_analise");
  const [descricao, setDescricao] = useState("");
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [detectedZonaIds, setDetectedZonaIds] = useState<number[]>([]);
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
      setDetectedZonaIds([]);
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

      {/* corpo compartilhado com o modal de edição */}
      <OccurrenceFormFields
        categoria={categoria}
        titulo={titulo}
        status={status}
        descricao={descricao}
        lat={lat}
        lng={lng}
        zonaId={zonaId}
        detectedZonaIds={detectedZonaIds}
        zonas={zonas}
        setCategoria={(v) => setCategoria(v as Categoria)}
        setTitulo={setTitulo}
        setStatus={(v) => setStatus(v as StatusOcorrencia)}
        setDescricao={setDescricao}
        setLat={setLat}
        setLng={setLng}
        setZonaId={setZonaId}
        onZoneDetect={(ids) => {
          setDetectedZonaIds(ids);
          if (ids.length === 1) setZonaId(ids[0]);
          else setZonaId(null);
        }}
        anexos={anexos}
        onFiles={handleFiles}
        onRemoveAnexo={removerAnexo}
        error={error}
      />

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
