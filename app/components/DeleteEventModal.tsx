"use client";

import { useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { api } from "@/app/services/Api";
import { useGardian } from "@/app/components/GardianContext";

interface Props {
  open: boolean;
  evento: { id: number; nome: string; ocorrencias_count?: number };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteEventModal({ open, evento, onClose, onDeleted }: Props) {
  const { showToast } = useGardian();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (!deleting) {
      setError("");
      onClose();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/eventos/${evento.id}/`);
      showToast("Evento excluído com sucesso.");
      onDeleted();
      onClose();
    } catch (requestError: unknown) {
      const status = (requestError as { response?: { status?: number } }).response?.status;
      setError(
        status === 403
          ? "Você não tem permissão para excluir este evento."
          : status === 404
            ? "Este evento não foi encontrado."
            : "Não foi possível excluir o evento. Tente novamente.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={handleClose} maxWidth="max-w-md">
      <div className="p-8">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
          <Icon name="delete" filled className="text-[28px] text-error" />
        </div>
        <MetaTag>EXCLUIR EVENTO · #{evento.id}</MetaTag>
        <h2 className="mt-2 font-headline text-3xl font-black tracking-tighter text-primary">
          Confirmar exclusão
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          O evento <strong className="text-primary">{evento.nome}</strong> será excluído
          permanentemente.
        </p>

        {(evento.ocorrencias_count ?? 0) > 0 && (
          <div className="mt-5 rounded-xl bg-error-container p-4 text-sm leading-relaxed text-on-error-container">
            Este evento possui {evento.ocorrencias_count} ocorrência
            {evento.ocorrencias_count !== 1 ? "s" : ""} vinculada
            {evento.ocorrencias_count !== 1 ? "s" : ""}. Elas também poderão ser excluídas.
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-semibold text-error">
            {error}
          </p>
        )}

        <div className="mt-8 flex gap-3">
          <Btn variant="secondary" onClick={handleClose} disabled={deleting} full>
            Cancelar
          </Btn>
          <Btn variant="danger" icon="delete" onClick={handleDelete} disabled={deleting} full>
            {deleting ? "Excluindo..." : "Excluir evento"}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}
