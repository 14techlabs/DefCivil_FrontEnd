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

interface AnexoPendente {
  nome: string;
  tamanho: string;
  tipo: string;
  arquivo: File;
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
  const [anexos, setAnexos] = useState<AnexoPendente[]>([]);

  // shared
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      setFieldErrors({});
    }
  }, [open]);

  /* ── anexos ── */
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos = Array.from(files).map((f) => ({
      nome: f.name,
      arquivo: f,
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
    const novosErros: Record<string, string> = {};
    if (!titulo.trim()) novosErros.titulo = "Preencha o título.";
    if (!lat.trim() || !lng.trim()) novosErros.coordenadas = "Defina a localização no mapa.";
    if (!descricao.trim()) novosErros.descricao = "Preencha o relato detalhado.";

    if (Object.keys(novosErros).length > 0) {
      setError("");
      setFieldErrors(novosErros);
      const primeiroCampo = novosErros.titulo
        ? "occurrence-title"
        : novosErros.coordenadas
          ? "occurrence-latitude"
          : "occurrence-description";
      requestAnimationFrame(() => {
        const campo = document.getElementById(primeiroCampo);
        campo?.scrollIntoView({ behavior: "smooth", block: "center" });
        campo?.focus({ preventScroll: true });
      });
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError("");
      setFieldErrors({ coordenadas: "Informe uma latitude e uma longitude válidas." });
      requestAnimationFrame(() => {
        const campo = document.getElementById("occurrence-latitude");
        campo?.scrollIntoView({ behavior: "smooth", block: "center" });
        campo?.focus({ preventScroll: true });
      });
      return;
    }

    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        categoria,
        status,
        descricao: descricao.trim(),
        coordenadas: { lat: parsedLat, lng: parsedLng },
      };
      if (zonaId !== null) body.zona = zonaId;

      const res = await api.post<{ id: number }>("/ocorrencias/", body);
      const uploads = await Promise.allSettled(
        anexos.map((anexo) => {
          const formData = new FormData();
          formData.append("file", anexo.arquivo, anexo.nome);
          return api.post(`/ocorrencias/${res.data.id}/anexos/`, formData);
        }),
      );
      const uploadsComErro = uploads.filter((resultado) => resultado.status === "rejected").length;

      if (uploadsComErro > 0) {
        showToast(
          `Ocorrência criada, mas ${uploadsComErro} de ${anexos.length} anexo(s) não foram enviados.`,
          "error",
        );
      } else {
        showToast(
          anexos.length > 0
            ? "Ocorrência e anexos registrados com sucesso."
            : "Ocorrência registrada com sucesso.",
        );
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 400) {
        setError("Dados inválidos, verifique os campos obrigatórios.");
      } else {
        setError("Erro ao registrar ocorrência. Tente novamente.");
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
        setTitulo={(value) => {
          setTitulo(value);
          setFieldErrors((prev) => ({ ...prev, titulo: "" }));
        }}
        setStatus={(v) => setStatus(v as StatusOcorrencia)}
        setDescricao={(value) => {
          setDescricao(value);
          setFieldErrors((prev) => ({ ...prev, descricao: "" }));
        }}
        setLat={(value) => {
          setLat(value);
          setFieldErrors((prev) => ({ ...prev, coordenadas: "" }));
        }}
        setLng={(value) => {
          setLng(value);
          setFieldErrors((prev) => ({ ...prev, coordenadas: "" }));
        }}
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
        fieldErrors={fieldErrors}
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
