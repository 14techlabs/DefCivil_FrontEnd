"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { DrawOnlyMap, PolygonGeometry } from "@/app/components/AreaDrawMap";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

/* ───────────── types ───────────── */

interface CreateZoneModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (zoneId: number) => void;
}

type ZoneTipo = "urbana" | "rural";
type ZoneStatus = "critico" | "atencao" | "estavel";

const TIPO_OPTIONS: { id: ZoneTipo; label: string }[] = [
  { id: "urbana", label: "Urbana" },
  { id: "rural", label: "Rural" },
];

const STATUS_OPTIONS: { id: ZoneStatus; label: string; activeClass: string; inactiveClass: string }[] = [
  { id: "critico", label: "Crítico", activeClass: "bg-error text-white", inactiveClass: "bg-surface-container-low text-on-surface-variant hover:bg-surface-container" },
  { id: "atencao", label: "Atenção", activeClass: "bg-orange-500 text-white", inactiveClass: "bg-surface-container-low text-on-surface-variant hover:bg-surface-container" },
  { id: "estavel", label: "Estável", activeClass: "bg-secondary text-white", inactiveClass: "bg-surface-container-low text-on-surface-variant hover:bg-surface-container" },
];

/* ───────────── component ───────────── */

export function CreateZoneModal({ open, onClose, onCreated }: CreateZoneModalProps) {
  const { showToast } = useGardian();

  // step
  const [step, setStep] = useState(0);

  // formulario - passo 0, dados
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<ZoneTipo>("urbana");
  const [status, setStatus] = useState<ZoneStatus>("estavel");
  const [descricao, setDescricao] = useState("");

  // formulario - passo 1, polígono
  const [polygon, setPolygon] = useState<PolygonGeometry | null>(null);

  // shared state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // resetar ao abrir de novo
  useEffect(() => {
    if (open) {
      setStep(0);
      setNome("");
      setTipo("urbana");
      setStatus("estavel");
      setDescricao("");
      setPolygon(null);
      setSaving(false);
      setError("");
    }
  }, [open]);

  // só vai pro mapa se o nome tiver sido preenchido
  const canGoToMap = nome.trim().length > 0;

  /* indo do passo 0 para o passo 1 */
  const handleNext = () => {
    if (!canGoToMap) {
      setError("Preencha o nome da zona.");
      return;
    }
    setError("");
    setStep(1);
  };

  /* envio */
  const handleSubmit = useCallback(async () => {
    if (!polygon) {
      setError("Desenhe um polígono no mapa antes de salvar.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post<{ id: number }>("/zonas/", {
        nome: nome.trim(),
        tipo,
        status,
        descricao: descricao.trim(),
        area: polygon,
      });

      showToast("Zona criada com sucesso.");
      onCreated(res.data.id);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 400) {
        setError("Dados inválidos. Verifique os campos obrigatórios.");
      } else {
        setError("Erro ao criar zona. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }, [nome, tipo, status, descricao, polygon, showToast, onCreated, onClose]);

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} maxWidth={step === 0 ? "max-w-lg" : "max-w-3xl"}>
      {/* passo 0 */}
      {step === 0 && (
        <>
          <div className="bg-surface-container-low px-8 py-6">
            <MetaTag>NOVA ZONA · PASSO 1/2</MetaTag>
            <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">
              Informações da Zona
            </h2>
          </div>

          <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* nome */}
            <div>
              <MetaTag className="block mb-2">Nome</MetaTag>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Zona Sul Residencial"
                className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
              />
            </div>

            {/* tipo */}
            <div>
              <MetaTag className="block mb-2">Tipo</MetaTag>
              <div className="grid grid-cols-2 gap-2">
                {TIPO_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTipo(opt.id)}
                    className={`py-3 rounded-lg text-xs font-black uppercase tracking-mono-tight transition-all ${
                      tipo === opt.id
                        ? "bg-primary text-white shadow-ambient-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* status */}
            <div>
              <MetaTag className="block mb-2">Status</MetaTag>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id)}
                    className={`py-3 rounded-lg text-xs font-black uppercase tracking-mono-tight transition-all ${
                      status === opt.id ? opt.activeClass : opt.inactiveClass
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* descricao */}
            <div>
              <MetaTag className="block mb-2">Descrição (opcional)</MetaTag>
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição da zona, localização aproximada, observações…"
                className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60 resize-none"
              />
            </div>

            {/* erro */}
            {error && (
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            )}

            {/* actions */}
            <div className="flex gap-3 pt-2">
              <Btn variant="secondary" onClick={onClose} full>
                Cancelar
              </Btn>
              <Btn
                variant="primary"
                icon="arrow_forward"
                onClick={handleNext}
                full
              >
                Próximo: Desenhar Área
              </Btn>
            </div>
          </div>
        </>
      )}

      {/* passo 1 */}
      {step === 1 && (
        <>
          <div className="bg-surface-container-low px-8 py-6">
            <MetaTag>NOVA ZONA · PASSO 2/2</MetaTag>
            <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">
              Desenhe a Área no Mapa
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Use o ícone de polígono (canto superior esquerdo) para desenhar a área da zona
            </p>
          </div>

          <div className="relative" style={{ minHeight: 420 }}>
            <DrawOnlyMap
              height={420}
              onPolygonChange={setPolygon}
            />

            {/* indicador "poligono definido" */}
            {polygon && (
              <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                <div className="px-3 py-2 rounded-md bg-white/95 backdrop-blur-md shadow-ambient-sm flex items-center gap-2">
                  <Icon name="check_circle" filled className="text-secondary text-[18px]" />
                  <span className="text-[11px] font-bold text-primary">
                    Polígono definido
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* erro */}
          {error && (
            <div className="px-8 pb-2">
              <p className="text-[12px] text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* actions */}
          <div className="px-8 py-5 flex gap-3 border-t border-outline-variant/20">
            <Btn variant="secondary" icon="arrow_back" onClick={() => setStep(0)} disabled={saving}>
              Voltar
            </Btn>
            <Btn
              variant="primary"
              icon="save"
              onClick={handleSubmit}
              disabled={saving}
              full
            >
              {saving ? "Salvando…" : "Salvar Zona"}
            </Btn>
          </div>
        </>
      )}
    </ModalShell>
  );
}
