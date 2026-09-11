"use client";

import { useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

export interface EditableZone {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (zona: EditableZone) => void;
  zona: EditableZone;
}

export function EditZoneModal({ open, onClose, onSaved, zona }: Props) {
  const { showToast } = useGardian();
  const [nome, setNome] = useState(zona.nome);
  const [descricao, setDescricao] = useState(zona.descricao ?? "");
  const [tipo, setTipo] = useState<EditableZone["tipo"]>(zona.tipo);
  const [status, setStatus] = useState<EditableZone["status"]>(zona.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("Preencha o nome da zona.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await api.patch<EditableZone>(`/zonas/${zona.id}/`, {
        nome: nome.trim(),
        descricao: descricao.trim(),
        tipo,
        status,
      });
      showToast("Zona atualizada com sucesso.");
      onSaved(response.data);
      onClose();
    } catch (err: unknown) {
      const requestError = err as { response?: { status?: number } };
      const responseStatus = requestError.response?.status;

      if (responseStatus === 400) {
        setError("Dados inválidos. Verifique os campos informados.");
      } else if (responseStatus === 403) {
        setError("Você não tem permissão para editar esta zona.");
      } else if (responseStatus === 404) {
        setError("Esta zona não foi encontrada.");
      } else {
        setError("Não foi possível atualizar a zona. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={handleClose} maxWidth="max-w-xl">
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>EDITAR ZONA · {zona.id}</MetaTag>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">
          Informações da Zona
        </h2>
      </div>

      <div className="space-y-5 p-8">
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
            <div className="relative">
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value as EditableZone["tipo"])}
                className="w-full appearance-none rounded-lg border-none bg-surface-container-low py-3 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
              >
                <option value="urbana">Urbana</option>
                <option value="rural">Rural</option>
              </select>
              <Icon
                name="keyboard_arrow_down"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-primary"
              />
            </div>
          </div>

          <div>
            <MetaTag className="mb-2 block">Status</MetaTag>
            <div className="relative">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as EditableZone["status"])}
                className="w-full appearance-none rounded-lg border-none bg-surface-container-low py-3 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
              >
                <option value="critico">Crítico</option>
                <option value="atencao">Atenção</option>
                <option value="estavel">Estável</option>
              </select>
              <Icon
                name="keyboard_arrow_down"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-primary"
              />
            </div>
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
          {saving ? "Salvando..." : "Salvar alterações"}
        </Btn>
      </div>
    </ModalShell>
  );
}
