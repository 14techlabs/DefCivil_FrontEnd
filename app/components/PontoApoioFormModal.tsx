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
  tipo: "escola" | "upa" | "hospital" | "crea" | "outro";
  tipo_label: string;
  /** zona detectada automaticamente pelo backend a partir das coordenadas */
  zona?: number | null;
}

export const APOIO_TIPOS = [
  { value: "escola", label: "Escola" },
  { value: "upa", label: "UPA" },
  { value: "hospital", label: "Hospital" },
  { value: "crea", label: "CREA" },
  { value: "outro", label: "Outro" },
] as const;

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
  const [tipo, setTipo] = useState<Apoio["tipo"]>("outro");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zonas, setZonas] = useState<{ id: number; nome: string }[]>([]);
  // zonas que contêm o marcador (detecção automática, igual à da ocorrência)
  const [zonasDetectadas, setZonasDetectadas] = useState<number[]>([]);
  // zona escolhida pelo técnico quando há sobreposição; null = backend decide
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // resetar ao abrir
  useEffect(() => {
    if (open) {
      setNome(ponto?.nome ?? "");
      setTipo(ponto?.tipo ?? "outro");
      setDescricao(ponto?.descricao ?? "");
      setEndereco(ponto?.endereco ?? "");
      setLat(ponto?.coordenadas ? String(ponto.coordenadas.lat) : "");
      setLng(ponto?.coordenadas ? String(ponto.coordenadas.lng) : "");
      // começa pela zona que o backend já tinha detectado; o mapa recalcula ao carregar
      setZonasDetectadas(ponto?.zona ? [ponto.zona] : []);
      setZonaId(ponto?.zona ?? null);
      setSaving(false);
      setError("");
    }
  }, [open, ponto]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    api
      .get<{ zonas: { id: number; nome: string }[] }>("/zonas/")
      .then((response) => {
        if (!cancelled) setZonas(response.data.zonas ?? []);
      })
      .catch(() => {
        if (!cancelled) setZonas([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

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

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      tipo,
      descricao: descricao.trim(),
      endereco: endereco.trim(),
      coordenadas: { lat: Number(lat), lng: Number(lng) },
    };
    // só envia a zona quando o técnico escolheu (sobreposição); o resto o backend resolve
    if (zonaId != null) payload.zona = zonaId;

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
  }, [nome, tipo, descricao, endereco, lat, lng, zonaId, ponto, showToast, onSaved, onClose]);

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

        <div>
          <MetaTag className="block mb-2">Categoria</MetaTag>
          <div className="relative">
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as Apoio["tipo"])}
              className="w-full appearance-none rounded-lg border-none bg-surface-container-low py-3 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
            >
              {APOIO_TIPOS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
              ))}
            </select>
            <Icon
              name="keyboard_arrow_down"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-primary"
            />
          </div>
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
            zonas={zonas}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
            onZoneDetect={(ids) => {
              setZonasDetectadas(ids);
              // mesma regra da ocorrência: 1 zona = automática; sobreposição = escolha
              if (ids.length === 1) setZonaId(ids[0]);
              else setZonaId(null);
            }}
          />
          <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1.5">
            <Icon name="info" className="shrink-0 text-[14px]" />
            Clique ou arraste o marcador no mapa para definir a localização.
          </p>
          {zonasDetectadas.length === 0 && (
            <p className="text-[11px] font-medium text-on-surface-variant mt-1.5 flex items-center gap-1.5">
              <Icon name="info" className="shrink-0 text-[14px]" />
              Nenhuma zona detectada para estas coordenadas.
            </p>
          )}
          {zonasDetectadas.length === 1 && (
            <p className="text-[11px] font-semibold text-primary mt-1.5 flex items-center gap-1.5">
              <Icon name="my_location" className="shrink-0 text-[14px]" />
              Zona detectada:{" "}
              {zonas.find((z) => z.id === zonasDetectadas[0])?.nome ??
                `Zona ${zonasDetectadas[0]}`}
            </p>
          )}
          {zonasDetectadas.length > 1 && (
            <div className="mt-3">
              <MetaTag className="block mb-2">Zonas sobrepostas — selecione uma zona</MetaTag>
              <div className="relative">
                <select
                  value={zonaId ?? ""}
                  onChange={(e) => setZonaId(e.target.value ? Number(e.target.value) : null)}
                  className={`w-full appearance-none rounded-lg border-none bg-surface-container-low py-3 pl-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-secondary ${
                    zonaId === null ? "text-on-surface-variant" : "text-primary"
                  }`}
                >
                  <option value="">Selecione uma zona</option>
                  {zonasDetectadas.map((id) => {
                    const z = zonas.find((z) => z.id === id);
                    return <option key={id} value={id}>{z?.nome ?? `Zona ${id}`}</option>;
                  })}
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-gray"
                />
              </div>
            </div>
          )}
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
