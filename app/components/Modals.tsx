"use client";

import { useEffect, useState } from "react";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { Btn, Chip, Icon, MetaTag } from "./Primitives";

function ModalShell({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-[fadeIn_150ms_ease]">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${maxWidth} w-full bg-white rounded-xl shadow-ambient overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}

export function CriticalAlertModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { zone: string; severity: string; channels: string[] }) => void;
}) {
  const [step, setStep] = useState(0);
  const [zone, setZone] = useState("PT-ZS-01");
  const [severity, setSeverity] = useState("R3");
  const [channels, setChannels] = useState<string[]>(["sms", "siren", "push"]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;
  const ZONES = GARDIAN_DATA.ZONES;

  const toggleChannel = (id: string) => {
    setChannels(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      {/* Header */}
      <div className="bg-gradient-to-br from-error to-[#93000a] px-8 py-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <Icon name="warning" filled className="text-[180px]" />
        </div>
        <div className="relative">
          <MetaTag className="text-white/70">EMISSÃO DE ALERTA · PROTOCOLO R{severity.replace("R","")}</MetaTag>
          <h2 className="font-headline font-black text-3xl tracking-tighter mt-2">Emitir Alerta Crítico</h2>
          <p className="text-white/80 text-sm mt-2 max-w-md">Esta ação dispara notificação imediata para a população, equipes técnicas e órgãos parceiros. Confirme com cautela.</p>
        </div>
      </div>

      {/* Body */}
      {step === 0 && (
        <div className="p-8 space-y-6">
          <div>
            <MetaTag className="block mb-3">Zona de Impacto</MetaTag>
            <select value={zone} onChange={e => setZone(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary">
              {ZONES.map(z => <option key={z.id} value={z.id}>{z.name} ({z.statusLabel})</option>)}
            </select>
          </div>

          <div>
            <MetaTag className="block mb-3">Nível do Risco</MetaTag>
            <div className="grid grid-cols-4 gap-2">
              {["R1","R2","R3","R4"].map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  className={`py-3 rounded-lg text-xs font-black tracking-mono-tight transition-all ${
                    severity === s
                      ? "bg-gradient-to-br from-error to-[#93000a] text-white shadow-ambient-sm"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}>
                  {s}<br/><span className="text-[9px] opacity-70 font-bold">{s==="R1"?"BAIXO":s==="R2"?"MÉDIO":s==="R3"?"ALTO":"MUITO ALTO"}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <MetaTag className="block mb-3">Canais de Difusão</MetaTag>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "sms", l: "SMS Defesa Civil (40199)", icon: "sms" },
                { id: "siren", l: "Sirenes Comunitárias", icon: "campaign" },
                { id: "media", l: "Imprensa & Rádio", icon: "radio" },
              ].map(c => {
                const sel = channels.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleChannel(c.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                      sel ? "bg-secondary/10 text-secondary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}>
                    <Icon name={sel ? "check_box" : "check_box_outline_blank"} className="text-[18px]" />
                    <Icon name={c.icon} className="text-[16px]" />
                    <span className="text-xs font-bold flex-1">{c.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Btn variant="secondary" onClick={onClose} full>Cancelar</Btn>
            <Btn variant="danger" icon="campaign" onClick={() => setStep(1)} full>Revisar e Emitir</Btn>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="p-8">
          <div className="card-recessed p-5 mb-5">
            <MetaTag className="block mb-2">Resumo</MetaTag>
            <p className="font-headline font-black text-xl text-primary mb-1">{ZONES.find(z=>z.id===zone)?.name}</p>
            <p className="text-xs text-on-surface-variant mb-3">Severidade: <strong>{severity}</strong> · {channels.length} canais ativos</p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">População estimada na zona de impacto: <strong>{ZONES.find(z=>z.id===zone)?.population.toLocaleString("pt-BR")}</strong> habitantes. Tempo médio de propagação: <strong>~45s</strong>.</p>
          </div>
          <div className="bg-error-container text-on-error-container p-4 rounded-lg flex gap-3 mb-5">
            <Icon name="warning" filled className="text-error mt-0.5" />
            <p className="text-xs leading-relaxed">Esta ação é <strong>irreversível</strong> e ficará registrada no Protocol Log com sua assinatura digital (Operador Delta).</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setStep(0)} full>Voltar</Btn>
            <Btn variant="danger" icon="campaign" onClick={() => { onConfirm({ zone, severity, channels }); }} full>Confirmar Emissão</Btn>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export function DispatchModal({
  open,
  onClose,
  occurrence,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: (typeof GARDIAN_DATA.OCCURRENCES)[number] | null;
  onConfirm: (data: { team: string; eta: string }) => void;
}) {
  const [team, setTeam] = useState("alpha");
  const [eta, setEta] = useState("imediato");
  if (!open || !occurrence) return null;

  const teams = [
    { id: "alpha", name: "Equipe Alpha", spec: "Geotécnica · 4 técnicos", available: true },
    { id: "beta", name: "Equipe Beta", spec: "Hidrológica · 3 técnicos", available: true },
    { id: "hazmat", name: "HAZMAT", spec: "Produtos Perigosos · 5 técnicos", available: false },
    { id: "ops", name: "Equipe Ops", spec: "Vias & Estruturas · 6 técnicos", available: true },
  ];

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="bg-primary px-8 py-6 text-white">
        <MetaTag className="text-white/60">DESPACHO DE EQUIPE · {occurrence.id}</MetaTag>
        <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">{occurrence.title}</h2>
        <p className="text-white/70 text-xs mt-2">{occurrence.location}</p>
      </div>
      <div className="p-8 space-y-6">
        <div>
          <MetaTag className="block mb-3">Selecione a Equipe</MetaTag>
          <div className="space-y-2">
            {teams.map(t => (
              <button key={t.id} onClick={() => t.available && setTeam(t.id)} disabled={!t.available}
                className={`w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all ${
                  !t.available ? "bg-surface-container-low opacity-40 cursor-not-allowed"
                  : team === t.id ? "bg-secondary/10 ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"
                }`}>
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${team===t.id ? "bg-secondary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                  <Icon name="groups" filled />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-primary">{t.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{t.spec}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-mono-tight px-2 py-1 rounded ${t.available ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant"}`}>
                  {t.available ? "Disponível" : "Em ação"}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <MetaTag className="block mb-3">Prioridade de Deslocamento</MetaTag>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "imediato", l: "Imediato", sub: "<10 min" },
              { id: "alta", l: "Alta", sub: "<30 min" },
              { id: "rotina", l: "Rotina", sub: "<2h" },
            ].map(o => (
              <button key={o.id} onClick={() => setEta(o.id)}
                className={`py-3 rounded-lg text-center transition-all ${
                  eta === o.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}>
                <p className="text-xs font-black uppercase tracking-mono-tight">{o.l}</p>
                <p className="text-[10px] opacity-70 font-bold">{o.sub}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Btn variant="secondary" onClick={onClose} full>Cancelar</Btn>
          <Btn variant="success" icon="local_shipping" onClick={() => onConfirm({ team, eta })} full>Despachar</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

export function NewOccurrenceModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: Record<string, string>) => void;
}) {
  const [category, setCategory] = useState("geologico");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [zone, setZone] = useState("PT-ZS-01");
  const [priority, setPriority] = useState("media");
  const [report, setReport] = useState("");
  if (!open) return null;
  const ZONES = GARDIAN_DATA.ZONES;
  const cats = GARDIAN_DATA.CATEGORIES.filter((c) => c.id !== "todas");

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>NOVA OCORRÊNCIA · PROTOCOLO #PRT-2026-{Math.floor(Math.random()*9000+1000)}</MetaTag>
        <h2 className="font-headline font-black text-2xl tracking-tighter mt-2 text-primary">Registrar Nova Ocorrência</h2>
      </div>
      <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
        <div>
          <MetaTag className="block mb-3">Categoria</MetaTag>
          <div className="grid grid-cols-4 gap-2">
            {cats.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center gap-2 py-4 rounded-lg transition-all ${
                  category === c.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}>
                <Icon name={c.icon} filled className="text-[20px]" />
                <span className="text-[10px] font-bold uppercase tracking-mono-tight text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <MetaTag className="block mb-2">Título</MetaTag>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex: Rachadura em encosta"
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary" />
          </div>
          <div>
            <MetaTag className="block mb-2">Localização</MetaTag>
            <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Endereço ou referência"
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <MetaTag className="block mb-2">Zona</MetaTag>
            <select value={zone} onChange={e=>setZone(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary">
              {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <MetaTag className="block mb-2">Prioridade</MetaTag>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "baixa", l: "Baixa", t: "secondary" },
                { id: "media", l: "Média", t: "warning" },
                { id: "critica", l: "Crítica", t: "error" },
              ].map(p => {
                const tones: Record<string, string> = {
                  secondary: "bg-secondary text-white",
                  warning: "bg-orange-500 text-white",
                  error: "bg-error text-white",
                };
                return (
                  <button key={p.id} onClick={() => setPriority(p.id)}
                    className={`py-3 rounded-lg text-[10px] font-black uppercase tracking-mono-tight transition-all ${
                      priority === p.id ? tones[p.t] : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}>{p.l}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <MetaTag className="block mb-2">Relato Detalhado</MetaTag>
          <textarea rows={4} value={report} onChange={e=>setReport(e.target.value)}
            placeholder="Descreva o que foi observado, dimensões aproximadas, número de pessoas afetadas..."
            className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Btn variant="secondary" onClick={onClose} full>Cancelar</Btn>
          <Btn variant="primary" icon="check" onClick={() => onConfirm({ category, title, location, zone, priority, report })} full>Registrar Ocorrência</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

