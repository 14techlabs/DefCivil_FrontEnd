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

interface EventoOption {
  id: number;
  nome: string;
  status?: string | null;
}

interface EventosResponse {
  eventos: EventoOption[];
  evento_vinculado_id: number | null;
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
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [eventoId, setEventoId] = useState<number | null>(null);
  const [eventoSugeridoId, setEventoSugeridoId] = useState<number | null>(null);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [eventosError, setEventosError] = useState(false);

  // shared
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // reset ao abrir
  useEffect(() => {
    if (open) {
      let cancelled = false;
      setCategoria("geologico");
      setTitulo("");
      setStatus("em_analise");
      setDescricao("");
      setZonaId(null);
      setDetectedZonaIds([]);
      setLat("");
      setLng("");
      setAnexos([]);
      setEventos([]);
      setEventoId(null);
      setEventoSugeridoId(null);
      setLoadingEventos(true);
      setEventosError(false);
      setSaving(false);
      setError("");
      setFieldErrors({});

      void api
        .get<EventosResponse>("/eventos/")
        .then(({ data }) => {
          if (cancelled) return;
          const lista = Array.isArray(data.eventos) ? data.eventos : [];
          const sugerido = data.evento_vinculado_id ?? null;
          setEventos(lista);
          setEventoSugeridoId(sugerido);
          setEventoId(
            sugerido !== null && lista.some((evento) => evento.id === sugerido)
              ? sugerido
              : null,
          );
        })
        .catch(() => {
          if (!cancelled) setEventosError(true);
        })
        .finally(() => {
          if (!cancelled) setLoadingEventos(false);
        });

      return () => {
        cancelled = true;
      };
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
      if (eventoId !== null) body.evento = eventoId;

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
        beforeFields={
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-primary" aria-hidden="true">
                event
              </span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="occurrence-event"
                  className="font-headline text-xs font-black uppercase tracking-[0.14em] text-primary"
                >
                  Evento relacionado{" "}
                  <span className="font-medium normal-case tracking-normal text-on-surface-variant">
                    (opcional)
                  </span>
                </label>
                {eventoSugeridoId !== null && (
                  <p className="mt-1 text-sm leading-5 text-on-surface-variant">
                    Existe um evento com vinculação automática ativa. Ele foi selecionado como
                    sugestão e pode ser alterado.
                  </p>
                )}
                {eventosError && (
                  <p className="mt-1 text-sm text-error">
                    Não foi possível consultar os eventos. Você ainda pode registrar a ocorrência.
                  </p>
                )}
                <select
                  id="occurrence-event"
                  value={eventoId ?? ""}
                  onChange={(event) =>
                    setEventoId(event.target.value ? Number(event.target.value) : null)
                  }
                  disabled={loadingEventos || eventosError}
                  className="mt-3 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 pr-10 font-body text-sm font-semibold text-on-surface outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {loadingEventos ? "Consultando eventos…" : "Nenhum evento"}
                  </option>
                  {eventos.map((evento) => (
                    <option key={evento.id} value={evento.id}>
                      {evento.nome}
                      {evento.id === eventoSugeridoId ? " — sugerido" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        }
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
