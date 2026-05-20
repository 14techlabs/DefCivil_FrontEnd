"use client";

import { useState } from "react";
import { DispatchModal, NewOccurrenceModal } from "@/app/components/Modals";
import { Btn, Chip, Icon, MetaTag, Tab } from "@/app/components/Primitives";
import { GARDIAN_DATA } from "@/app/data/gardian";

export default function OccurrencesPage() {
  const OCCURRENCES = GARDIAN_DATA.OCCURRENCES;
  const CATEGORIES = GARDIAN_DATA.CATEGORIES;
  const [filter, setFilter] = useState("todas");
  const [selected, setSelected] = useState(OCCURRENCES[0].id);
  const [showNew, setShowNew] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);

  const list = OCCURRENCES.filter(o => filter === "todas" || o.category === filter);
  const sel = OCCURRENCES.find(o => o.id === selected) || list[0];

  const accentFor = (s: string) =>
    s === "alta_prioridade" ? "bg-error" : s === "em_analise" ? "bg-secondary" : "bg-orange-400";
  const statusToneFor = (s: string) =>
    s === "alta_prioridade" ? "error" : s === "em_analise" ? "secondary" : "warning";

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">CENTRAL DE OCORRÊNCIAS · v2.4</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{OCCURRENCES.length} ATIVAS · 2 CRÍTICAS</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Ocorrências em Aberto</h1>
            <p className="text-sm text-on-surface-variant mt-2">Triagem unificada · Relatos da população, sensores IoT e parceiros institucionais</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="filter_list">Filtros</Btn>
            <Btn variant="primary" icon="add" onClick={() => setShowNew(true)}>Nova Ocorrência</Btn>
          </div>
        </div>
      </header>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(c => (
          <Tab key={c.id} active={filter===c.id} onClick={() => setFilter(c.id)} icon={c.icon}>
            {c.label} {c.id !== "todas" && <span className="opacity-60">({OCCURRENCES.filter(o=>o.category===c.id).length})</span>}
          </Tab>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* List */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          {list.map(o => (
            <button key={o.id} onClick={() => setSelected(o.id)}
              className={`w-full card-tonal p-6 shadow-ambient-sm text-left relative overflow-hidden hover:shadow-ambient transition-all ${selected===o.id ? "ring-2 ring-secondary" : ""}`}>
              <span className={`absolute top-0 left-0 bottom-0 w-1 ${accentFor(o.status)}`} />
              <div className="pl-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">{o.id}</span>
                    <Chip tone={statusToneFor(o.status)}>{o.statusLabel}</Chip>
                  </div>
                  <MetaTag>{o.reportedAt}</MetaTag>
                </div>
                <h3 className="font-headline font-bold text-lg text-primary mb-2">{o.title}</h3>
                <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
                  <span className="flex items-center gap-1.5"><Icon name="location_on" className="text-[14px]" /> {o.location}</span>
                  <span className="flex items-center gap-1.5"><Icon name={CATEGORIES.find(c=>c.id===o.category)?.icon ?? "help"} className="text-[14px]" /> {o.categoryLabel}</span>
                  <span className="flex items-center gap-1.5"><Icon name={o.source==="iot"?"sensors":o.source==="cidadao"?"person":"handshake"} className="text-[14px]" /> {o.reportedBy}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <aside className="col-span-12 lg:col-span-5">
          <div className="card-tonal shadow-ambient-sm sticky top-24 overflow-hidden">
            <div className={`p-6 ${sel.status==="alta_prioridade"?"bg-gradient-to-br from-error to-[#93000a]":"bg-gradient-to-br from-primary to-primary-container"} text-white`}>
              <Chip tone="primarySoft" className="!bg-white/15 !text-white">{sel.categoryLabel.toUpperCase()}</Chip>
              <h2 className="font-headline font-black text-2xl tracking-tighter mt-3">{sel.title}</h2>
              <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
                <Icon name="location_on" className="text-[14px]" /> {sel.location}
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <MetaTag className="block mb-2">RELATÓRIO DO OPERADOR</MetaTag>
                <p className="text-[13px] text-on-surface leading-relaxed">{sel.report}</p>
              </div>

              <div>
                <MetaTag className="block mb-3">LINHA DO TEMPO</MetaTag>
                <div className="space-y-3">
                  {sel.timeline.map((t, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-[10px] font-mono font-bold text-secondary mt-0.5 w-12 shrink-0">{t.time}</span>
                      <div className="flex-1">
                        <p className="text-[12px] text-primary font-medium">{t.event}</p>
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-mono-tight">{t.actor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Btn variant="secondary" icon="visibility" full>Detalhes</Btn>
                <Btn variant="success" icon="local_shipping" onClick={() => setShowDispatch(true)} full>Despachar Equipe</Btn>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <NewOccurrenceModal open={showNew} onClose={() => setShowNew(false)} onConfirm={() => setShowNew(false)} />
      <DispatchModal open={showDispatch} onClose={() => setShowDispatch(false)} occurrence={sel} onConfirm={() => setShowDispatch(false)} />
    </div>
  );
}
