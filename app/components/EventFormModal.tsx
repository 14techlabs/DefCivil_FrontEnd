"use client";

import { useState } from "react";
import { Btn, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";

const EVENT_STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "monitorando", label: "Monitorando" },
  { value: "concluido", label: "Concluído" },
  { value: "encerrado", label: "Encerrado" },
] as const;

function apiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const message = value.find((item): item is string => typeof item === "string");
      if (message) return message;
    }
  }

  return null;
}

export interface EventoFormData {
  id: number;
  nome: string;
  descricao: string;
  tipo: "desastre" | "mitigacao";
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  evento?: EventoFormData;
}

export function EventFormModal({ open, onClose, onSaved, evento }: Props) {
  const { showToast } = useGardian();
  const [nome, setNome] = useState(evento?.nome ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [tipo, setTipo] = useState<EventoFormData["tipo"]>(evento?.tipo ?? "desastre");
  const [status, setStatus] = useState(evento?.status ?? "ativo");
  const [dataInicio, setDataInicio] = useState(evento?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(evento?.data_fim ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!nome.trim() || !descricao.trim() || !dataInicio) {
      setError("Preencha nome, descrição e data do evento.");
      return;
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setError("A data de término não pode ser anterior à data de início.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      tipo,
      status: status.trim() || null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
    };

    try {
      if (evento) {
        await api.patch(`/eventos/${evento.id}/`, payload);
        showToast("Evento atualizado com sucesso.");
      } else {
        await api.post("/eventos/", payload);
        showToast("Evento criado com sucesso.");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const requestError = err as { response?: { status?: number; data?: unknown } };
      const responseStatus = requestError.response?.status;
      if (responseStatus === 400) {
        setError(
          apiErrorMessage(requestError.response?.data) ??
            "Dados inválidos. Verifique os campos informados.",
        );
      } else if (responseStatus === 403) {
        setError("Você não tem permissão para salvar este evento.");
      } else if (responseStatus === 404) {
        setError("Este evento não foi encontrado.");
      } else {
        setError("Não foi possível salvar o evento. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={handleClose} maxWidth="max-w-2xl">
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>{evento ? `EDITAR EVENTO · ${evento.id}` : "NOVO EVENTO"}</MetaTag>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">
          {evento ? "Editar evento" : "Registrar evento"}
        </h2>
      </div>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-8">
        <div>
          <MetaTag className="mb-2 block">Nome</MetaTag>
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div>
          <MetaTag className="mb-2 block">Descrição</MetaTag>
          <textarea
            rows={4}
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            className="w-full resize-none rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <MetaTag className="mb-2 block">Tipo</MetaTag>
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as EventoFormData["tipo"])}
              className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
            >
              <option value="desastre">Desastre</option>
              <option value="mitigacao">Mitigação</option>
            </select>
          </div>
          <div>
            <MetaTag className="mb-2 block">Status</MetaTag>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
            >
              {status && !EVENT_STATUS_OPTIONS.some((option) => option.value === status) && (
                <option value={status}>{status}</option>
              )}
              {EVENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <MetaTag className="mb-2 block">Início</MetaTag>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <MetaTag className="mb-2 block">Término</MetaTag>
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-3 border-t border-outline-variant/20 px-8 py-5">
        <Btn variant="secondary" onClick={handleClose} disabled={saving} full>
          Cancelar
        </Btn>
        <Btn variant="primary" icon="save" onClick={handleSave} disabled={saving} full>
          {saving ? "Salvando..." : "Salvar evento"}
        </Btn>
      </div>
    </ModalShell>
  );
}
