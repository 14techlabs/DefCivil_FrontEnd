"use client";

import { useState } from "react";
import { reportLabel, reportTitle, reportText } from "@/app/lib/reportLabels";
import { api } from "@/app/services/Api";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
import { ModalShell } from "./Modals";
import { Btn } from "./Primitives";

interface ReportEvent {
  id: number; nome: string; tipo: string; status: string | null;
  descricao: string; resumo_publico: string; recomendacoes: string[];
  data_inicio: string | null; data_fim: string | null; zonas: number[]; ocorrencias_count: number;
  rota_ia?: { prioridade: string; distanciaTotal: string; tempoEstimado: string; paradas: { ordem: number; local: string; motivo: string; eta: string }[] } | null;
}
interface Occurrence {
  id: number; titulo: string; descricao: string; status: string; categoria: string;
  endereco?: string; created_at: string; fatalidades?: number; custo_danos?: string | null;
}
interface Entry { id: number; titulo: string; detalhe: string; data_hora: string; autor_nome: string | null }
const e = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const label = (v: string | null) => v ? reportLabel(v) : "Não informado";
const typeLabel = (v: string) => v === "mitigacao" ? "Mitigação" : v === "desastre" ? "Desastre" : label(v);
const date = (v: string | null) => !v || Number.isNaN(new Date(v).getTime()) ? "Não informada" : new Date(v).toLocaleString("pt-BR");
const day = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const detail = (name: string, value: unknown) => `<div><dt>${e(name)}</dt><dd>${e(value)}</dd></div>`;
const metric = (name: string, value: unknown) => `<div><span>${e(name)}</span><strong>${e(value)}</strong></div>`;
const section = (name: string, value: string) => `<section class="section"><h3>${e(name)}</h3><p class="text">${e(value || "Não informado")}</p></section>`;

