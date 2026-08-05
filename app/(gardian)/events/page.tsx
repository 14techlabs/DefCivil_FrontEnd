"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, Chip, Icon, MetaTag, SectionHeader, StatusDot, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_EVENTOS,
  MOCK_OCORRENCIAS,
  zonaNome,
  type MockEvento,
} from "@/app/data/mock";
import { PRIORIDADE_META, type RouteStop } from "@/app/components/RouteMap";

const RouteMap = dynamic(
  () => import("@/app/components/RouteMap").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low min-h-[460px]">
        <p className="text-sm text-on-surface-variant font-medium">Carregando rota…</p>
      </div>
    ),
  },
);

const NIVEL_DOT: Record<string, string> = {
  info: "bg-secondary",
  atencao: "bg-orange-500",
  critico: "bg-error",
};

const ORIGEM_META: Record<string, { icon: string; label: string; cls: string }> = {
  campo: { icon: "engineering", label: "Equipe em campo", cls: "text-primary bg-primary/8" },
  sistema: { icon: "sensors", label: "Sistema", cls: "text-secondary bg-secondary/10" },
  cidadao: { icon: "person", label: "Cidadão", cls: "text-orange-700 bg-orange-100" },
};

export default function EventsPage() {
  const { showToast } = useGardian();

  const [eventos, setEventos] = useState<MockEvento[]>(MOCK_EVENTOS);
  const [selectedId, setSelectedId] = useState<number>(MOCK_EVENTOS[0]?.id ?? 0);
  const [tab, setTab] = useState<"tempo_real" | "rota" | "timeline" | "publico">("tempo_real");
  const [paradaAtiva, setParadaAtiva] = useState<number | null>(null);

  // edição do resumo público
  const [editandoPublico, setEditandoPublico] = useState(false);
  const [rascunhoResumo, setRascunhoResumo] = useState("");
  const [rascunhoRecs, setRascunhoRecs] = useState<string[]>([]);

  const evento = useMemo(
    () => eventos.find((e) => e.id === selectedId) ?? eventos[0],
    [eventos, selectedId],
  );

  const ocorrenciasVinculadas = useMemo(
    () => MOCK_OCORRENCIAS.filter((o) => o.evento === evento?.id),
    [evento],
  );

  const toggleVinculacao = () => {
    setEventos((prev) =>
      prev.map((e) =>
        e.id === evento.id ? { ...e, vinculacaoAtiva: !e.vinculacaoAtiva } : e,
      ),
    );
    showToast(
      evento.vinculacaoAtiva
        ? "Vinculação automática desligada."
        : "Vinculação ligada — toda ocorrência enviada será vinculada a este evento.",
    );
  };

  const abrirEdicaoPublico = () => {
    setRascunhoResumo(evento.resumoPublico);
    setRascunhoRecs([...evento.recomendacoes]);
    setEditandoPublico(true);
  };

  const salvarPublico = () => {
    if (!rascunhoResumo.trim()) {
      showToast("O resumo público não pode ficar vazio.", "error");
      return;
    }
    setEventos((prev) =>
      prev.map((e) =>
        e.id === evento.id
          ? {
              ...e,
              resumoPublico: rascunhoResumo.trim(),
              recomendacoes: rascunhoRecs.map((r) => r.trim()).filter(Boolean),
            }
          : e,
      ),
    );
    setEditandoPublico(false);
    showToast("Resumo público atualizado — já visível na página pública.");
  };

  if (!evento) return null;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GERENCIAMENTO DE EVENTOS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{eventos.filter((e) => e.status !== "encerrado").length} ATIVO(S)</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Eventos
        </h1>
      </header>

      <div className="grid grid-cols-12 gap-5">
        {/* Seleção de evento */}
        <aside className="col-span-12 lg:col-span-4 space-y-3">
          {eventos.map((e) => {
            const active = e.id === evento.id;
            const nOc = MOCK_OCORRENCIAS.filter((o) => o.evento === e.id).length;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`w-full card-tonal p-5 shadow-ambient-sm text-left relative overflow-hidden transition-all hover:shadow-ambient ${
                  active ? "ring-2 ring-secondary" : ""
                }`}
              >
                <span
                  className={`absolute top-0 left-0 bottom-0 w-1 ${
                    e.status === "ativo" ? "bg-error" : e.status === "monitorando" ? "bg-orange-500" : "bg-slate-300"
                  }`}
                />
                <div className="pl-3">
                  <div className="flex items-center justify-between mb-2">
                    <Chip tone={e.status === "ativo" ? "error" : e.status === "monitorando" ? "warning" : "neutral"}>
                      {e.status === "ativo" ? "ATIVO" : e.status === "monitorando" ? "MONITORANDO" : "ENCERRADO"}
                    </Chip>
                    {e.vinculacaoAtiva && (
                      <span className="flex items-center gap-1.5">
                        <StatusDot tone="secondary" />
                        <MetaTag className="text-secondary">VINCULANDO</MetaTag>
                      </span>
                    )}
                  </div>
                  <p className="font-headline font-bold text-[15px] text-primary leading-snug">{e.nome}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">{e.tipo}</p>
                  <div className="flex items-center gap-3 mt-3 text-[10px] font-mono font-bold uppercase tracking-mono text-slate-400">
                    <span>{nOc} OCORRÊNCIAS</span>
                    <span>·</span>
                    <span>{e.zonas.length} ZONAS</span>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Painel do evento selecionado */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Cabeçalho do evento + vinculação */}
          <div className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <MetaTag className="text-secondary block mb-2">EVENTO #{evento.id}</MetaTag>
                <h2 className="font-headline font-black text-3xl tracking-tighter text-primary">{evento.nome}</h2>
                <div className="flex flex-wrap gap-2 mt-3">
                  {evento.zonas.map((z) => (
                    <Chip key={z} tone="neutral" icon="hub">{zonaNome(z)}</Chip>
                  ))}
                </div>
              </div>

              <div className="card-recessed p-4 min-w-[240px]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-mono-tight text-primary">
                      Vinculação automática
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 max-w-[180px]">
                      Enquanto ligada, toda ocorrência enviada é vinculada a este evento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVinculacao}
                    disabled={evento.status === "encerrado"}
                    aria-label="Alternar vinculação automática"
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
                      evento.vinculacaoAtiva ? "bg-secondary" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        evento.vinculacaoAtiva ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex flex-wrap gap-2">
            <Tab active={tab === "tempo_real"} onClick={() => setTab("tempo_real")} icon="podcasts">
              Tempo Real
            </Tab>
            <Tab active={tab === "rota"} onClick={() => setTab("rota")} icon="route">
              Rota IA
            </Tab>
            <Tab active={tab === "timeline"} onClick={() => setTab("timeline")} icon="timeline">
              Timeline
            </Tab>
            <Tab active={tab === "publico"} onClick={() => setTab("publico")} icon="campaign">
              Resumo Público
            </Tab>
          </div>

          {/* ── Tempo real ── */}
          {tab === "tempo_real" && (
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline="RELATÓRIO EM TEMPO REAL"
                title="Dados que chegam do campo"
                action={
                  <span className="flex items-center gap-1.5">
                    <StatusDot tone="error" />
                    <MetaTag className="text-error">AO VIVO</MetaTag>
                  </span>
                }
              />
              {evento.tempoReal.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant italic">
                  Sem transmissões — evento encerrado.
                </p>
              ) : (
                <div className="space-y-3">
                  {evento.tempoReal.map((t, i) => {
                    const meta = ORIGEM_META[t.origem];
                    return (
                      <div key={i} className="flex gap-3 p-4 rounded-lg bg-surface-container-low">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon name={meta.icon} filled className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-primary">{t.autor}</span>
                            <MetaTag>{meta.label}</MetaTag>
                            <MetaTag className="text-secondary">{t.hora}</MetaTag>
                          </div>
                          <p className="text-[12px] text-on-surface mt-1 leading-relaxed">{t.msg}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ocorrências vinculadas */}
              <div className="mt-6 pt-5 border-t border-outline-variant/20">
                <MetaTag className="block mb-3">OCORRÊNCIAS VINCULADAS ({ocorrenciasVinculadas.length})</MetaTag>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ocorrenciasVinculadas.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 text-[12px] text-on-surface p-2.5 rounded-lg bg-surface-container-low">
                      <Icon name="emergency" className="text-error text-[16px] shrink-0" />
                      <span className="font-bold text-primary">#{o.id}</span>
                      <span className="truncate">{o.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Rota IA ── */}
          {tab === "rota" && (
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline="BACKTRACKING VEICULAR"
                title="Rota otimizada para os agentes"
                action={<Chip tone="primarySoft" icon="psychology">GERADA PELA IA</Chip>}
              />

              {evento.rotaIA.paradas.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant italic">Sem rota ativa para este evento.</p>
              ) : (
                <>
                  <div className="card-recessed p-4 mb-5 flex flex-wrap items-center gap-x-8 gap-y-2">
                    <div>
                      <MetaTag className="block">PRIORIDADE</MetaTag>
                      <p className="text-[12px] font-bold text-primary mt-0.5">{evento.rotaIA.prioridade}</p>
                    </div>
                    <div>
                      <MetaTag className="block">PARADAS</MetaTag>
                      <p className="text-[12px] font-bold text-primary mt-0.5">{evento.rotaIA.paradas.length}</p>
                    </div>
                    <div>
                      <MetaTag className="block">DISTÂNCIA</MetaTag>
                      <p className="text-[12px] font-bold text-primary mt-0.5">{evento.rotaIA.distanciaTotal}</p>
                    </div>
                    <div>
                      <MetaTag className="block">TEMPO ESTIMADO</MetaTag>
                      <p className="text-[12px] font-bold text-primary mt-0.5">{evento.rotaIA.tempoEstimado}</p>
                    </div>
                  </div>

                  {/* mapa da rota */}
                  <div className="mb-5">
                    <RouteMap
                      stops={evento.rotaIA.paradas as RouteStop[]}
                      height={460}
                      activeStop={paradaAtiva}
                      onSelectStop={(o) => setParadaAtiva(o === paradaAtiva ? null : o)}
                    />
                  </div>

                  {/* sequência de paradas */}
                  <MetaTag className="block mb-3">SEQUÊNCIA DE ATENDIMENTO</MetaTag>
                  <div className="space-y-2">
                    {evento.rotaIA.paradas.map((p) => {
                      const meta = PRIORIDADE_META[p.prioridade];
                      const ativo = paradaAtiva === p.ordem;
                      return (
                        <button
                          key={p.ordem}
                          type="button"
                          onClick={() => setParadaAtiva(ativo ? null : p.ordem)}
                          className={`w-full flex items-start gap-4 p-4 rounded-lg text-left transition-all ${
                            ativo ? "bg-surface-container ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"
                          }`}
                        >
                          <span
                            className="w-8 h-8 rounded-full text-white text-[13px] font-black flex items-center justify-center shrink-0"
                            style={{ background: meta.color }}
                          >
                            {p.ordem}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <p className="text-[13px] font-bold text-primary">{p.local}</p>
                              <Chip tone="secondary" icon="schedule">ETA {p.eta}</Chip>
                            </div>
                            <p className="text-[11px] text-on-surface-variant mt-1">{p.motivo}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-mono-tight text-white"
                                style={{ background: meta.color }}
                              >
                                <Icon name={meta.icon} className="text-[12px]" />
                                {meta.label}
                              </span>
                              {p.ocorrenciaId && <MetaTag>OCORRÊNCIA #{p.ocorrenciaId}</MetaTag>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Timeline ── */}
          {tab === "timeline" && (
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="CRESCIMENTO E DIMENSÃO" title="Timeline do Evento" />
              <div className="relative pl-6">
                <span className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/50" />
                <div className="space-y-5">
                  {evento.timeline.map((t, i) => (
                    <div key={i} className="relative">
                      <span
                        className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow ${NIVEL_DOT[t.nivel]}`}
                      />
                      <MetaTag className="text-secondary">{t.hora}</MetaTag>
                      <p className="text-[13px] font-bold text-primary mt-0.5">{t.titulo}</p>
                      <p className="text-[12px] text-on-surface-variant mt-0.5 leading-relaxed">{t.detalhe}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Resumo público ── */}
          {tab === "publico" && (
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline="EXIBIDO NA PARTE PÚBLICA DURANTE O EVENTO"
                title="Resumo e Recomendações"
                action={
                  <div className="flex gap-2">
                    <Btn variant="ghost" icon="visibility" onClick={() => window.open("/report", "_blank")}>
                      Ver página pública
                    </Btn>
                    {!editandoPublico ? (
                      <Btn variant="secondary" icon="edit" onClick={abrirEdicaoPublico}>
                        Editar
                      </Btn>
                    ) : (
                      <Btn variant="ghost" icon="close" onClick={() => setEditandoPublico(false)}>
                        Cancelar
                      </Btn>
                    )}
                  </div>
                }
              />

              {!editandoPublico ? (
                <>
                  <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-7 text-white mb-5">
                    <Chip tone="secondary" className="!bg-white/15 !text-white">AVISO À POPULAÇÃO</Chip>
                    <p className="text-white/85 text-[14px] mt-4 leading-relaxed">{evento.resumoPublico}</p>
                  </div>
                  {evento.recomendacoes.length > 0 ? (
                    <div className="space-y-2">
                      {evento.recomendacoes.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-container-low">
                          <Icon name="verified_user" filled className="text-secondary text-[18px] mt-0.5 shrink-0" />
                          <p className="text-[13px] text-on-surface leading-relaxed">{r}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-on-surface-variant italic">
                      Nenhuma recomendação cadastrada. Use &quot;Editar&quot; para adicionar orientações à população.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-5">
                  <div>
                    <MetaTag className="block mb-2">RESUMO EXIBIDO À POPULAÇÃO</MetaTag>
                    <textarea
                      value={rascunhoResumo}
                      onChange={(e) => setRascunhoResumo(e.target.value)}
                      rows={4}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                    <p className="text-[10px] text-on-surface-variant mt-1.5">
                      {rascunhoResumo.length} caracteres
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <MetaTag>RECOMENDAÇÕES</MetaTag>
                      <Btn
                        variant="ghost"
                        icon="add"
                        onClick={() => setRascunhoRecs((prev) => [...prev, ""])}
                      >
                        Adicionar
                      </Btn>
                    </div>

                    <div className="space-y-2">
                      {rascunhoRecs.length === 0 && (
                        <p className="text-[12px] text-on-surface-variant italic">
                          Nenhuma recomendação. Clique em &quot;Adicionar&quot; para criar a primeira.
                        </p>
                      )}
                      {rascunhoRecs.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Icon name="verified_user" filled className="text-secondary text-[18px] mt-3 shrink-0" />
                          <textarea
                            value={r}
                            onChange={(e) =>
                              setRascunhoRecs((prev) =>
                                prev.map((x, idx) => (idx === i ? e.target.value : x)),
                              )
                            }
                            rows={2}
                            placeholder="Ex.: evite trafegar por vias alagadas…"
                            className="flex-1 bg-surface-container-low rounded-lg px-4 py-2.5 text-[13px] font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setRascunhoRecs((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="p-2 mt-1.5 rounded-lg hover:bg-surface-container transition-all shrink-0"
                            aria-label="Remover recomendação"
                          >
                            <Icon name="delete" className="text-on-surface-variant text-[18px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-outline-variant/20">
                    <Btn variant="success" icon="check" onClick={salvarPublico}>
                      Publicar alterações
                    </Btn>
                    <Btn variant="ghost" icon="close" onClick={() => setEditandoPublico(false)}>
                      Cancelar
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
