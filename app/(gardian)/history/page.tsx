"use client";

import { useState } from "react";
import { Bar, Chip, Icon, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import {
  MOCK_OCORRENCIAS,
  MOCK_HIST_PREVISOES_TEMPO,
  MOCK_HIST_PREVISOES_IA,
  MOCK_HIST_ACOES_EQUIPE,
  tecnicoNome,
  zonaNome,
} from "@/app/data/mock";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

const CATEGORIA_LABEL: Record<string, string> = {
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .toUpperCase()
    .replace(/\./g, "");
}

export default function HistoryPage() {
  const [tab, setTab] = useState<"ocorrencias" | "tempo" | "ia" | "equipe">("ocorrencias");

  const maxMm = Math.max(...MOCK_HIST_PREVISOES_TEMPO.map((p) => Math.max(p.previstoMm, p.realMm)));

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">REGISTROS DO SISTEMA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>DADOS RETROATIVOS</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Histórico
        </h1>
      </header>

      <div className="flex flex-wrap gap-2">
        <Tab active={tab === "ocorrencias"} onClick={() => setTab("ocorrencias")} icon="emergency">
          Todas as Ocorrências
        </Tab>
        <Tab active={tab === "tempo"} onClick={() => setTab("tempo")} icon="cloudy_snowing">
          Previsões de Tempo
        </Tab>
        <Tab active={tab === "ia"} onClick={() => setTab("ia")} icon="psychology">
          Previsões da IA
        </Tab>
        <Tab active={tab === "equipe"} onClick={() => setTab("equipe")} icon="footprint">
          Ações da Equipe
        </Tab>
      </div>

      {/* ── Todas as ocorrências ── */}
      {tab === "ocorrencias" && (
        <div className="card-tonal shadow-ambient-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-3.5 px-6"><MetaTag>OCORRÊNCIA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>CATEGORIA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>ZONA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>TÉCNICO</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>DATA</MetaTag></th>
                <th className="py-3.5 pr-6"><MetaTag>STATUS</MetaTag></th>
              </tr>
            </thead>
            <tbody>
              {[...MOCK_OCORRENCIAS]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((o) => (
                  <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                    <td className="py-3.5 px-6">
                      <p className="text-[13px] font-bold text-primary">#{o.id} · {o.titulo}</p>
                      <p className="text-[11px] text-on-surface-variant">{o.endereco}</p>
                    </td>
                    <td className="py-3.5 pr-4"><Chip tone="neutral">{CATEGORIA_LABEL[o.categoria] ?? o.categoria}</Chip></td>
                    <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{zonaNome(o.zona)}</td>
                    <td className="py-3.5 pr-4 text-[12px] text-on-surface">{o.tecnico_responsavel ? tecnicoNome(o.tecnico_responsavel) : "—"}</td>
                    <td className="py-3.5 pr-4 text-[11px] font-mono font-bold text-slate-400">{formatDate(o.created_at)}</td>
                    <td className="py-3.5 pr-6">
                      <Chip tone={getOccurrenceStatusMeta(o.status).tone}>
                        {getOccurrenceStatusMeta(o.status).label}
                      </Chip>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Previsões de tempo: previsto vs real ── */}
      {tab === "tempo" && (
        <div className="card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="COMPARATIVO"
            title="Previsto × Real (mm/24h)"
            action={
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                  <span className="w-3 h-3 rounded-sm bg-slate-300" /> Previsto
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                  <span className="w-3 h-3 rounded-sm bg-secondary" /> Real
                </span>
              </div>
            }
          />
          <div className="space-y-5">
            {MOCK_HIST_PREVISOES_TEMPO.map((p, i) => {
              const desvioAlto = Math.abs(p.desvio) >= 10;
              return (
                <div key={i} className="grid grid-cols-[64px_1fr_auto] gap-4 items-center">
                  <div>
                    <p className="text-[13px] font-black text-primary">{p.data}</p>
                    <MetaTag>{p.orgao}</MetaTag>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-slate-300" style={{ width: `${(p.previstoMm / maxMm) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 w-16 text-right">{p.previstoMm.toFixed(1)}mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${desvioAlto ? "bg-error" : "bg-secondary"}`}
                          style={{ width: `${(p.realMm / maxMm) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-primary w-16 text-right">{p.realMm.toFixed(1)}mm</span>
                    </div>
                  </div>
                  <Chip tone={desvioAlto ? "error" : Math.abs(p.desvio) >= 5 ? "warning" : "secondary"}>
                    {p.desvio > 0 ? "+" : ""}{p.desvio.toFixed(1)}mm
                  </Chip>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-6 flex items-center gap-1.5">
            <Icon name="info" className="text-[14px]" />
            Desvios acima de 10mm ficam destacados e realimentam a calibração dos modelos.
          </p>
        </div>
      )}

      {/* ── Previsões da IA (incluindo descartadas) ── */}
      {tab === "ia" && (
        <div className="space-y-3">
          {MOCK_HIST_PREVISOES_IA.map((p) => (
            <div key={p.id} className={`card-tonal p-6 shadow-ambient-sm relative overflow-hidden ${p.status === "descartado" ? "opacity-70" : ""}`}>
              <span
                className={`absolute top-0 left-0 bottom-0 w-1 ${
                  p.status === "aprovado" ? "bg-secondary" : p.status === "descartado" ? "bg-slate-300" : "bg-orange-500"
                }`}
              />
              <div className="pl-3 flex items-center gap-5 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">PREV-{p.id}</span>
                    <MetaTag>{p.data}</MetaTag>
                  </div>
                  <p className="text-[14px] font-bold text-primary">{p.titulo}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{zonaNome(p.zona)}</p>
                </div>
                <div className="w-40">
                  <div className="flex items-center justify-between mb-1">
                    <MetaTag>CONFIANÇA</MetaTag>
                    <span className="text-[12px] font-black text-primary">{p.confianca.toFixed(1).replace(".", ",")}%</span>
                  </div>
                  <Bar value={p.confianca} tone={p.confianca >= 85 ? "error" : p.confianca >= 60 ? "warning" : "secondary"} />
                </div>
                <Chip tone={p.status === "aprovado" ? "secondary" : p.status === "descartado" ? "neutral" : "warning"}>
                  {p.status.toUpperCase()}
                </Chip>
                <p className="w-full lg:w-auto lg:max-w-[320px] text-[11px] text-on-surface-variant leading-relaxed">{p.desfecho}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Ações da equipe ── */}
      {tab === "equipe" && (
        <div className="card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="ONDE CADA TÉCNICO ESTEVE E O QUE FEZ" title="Ações em Campo" />
          <div className="relative pl-6">
            <span className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/50" />
            <div className="space-y-6">
              {MOCK_HIST_ACOES_EQUIPE.map((a) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white shadow" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-black text-primary">{tecnicoNome(a.tecnico)}</span>
                    <MetaTag className="text-secondary">{a.quando}</MetaTag>
                    {a.ocorrenciaId && <Chip tone="neutral">#{a.ocorrenciaId}</Chip>}
                  </div>
                  <p className="text-[13px] text-on-surface mt-1">{a.acao}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1.5">
                    <Icon name="location_on" className="text-[13px]" /> {a.local} · {zonaNome(a.zona)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