export function EventReportModal({ events, zones, issuedBy, onClose }: {
  events: ReportEvent[]; zones: { id: number; nome: string }[]; issuedBy: string; onClose: () => void;
}) {
  const [filters, setFilters] = useState({ search: "", type: "", status: "", zone: "", start: "", end: "" });
  const [selected, setSelected] = useState<number[]>(events.map(item => item.id));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const invalid = Boolean(filters.start && filters.end && filters.start > filters.end);
  const filtered = events.filter(item => (!filters.search || `${item.nome} ${reportText(item.nome)} ${item.id}`.toLocaleLowerCase("pt-BR").includes(filters.search.toLocaleLowerCase("pt-BR")))
    && (!filters.type || item.tipo === filters.type) && (!filters.status || (item.status ?? "none") === filters.status)
    && (!filters.zone || (filters.zone === "none" ? !item.zonas.length : item.zonas.includes(Number(filters.zone))))
    && (!filters.start || day(item.data_inicio) >= filters.start)
    && (!filters.end || Boolean(day(item.data_inicio) && day(item.data_inicio) <= filters.end)));
  const chosen = filtered.filter(item => selected.includes(item.id));
  const generate = async () => {
    if (busy || invalid || !chosen.length) return;
    const popup = window.open("", "_blank");
    if (!popup) { setError("Permita pop-ups para abrir o relatório."); return; }
    popup.opener = null;
    popup.document.body.textContent = "Gerando documento…";
    setBusy(true); setError("");
    try {
      const blocks: string[] = [];
      for (const item of chosen) {
        const updateProgress = () => {
          const message = "Gerando documento…";
          setProgress(message);
          if (!popup.closed) popup.document.body.textContent = message;
        };
        updateProgress();
        const [eventResponse, occurrenceResponse, historyResponse] = await Promise.all([
          api.get<{ eventos: ReportEvent }>(`/eventos/${item.id}/`),
          api.get<{ ocorrencias: Occurrence[]; paginacao?: { total_objetos: number; total_paginas: number } }>("/ocorrencias/", { params: { evento_id: item.id, pagina: 1, quantidade_por_pagina: 50 } }),
          api.get<{ entradas: Entry[] }>(`/eventos/${item.id}/timeline/`),
        ]);
        const event = eventResponse.data.eventos;
        const occurrences = [...occurrenceResponse.data.ocorrencias];
        const entries = historyResponse.data.entradas;
        if (!event || !Array.isArray(occurrences) || !Array.isArray(entries)) throw new Error("Resposta incompleta");
        const total = occurrenceResponse.data.paginacao?.total_objetos ?? event.ocorrencias_count;
        const pages = occurrenceResponse.data.paginacao?.total_paginas ?? 1;
        if (!Number.isInteger(pages) || pages < 1 || !Number.isInteger(total) || total < 0) throw new Error("Paginação inválida");
        for (let page = 2; page <= pages; page++) {
          if (popup.closed) throw new Error("Relatório fechado");
          updateProgress();
          const response = await api.get<{ ocorrencias: Occurrence[]; paginacao: { pagina: number; total_objetos: number; total_paginas: number } }>("/ocorrencias/", {
            params: { evento_id: item.id, pagina: page, quantidade_por_pagina: 50 },
          });
          if (!Array.isArray(response.data.ocorrencias) || response.data.paginacao?.pagina !== page
            || response.data.paginacao.total_objetos !== total || response.data.paginacao.total_paginas !== pages) {
            throw new Error("Os dados mudaram durante a consulta");
          }
          occurrences.push(...response.data.ocorrencias);
        }
        if (occurrences.length !== total || new Set(occurrences.map(o => o.id)).size !== total) {
          throw new Error("Listagem incompleta ou duplicada");
        }
        const counts = new Map<string, number>();
        for (const o of occurrences) { const status = getOccurrenceStatusMeta(o.status).label; counts.set(status, (counts.get(status) ?? 0) + 1); }
        const route = event.rota_ia;
        blocks.push(`<article class="event"><header class="event-title"><small>EVENTO ${event.id}</small><h2>${e(reportText(event.nome))}</h2><p>${e(typeLabel(event.tipo))} · ${e(label(event.status))}</p></header>
          <div class="metrics">${metric("Ocorrências vinculadas", total)}${metric("Zonas vinculadas", event.zonas.length)}${metric("Custo dos danos", money(occurrences.reduce((s, o) => s + (Number(o.custo_danos) || 0), 0)))}${metric("Fatalidades", occurrences.reduce((s, o) => s + (o.fatalidades ?? 0), 0))}</div>
          
          <div class="statuses">${[...counts].map(([status, count]) => `<span>${e(status)} <b>${count}</b></span>`).join("") || "Nenhuma ocorrência vinculada."}</div>
          <dl>${detail("Início", date(event.data_inicio))}${detail("Fim", date(event.data_fim))}${detail("Zonas", event.zonas.map(id => reportText(zones.find(z => z.id === id)?.nome ?? `Zona ${id}`)).join(", ") || "Sem zona vinculada")}</dl>
          ${section("Descrição do evento", event.descricao)}${section("Resumo público", event.resumo_publico)}
          <section class="section"><h3>Recomendações</h3>${event.recomendacoes?.length ? `<ul>${event.recomendacoes.map(r => `<li>${e(r)}</li>`).join("")}</ul>` : "<p>Não informadas.</p>"}</section>
          <section class="section"><h3>Ocorrências vinculadas (${occurrences.length})</h3>${occurrences.map(o => `<div class="record"><h4>${o.id} · ${e(reportTitle(o.titulo))}</h4><p>${e(getOccurrenceStatusMeta(o.status).label)} · ${e(date(o.created_at))}</p><p><b>Endereço:</b> ${e(o.endereco || "Não informado")}</p><p class="text">${e(o.descricao || "Descrição não informada")}</p><p><b>Danos:</b> ${e(money(Number(o.custo_danos) || 0))} · <b>Fatalidades:</b> ${o.fatalidades ?? 0}</p></div>`).join("") || "<p>Nenhuma ocorrência vinculada.</p>"}</section>
          <section class="section"><h3>Histórico do evento</h3>${entries.map(t => `<div class="record"><h4>${e(reportTitle(t.titulo))}</h4><p>${e(date(t.data_hora))} · ${e(t.autor_nome || "Autor não informado")}</p><p class="text">${e(reportText(t.detalhe))}</p></div>`).join("") || "<p>Nenhum registro no histórico.</p>"}</section>
          <section class="section"><h3>Rota sugerida pela IA</h3>${route?.paradas?.length ? `<p>Prioridade: ${e(label(route.prioridade))} · Distância: ${e(route.distanciaTotal)} · Tempo estimado: ${e(route.tempoEstimado)}</p><ol>${[...route.paradas].sort((a, b) => a.ordem - b.ordem).map(p => `<li><b>${e(reportText(p.local))}</b> · ${e(p.eta)}<p>${e(reportText(p.motivo))}</p></li>`).join("")}</ol>` : "<p>Nenhuma rota disponível.</p>"}</section></article>`);
      }
      if (popup.closed) return;
      popup.document.open();
      popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de eventos - Gardian</title><style>
      *{box-sizing:border-box}body{margin:0;background:#e6ecef;color:#142337;font:13px "Trebuchet MS","Segoe UI",sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}.toolbar{padding:12px;text-align:center;background:#0d1b2e}.toolbar button{font:inherit;padding:12px 20px;background:#007d73;color:white;border:0;border-radius:8px;cursor:pointer}.report{max-width:210mm;margin:24px auto;background:white}.hero{padding:32px;background:#0d1b2e;color:white}.hero img{width:150px}h1{font-size:28px}.hero p{color:#d4e1e5}main{padding:28px}h2{font-size:22px;margin:8px 0}h3{font-size:16px;color:#007d73;margin:0 0 12px;break-after:avoid}h4{font-size:14px;margin:0 0 8px;color:#007d73;break-after:avoid}small,dt{color:#007d73;font-weight:700}.event{margin:28px 0 0;padding-top:22px;border-top:3px solid #007d73;overflow-wrap:anywhere}.event-title{break-after:avoid}.event-title p{margin-bottom:20px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;break-inside:avoid}.metrics>div{padding:16px;background:#eef5f4;border-radius:8px}.metrics strong{display:block;font-size:23px;margin-top:8px}.metrics span{font-size:11px}.statuses{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.statuses span{padding:8px;background:#edf7f5;border-radius:6px}.statuses b{margin-left:8px}dl{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}dl>div{break-inside:avoid}dd{margin:5px 0 0;line-height:1.5}.section{margin-top:24px}.text{white-space:pre-wrap;line-height:1.65}.record{border:1px solid #dce4e8;border-radius:8px;padding:16px;margin:12px 0}.record p{margin:6px 0}li{line-height:1.6;margin-bottom:8px}.notice{background:#fff5df;color:#755013;padding:12px;line-height:1.6} @page{size:A4;margin:12mm}@media print{body{background:white}.toolbar{display:none}.report{max-width:none;margin:0}main{padding:20px 0}.event+.event{break-before:page}}@media(max-width:600px){.report{margin:0}main,.hero{padding:20px}.metrics,dl{grid-template-columns:1fr}}
      </style></head><body><div class="toolbar"><button onclick="window.print()">Salvar ou imprimir PDF</button></div><div class="report"><header class="hero"><img src="${e(new URL("/logo/logo_branco_sem_fundo.svg", window.location.origin).href)}" alt="Gardian"><h1>Relatório de eventos</h1><p>Emitido em ${e(new Date().toLocaleString("pt-BR"))} por ${e(issuedBy)}</p></header><main>${blocks.join("")}</main></div></body></html>`);
      popup.document.close();
    } catch {
      popup.close();
      setError("Não foi possível carregar todos os dados dos eventos selecionados. Tente novamente.");
    } finally { setBusy(false); }
  };
  const field = "mt-2 w-full h-11 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-primary focus:ring-2 focus:ring-secondary";
  const dropdowns = [
    { key: "type" as const, title: "Tipo", options: [["desastre", "Desastre"], ["mitigacao", "Mitigação"]] },
    { key: "status" as const, title: "Status", options: [...new Set(events.map(ev => ev.status))].map(s => [s ?? "none", label(s)]) },
    { key: "zone" as const, title: "Zona", options: [["none", "Sem zona"], ...zones.map(z => [String(z.id), reportText(z.nome)])] },
  ];
  return <ModalShell open onClose={() => { if (!busy) onClose(); }} maxWidth="max-w-3xl"><header className="shrink-0 p-6 border-b border-outline-variant/20"><h2 className="text-xl font-bold text-primary">Relatório de eventos</h2><p className="mt-2 text-sm text-on-surface-variant">Selecione os eventos. Cada um terá suas estatísticas e informações detalhadas.</p></header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><fieldset disabled={busy} className="min-w-0 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-xs font-semibold">Nome ou número<input className={field} value={filters.search} onChange={ev => setFilters({ ...filters, search: ev.target.value })} /></label>
        {dropdowns.map(d => <label key={d.key} className="text-xs font-semibold">{d.title}<span className="relative block"><select className={`${field} appearance-none pr-10`} value={filters[d.key]} onChange={ev => setFilters({ ...filters, [d.key]: ev.target.value })}><option value="">Todos</option>{d.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-4 top-6 h-4 w-4" fill="none"><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.8" /></svg></span></label>)}
        <label className="text-xs font-semibold">Início do evento: de<input type="date" className={field} value={filters.start} onChange={ev => setFilters({ ...filters, start: ev.target.value })} /></label><label className="text-xs font-semibold">Até<input type="date" className={field} value={filters.end} onChange={ev => setFilters({ ...filters, end: ev.target.value })} /></label></div>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm"><strong>{chosen.length} eventos selecionados</strong><button type="button" className="text-secondary font-semibold" onClick={() => setSelected(chosen.length === filtered.length ? selected.filter(id => !filtered.some(ev => ev.id === id)) : [...new Set([...selected, ...filtered.map(ev => ev.id)])])}>{chosen.length === filtered.length ? "Desmarcar exibidos" : "Selecionar exibidos"}</button></div>
      <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-outline-variant/20">{filtered.map(ev => <label key={ev.id} className="flex items-center gap-3 p-3 border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low"><input type="checkbox" className="accent-[#007d73]" checked={selected.includes(ev.id)} onChange={() => setSelected(selected.includes(ev.id) ? selected.filter(id => id !== ev.id) : [...selected, ev.id])} /><span className="min-w-0"><span className="block font-semibold text-sm">{ev.id} · {reportText(ev.nome)}</span><span className="text-xs text-on-surface-variant">{typeLabel(ev.tipo)} · {label(ev.status)}</span></span></label>)}{!filtered.length && <p className="p-4 text-sm">Nenhum evento encontrado.</p>}</div>
      {invalid && <p role="alert" className="mt-3 text-sm text-error">A data final deve ser igual ou posterior à inicial.</p>}{error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    {busy && <p role="status" className="mt-3 text-sm text-secondary">{progress}</p>}</fieldset></div><footer className="relative z-10 shrink-0 flex flex-wrap justify-end gap-3 bg-white p-5 border-t border-outline-variant/20"><Btn variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Btn><Btn variant="primary" icon="description" disabled={busy || invalid || !chosen.length} onClick={() => void generate()}>{busy ? "Preparando…" : "Gerar relatório"}</Btn></footer></ModalShell>;
}
