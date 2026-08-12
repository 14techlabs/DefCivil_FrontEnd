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

interface AnexoEditavel {
  nome: string;
  tamanho: string;
  tipo: string;
  arquivo?: File;
  referenceId?: string;
}

interface AnexoApi {
  arquivo?: {
    nome?: string;
    reference_id?: string | null;
  };
}

function tipoDoArquivo(nome: string): string {
  const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "webm", "mov", "avi"].includes(extensao)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extensao)) return "foto";
  return "documento";
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
  const [anexos, setAnexos] = useState<AnexoEditavel[]>([]);
  const [referenciasExcluir, setReferenciasExcluir] = useState<string[]>([]);

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
        const item = a as AnexoApi;
        const nome = item.arquivo?.nome ?? "Arquivo";
        return {
          nome,
          tamanho: "Salvo",
          tipo: tipoDoArquivo(nome),
          referenceId: item.arquivo?.reference_id ?? undefined,
        };
      }));
      setReferenciasExcluir([]);
      setSaving(false);
      setError("");
    }
  }, [open, ocorrencia]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: AnexoEditavel[] = Array.from(files).map((arquivo) => ({
      nome: arquivo.name,
      arquivo,
      tipo: tipoDoArquivo(arquivo.name),
      tamanho:
        arquivo.size > 1024 * 1024
          ? `${(arquivo.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
          : `${Math.max(1, Math.round(arquivo.size / 1024))} KB`,
    }));
    setAnexos((atuais) => [...atuais, ...novos]);
  };

  const removerAnexo = (index: number) => {
    setAnexos((atuais) => {
      const removido = atuais[index];
      if (removido?.referenceId) {
        setReferenciasExcluir((referencias) => [...referencias, removido.referenceId!]);
      }
      return atuais.filter((_, itemIndex) => itemIndex !== index);
    });
  };

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

      const novosAnexos = anexos.filter(
        (anexo): anexo is AnexoEditavel & { arquivo: File } => anexo.arquivo instanceof File,
      );
      const operacoes = [
        ...novosAnexos.map((anexo) => {
          const formData = new FormData();
          formData.append("file", anexo.arquivo, anexo.nome);
          return {
            tipo: "adicionar" as const,
            nome: anexo.nome,
            promise: api.post(`/ocorrencias/${ocorrencia.id}/anexos/`, formData),
          };
        }),
        ...referenciasExcluir.map((referenceId) =>
          ({
            tipo: "excluir" as const,
            referenceId,
            promise: api.delete("/api/arquivo", { params: { reference_id: referenceId } }),
          }),
        ),
      ];
      const resultados = await Promise.allSettled(operacoes.map((operacao) => operacao.promise));
      let operacoesComFalha = resultados
        .map((resultado, index) => ({ resultado, operacao: operacoes[index] }))
        .filter(({ resultado }) => resultado.status === "rejected");

      if (operacoesComFalha.length > 0) {
        try {
          const atualizada = await api.get<{ anexos: AnexoApi[] }>(
            `/ocorrencias/${ocorrencia.id}/`,
          );
          const anexosAtuais = atualizada.data.anexos ?? [];
          const referenciasAtuais = new Set(
            anexosAtuais.map((item) => item.arquivo?.reference_id).filter(Boolean),
          );
          const nomesAtuais = new Set(
            anexosAtuais.map((item) => item.arquivo?.nome).filter(Boolean),
          );

          operacoesComFalha = operacoesComFalha.filter(({ operacao }) =>
            operacao.tipo === "adicionar"
              ? !nomesAtuais.has(operacao.nome)
              : referenciasAtuais.has(operacao.referenceId),
          );
        } catch {
          // Mantém as falhas originais quando não for possível confirmar o estado final
        }
      }

      const falhas = operacoesComFalha.length;

      if (falhas > 0) {
        showToast(
          `Ocorrência atualizada, mas ${falhas} alteração(ões) de anexo não foram concluídas.`,
          "error",
        );
      } else {
        showToast("Ocorrência atualizada com sucesso.");
      }
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
        onFiles={handleFiles}
        onRemoveAnexo={removerAnexo}
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
