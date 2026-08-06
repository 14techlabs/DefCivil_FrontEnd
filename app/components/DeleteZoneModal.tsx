"use client";

import { useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  zona: { id: number; nome: string };
}

export function DeleteZoneModal({ open, onClose, onDeleted, zona }: Props) {
  const { showToast } = useGardian();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (deleting) return;
    setError("");
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      await api.delete(`/zonas/${zona.id}/`);
      showToast("Zona excluída com sucesso.");
      onDeleted();
    } catch (err: unknown) {
      const requestError = err as { response?: { status?: number } };
      const responseStatus = requestError.response?.status;

      if (responseStatus === 403) {
        setError("Você não tem permissão para excluir esta zona.");
      } else if (responseStatus === 404) {
        setError("Esta zona não foi encontrada ou já foi excluída.");
      } else {
        setError("Não foi possível excluir a zona. Tente novamente.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={handleClose} maxWidth="max-w-md">
      <div className="p-7">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
          <Icon name="delete" filled className="text-[24px]" />
        </div>

        <MetaTag>EXCLUIR ZONA · #{zona.id}</MetaTag>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">
          Confirmar exclusão
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          A zona <strong className="text-on-surface">{zona.nome}</strong> será excluída
          permanentemente.
        </p>
        <p className="mt-3 rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          As ocorrências e os eventos vinculados a esta zona também serão excluídos e esta ação não poderá ser desfeita.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-error/20 px-4 py-3 text-sm font-medium text-error">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <Btn variant="secondary" onClick={handleClose} disabled={deleting}>
            Cancelar
          </Btn>
          <Btn variant="danger" icon="delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Excluindo..." : "Excluir zona"}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}
