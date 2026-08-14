"use client";

import { useCallback, useEffect, useState } from "react";
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
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low h-[220px]">
        <span className="text-xs text-on-surface-variant font-medium">carregando mapa…</span>
      </div>
    ),
  },
);

/* ───────────── tipos ───────────── */

export interface Apoio {
  id: number;
  entidade: number;
  nome: string;
  descricao: string;
  endereco: string;
  coordenadas: { lat: number; lng: number } | null;
}

interface PontoApoioFormModalProps {
  open: boolean;
  /** preenchido = edição; null = criação */
  ponto?: Apoio | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ───────────── component ───────────── */

export function PontoApoioFormModal({
  open,
  ponto,
  onClose,
  onSaved,
}: PontoApoioFormModalProps) {
  const { showToast } = useGardian();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // resetar ao abrir
  useEffect(() => {
    if (open) {
      setNome(ponto?.nome ?? "");
      setDescricao(ponto?.descricao ?? "");
      setEndereco(ponto?.endereco ?? "");
      setLat(ponto?.coordenadas ? String(ponto.coordenadas.lat) : "");
      setLng(ponto?.coordenadas ? String(ponto.coordenadas.lng) : "");
      setSaving(false);
      setError("");
    }
  }, [open, ponto]);

  /* envio */
  const handleSubmit = useCallback(async () => {
    if (!nome.trim()) {
      setError("Preencha o nome do ponto de apoio.");
      return;
    }
    if (!lat || !lng) {
      setError("Marque a localização no mapa.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      endereco: endereco.trim(),
      coordenadas: { lat: Number(lat), lng: Number(lng) },
    };

    setSaving(true);
    setError("");

    try {
      if (ponto) {
        await api.patch(`/apoios/${ponto.id}/`, payload);
        showToast("Ponto de apoio atualizado.");
      } else {
        await api.post("/apoios/", payload);
        showToast("Ponto de apoio criado.");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 400) {
        setError("Dados inválidos. Verifique os campos e as coordenadas.");
      } else {
        setError("Erro ao salvar ponto de apoio. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }, [nome, descricao, endereco, lat, lng, ponto, showToast, onSaved, onClose]);

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>{ponto ? "EDITAR PONTO DE APOIO" : "NOVO PONTO DE APOIO"}</MetaTag>
        <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">
          {ponto ? "Editar Ponto de Apoio" : "Novo Ponto de Apoio"}
        </h2>
      </div>

      <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
        {/* nome */}
        <div>
          <MetaTag className="block mb-2">Nome</MetaTag>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Escola Municipal da Orla"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
          />
        </div>

        {/* endereco */}
        <div>
          <MetaTag className="block mb-2">Endereço (opcional)</MetaTag>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Ex: Rua da Orla, 100"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
          />
        </div>

        {/* descricao */}
        <div>
          <MetaTag className="block mb-2">Descrição (opcional)</MetaTag>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Vagas, estrutura, observações…"
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60 resize-none"
          />
        </div>

        {/* mapa */}
        <div>
          <MetaTag className="block mb-2">Localização no mapa</MetaTag>
          <CoordsPickerMap
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
          <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-start gap-1.5">
            <Icon name="info" className="text-[14px] mt-0.5" />
            Clique ou arraste o marcador no mapa para definir a localização.
          </p>
        </div>

        {/* erro */}
        {error && (
          <p className="text-[12px] text-red-600 font-medium">{error}</p>
        )}

        {/* actions */}
        <div className="flex gap-3 pt-2">
          <Btn variant="secondary" onClick={onClose} full disabled={saving}>
            Cancelar
          </Btn>
          <Btn variant="primary" icon="save" onClick={handleSubmit} full disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}
