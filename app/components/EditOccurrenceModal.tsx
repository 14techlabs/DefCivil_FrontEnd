"use client";

import { useEffect, useState } from "react";
import { Btn, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import { OccurrenceFormFields } from "@/app/components/OccurrenceFormFields";

/* ───────────── types ───────────── */

interface OcorrenciaEdit {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  descricao: string;
  coordenadas: { lat: number; lng: number } | null;
  zona: number | null;
  anexos: unknown[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  zonas: { id: number; nome: string }[];
  ocorrencia: OcorrenciaEdit;
}

/* ───────────── componente ───────────── */

export function EditOccurrenceModal({ open, onClose, onSaved, zonas, ocorrencia }: Props) {
  const { showToast } = useGardian();

  // form state
  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [status, setStatus] = useState("");
  const [descricao, setDescricao] = useState("");
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [detectedZonaIds, setDetectedZonaIds] = useState<number[]>([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; tamanho: string; tipo: string }[]>([]);

  // shared
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // popula o formulário com os dados da ocorrência ao abrir
  useEffect(() => {
    if (open) {
      setCategoria(ocorrencia.categoria ?? "");
      setTitulo(ocorrencia.titulo ?? "");
      setStatus(ocorrencia.status ?? "");
      setDescricao(ocorrencia.descricao ?? "");
      setZonaId(ocorrencia.zona ?? null);
      setDetectedZonaIds([]);
      setLat(ocorrencia.coordenadas ? String(ocorrencia.coordenadas.lat) : "");
      setLng(ocorrencia.coordenadas ? String(ocorrencia.coordenadas.lng) : "");
      setAnexos((ocorrencia.anexos ?? []).map((a) => {
        const item = a as { nome?: string; tipo?: string; tamanho?: string };
        return {
          nome: item.nome ?? "Arquivo",
          tamanho: item.tamanho ?? "",
          tipo: item.tipo ?? "documento",
        };
      }));
      setSaving(false);
      setError("");
    }
  }, [open, ocorrencia]);

  /* ── submit ── */
  const handleSubmit = async () => {
    // validação
    if (!titulo.trim()) { setError("Preencha o título."); return; }
    if (!descricao.trim()) { setError("Preencha o relato."); return; }
    if (!lat.trim() || !lng.trim()) { setError("Preencha as coordenadas (lat / lng)."); return; }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) { setError("Coordenadas inválidas."); return; }

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

      await api.patch(`/ocorrencias/${ocorrencia.id}/`, body);
      showToast("Ocorrência atualizada com sucesso.");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 400) {
        setError("Dados inválidos. Verifique os campos obrigatórios.");
      } else {
        setError("Erro ao atualizar ocorrência. Tente novamente.");
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
        <MetaTag>EDITAR OCORRÊNCIA · #{ocorrencia.id}</MetaTag>
        <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">
          Editar Ocorrência
        </h2>
      </div>

      {/* corpo compartilhado com o modal de criação */}
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
        setCategoria={setCategoria}
        setTitulo={setTitulo}
        setStatus={setStatus}
        setDescricao={setDescricao}
        setLat={setLat}
        setLng={setLng}
        setZonaId={setZonaId}
        onZoneDetect={(ids) => {
          setDetectedZonaIds(ids);
          // preserva a zona atual quando nada é detectado
          if (ids.length === 1) setZonaId(ids[0]);
          else if (ids.length > 1) setZonaId(null);
        }}
        anexos={anexos}
        onFiles={() => {}}
        onRemoveAnexo={() => {}}
        anexosReadOnly
        coordsHint={!ocorrencia.coordenadas}
        error={error}
      />

      {/* rodapé */}
      <div className="px-8 py-5 flex gap-3 border-t border-outline-variant/20">
        <Btn variant="secondary" onClick={onClose} disabled={saving} full>
          Cancelar
        </Btn>
        <Btn variant="primary" icon="save" onClick={handleSubmit} disabled={saving} full>
          {saving ? "Salvando…" : "Salvar Alterações"}
        </Btn>
      </div>
    </ModalShell>
  );
}
