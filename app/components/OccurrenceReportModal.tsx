"use client";

import { useState } from "react";
import { reportLabel, reportTitle, reportText } from "@/app/lib/reportLabels";
import { ModalShell } from "./Modals";
import { Btn } from "./Primitives";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

export interface ReportOccurrence {
  id: number;
  titulo: string;
  descricao: string;
  status: string;
  categoria: string;
  created_at: string;
  endereco?: string;
  tecnico_responsavel: number | null;
  zona: number | null;
  custo_danos: string | null;
  fatalidades: number;
  evento: number | null;
  autor: number | null;
  cidadao: number | null;
}

const origin = (o: ReportOccurrence) => o.cidadao != null && o.autor == null ? "public" : "internal";
const originLabels = { public: "Formulário público", internal: "Registro interno" };
const allLabels = { status: "Todos os status", category: "Todas as categorias", zone: "Todas as zonas", user: "Todos os responsáveis", event: "Todos os eventos", origin: "Todas as origens" };

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const localDay = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function OccurrenceReportModal({ items, zones, users, events, categories, issuedBy, onClose }: {
  items: ReportOccurrence[];
  zones: Map<number, string>;
  users: Map<number, string>;
  events: { id: number; nome: string }[];
  categories: Record<string, string>;
  issuedBy: string;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState({ status: "", category: "", zone: "", user: "", event: "", origin: "", start: "", end: "" });
  const [error, setError] = useState("");
  const invalidPeriod = Boolean(filters.start && filters.end && filters.start > filters.end);
  const filtered = items.filter((o) => {
    const day = localDay(o.created_at);
    return (!filters.status || getOccurrenceStatusMeta(o.status).key === filters.status)
      && (!filters.category || o.categoria === filters.category)
      && (!filters.zone || String(o.zona ?? "none") === filters.zone)
      && (!filters.user || String(o.tecnico_responsavel ?? "none") === filters.user)
      && (!filters.event || String(o.evento ?? "none") === filters.event)
      && (!filters.origin || origin(o) === filters.origin)
      && (!filters.start || Boolean(day && day >= filters.start))
      && (!filters.end || Boolean(day && day <= filters.end));
  });
  const statuses = [...new Map(items.map((o) => { const meta = getOccurrenceStatusMeta(o.status); return [meta.key, meta.label]; })).entries()];
  const selects = [
    { key: "event" as const, label: "Evento", options: [...new Set(items.map((o) => o.evento))].map((id) => [String(id ?? "none"), id == null ? "Sem evento" : reportText(events.find((e) => e.id === id)?.nome ?? `Evento ${id}`)]) },
    { key: "origin" as const, label: "Origem", options: Object.entries(originLabels) },
    { key: "status" as const, label: "Status", options: statuses },
    { key: "category" as const, label: "Categoria", options: [...new Set(items.map((o) => o.categoria))].map((c) => [c, categories[c] ?? reportLabel(c)]) },
    { key: "zone" as const, label: "Zona", options: [...new Set(items.map((o) => o.zona))].map((id) => [String(id ?? "none"), id === null ? "Sem zona" : reportText(zones.get(id) ?? `Zona ${id}`)]) },
    { key: "user" as const, label: "Responsável", options: [...new Set(items.map((o) => o.tecnico_responsavel))].map((id) => [String(id ?? "none"), id === null ? "Não atribuído" : users.get(id) ?? `Usuário ${id}`]) },
  ];
  const generate = () => {
    if (invalidPeriod || !filtered.length) return;
    const popup = window.open("", "_blank");
    if (!popup) { setError("Permita pop-ups para abrir o relatório."); return; }
    popup.opener = null;
    const rows = filtered.map((o) => `<section class="occurrence"><header><small>OCORRÊNCIA ${o.id}</small><h2>${escape(reportTitle(o.titulo))}</h2><span>${escape(getOccurrenceStatusMeta(o.status).label)}</span></header><dl>${[
      ["Categoria", categories[o.categoria] ?? reportLabel(o.categoria)],
      ["Evento", o.evento == null ? "Sem evento" : reportText(events.find((e) => e.id === o.evento)?.nome ?? `Evento ${o.evento}`)],
      ["Origem", originLabels[origin(o)]],
      ["Registrada em", localDay(o.created_at) ? new Date(o.created_at).toLocaleString("pt-BR") : "Não informada"],
      ["Responsável", o.tecnico_responsavel == null ? "Não atribuído" : users.get(o.tecnico_responsavel) ?? `Usuário ${o.tecnico_responsavel}`],
      ["Zona", o.zona == null ? "Sem zona" : reportText(zones.get(o.zona) ?? `Zona ${o.zona}`)],
      ["Endereço", o.endereco || "Não informado"],
    ].map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl><p class="description">${escape(o.descricao || "Descrição não informada")}</p><footer>Danos: ${escape(money(Number(o.custo_danos) || 0))} · Fatalidades: ${o.fatalidades ?? 0}</footer></section>`).join("");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de ocorrências - Gardian</title><style>
      *{box-sizing:border-box}body{margin:0;background:#e6ecef;color:#142337;font:13px "Trebuchet MS","Segoe UI",sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar{padding:12px;text-align:center;background:#0d1b2e}.toolbar button{font-family:inherit;padding:12px 20px;border:0;border-radius:8px;background:#007d73;color:white;cursor:pointer}.report{max-width:210mm;margin:24px auto;background:white}.hero{padding:32px;background:#0d1b2e;color:white}.hero img{width:150px}.hero p{line-height:1.6;color:#d4e1e5}h1{font-size:28px}main{padding:28px}.metrics{display:flex;gap:12px;margin-bottom:24px}.metrics div{flex:1;padding:16px;background:#eef5f4;border-radius:8px}.metrics strong{display:block;font-size:24px;margin-top:8px}.occurrence{border:1px solid #dce4e8;border-radius:8px;margin-bottom:20px;overflow-wrap:anywhere}.occurrence header{padding:16px;background:#f1f5f6;break-after:avoid}h2{font-size:18px;margin:8px 0}small,dt{color:#007d73}.occurrence small,.occurrence dt{font-weight:700;font-size:14px}dl{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;margin:0}dd{margin:5px 0 0}dl>div{break-inside:avoid}.description{white-space:pre-wrap;padding:0 16px;line-height:1.6}.occurrence footer{padding:16px;border-top:1px solid #dce4e8}.note{line-height:1.6;color:#536777;font-size:11px;margin:0 0 18px} @page{size:A4;margin:12mm}@media print{body{background:white}.toolbar{display:none}.report{margin:0;max-width:none}main{padding:24px 0}.metrics{break-inside:avoid}}@media(max-width:600px){.metrics{flex-direction:column}dl{grid-template-columns:1fr}.report{margin:0}}
      </style></head><body><div class="toolbar"><button onclick="window.print()">Salvar ou imprimir PDF</button></div><article class="report"><header class="hero"><img src="${escape(new URL("/logo/logo_branco_sem_fundo.svg", window.location.origin).href)}" alt="Gardian"><h1>Relatório de ocorrências</h1><p>Emitido em ${escape(new Date().toLocaleString("pt-BR"))} por ${escape(issuedBy)}</p></header><main><div class="metrics"><div>Ocorrências<strong>${filtered.length}</strong></div><div>Custo dos danos<strong>${escape(money(filtered.reduce((sum, o) => sum + (Number(o.custo_danos) || 0), 0)))}</strong></div><div>Fatalidades<strong>${filtered.reduce((sum, o) => sum + (o.fatalidades ?? 0), 0)}</strong></div></div>${rows}</main></article></body></html>`);
    popup.document.close();
    setError("");
  };
  const fieldClass = "w-full min-w-0 h-12 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 text-sm text-primary transition-colors hover:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary";
  return <ModalShell open onClose={onClose} maxWidth="max-w-2xl">
    <div className="shrink-0 px-6 py-5 border-b border-outline-variant/20"><h2 className="text-xl font-bold text-primary">Relatório de ocorrências</h2><p className="mt-2 text-sm text-on-surface-variant">Escolha quais ocorrências da página carregada incluir.</p></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {selects.map((s) => (
          <label key={s.key} className="min-w-0 text-xs font-semibold text-on-surface-variant">
            {s.label}
            <span className="relative mt-2 block">
              <select className={`${fieldClass} appearance-none pr-12`} value={filters[s.key]} onChange={(e) => setFilters({ ...filters, [s.key]: e.target.value })}>
                <option value="">{allLabels[s.key]}</option>
                {s.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </label>
        ))}
      </div>
      <fieldset className="mt-6 border-t border-outline-variant/20 pt-4">
        <legend className="pr-3 text-xs font-semibold text-on-surface-variant">Período de registro</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <label className="min-w-0 text-xs font-medium text-on-surface-variant">De<input type="date" className={`${fieldClass} mt-2`} value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} /></label>
          <label className="min-w-0 text-xs font-medium text-on-surface-variant">Até<input type="date" className={`${fieldClass} mt-2`} value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} /></label>
        </div>
      </fieldset>
      <p className={`mt-5 text-right text-sm ${invalidPeriod ? "text-error" : "text-on-surface-variant"}`} role="status">{invalidPeriod ? "A data final deve ser igual ou posterior à inicial." : `${filtered.length} ${filtered.length === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}`}</p>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </div>
    <div className="shrink-0 flex flex-wrap justify-end gap-3 border-t border-outline-variant/20 p-5"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="primary" icon="description" disabled={invalidPeriod || !filtered.length} onClick={generate}>Gerar relatório</Btn></div>
  </ModalShell>;
}
