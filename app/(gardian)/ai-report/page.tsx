"use client";

import { useState } from "react";
import { Bar, Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import {
  MOCK_AI_REPORT,
  MOCK_POSSIVEIS_EVENTOS,
  zonaNome,
  type PossivelEvento,
} from "@/app/data/mock";

const ESTADO_TONE: Record<string, "error" | "warning" | "secondary"> = {
  critico: "error",
  atencao: "warning",
  estavel: "secondary",
};

export default function AiReportPage() {
  const { showToast } = useGardian();
  const { go } = useAppNavigation();
  const R = MOCK_AI_REPORT;

  const [possiveis, setPossiveis] = useState<PossivelEvento[]>(MOCK_POSSIVEIS_EVENTOS);
  const [expanded, setExpanded] = useState<number | null>(MOCK_POSSIVEIS_EVENTOS[0]?.id ?? null);

  const decidir = (id: number, decisao: "aprovado" | "descartado") => {
    setPossiveis((prev) => prev.map((p) => (p.id === id ? { ...p, status: decisao } : p)));
    if (decisao === "aprovado") {
      showToast("Possível evento aprovado — ocorrência preventiva gerada.");
    } else {
      showToast("Previsão descartada e registrada no histórico.", "error");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Cabeçalho */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">RELATÓRIO GERAL · {R.versao}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>GERADO EM {R.geradoEm}</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Grande Relatório de IA
          </h1>
          <div className="flex gap-3">
            <Btn variant="ghost" icon="arrow_back" onClick={() => go("dashboard")}>
              Painel Geral
            </Btn>
            <Btn variant="primary" icon="refresh" onClick={() => showToast("Relatório regenerado com os dados mais recentes.")}>
              Regenerar
            </Btn>
          </div>
        </div>
      </header>

      {/* Resumo executivo */}
      <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-[0.05]">
          <Icon name="psychology" filled className="text-[360px]" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <Chip tone="secondary" className="!bg-secondary/20 !text-secondary-container">
            SÍNTESE OPERACIONAL
          </Chip>
          <p className="text-white/85 text-[15px] mt-5 leading-relaxed">{R.resumo}</p>
        </div>
      </div>

      {/* Estatísticas */}
      <section>
        <SectionHeader overline="DADOS DE EVENTOS" title="Estatísticas do Período" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {R.estatisticas.map((e, i) => (
            <div key={i} className="card-tonal p-5 shadow-ambient-sm">
              <MetaTag className="block mb-3">{e.label}</MetaTag>
              <p className="font-headline font-black text-3xl text-primary tracking-tighter">{e.valor}</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-mono-tight mt-1.5">{e.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        {/* Indicadores considerados */}
        <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="MODELO"
            title="Indicadores Considerados"
            action={<Chip tone="primarySoft">PESOS DO MODELO</Chip>}
          />
          <div className="space-y-4">
            {R.indicadoresConsiderados.map((ind, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[12px] font-bold text-primary truncate">{ind.nome}</p>
                    <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 ml-3">
                      PESO {(ind.peso * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Bar
                    value={ind.peso * 100}
                    max={35}
                    tone={ind.estado === "critico" ? "error" : ind.estado === "atencao" ? "warning" : "secondary"}
                  />
                </div>
                <div className="w-28 shrink-0 text-right">
                  <p className="text-[12px] font-black text-primary">{ind.leitura}</p>
                  <Chip tone={ESTADO_TONE[ind.estado]} className="mt-1">
                    {ind.estado.toUpperCase()}
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Eventos similares / passados */}
        <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="A PARTIR DAS CONDIÇÕES ATUAIS" title="Eventos Similares" />
          <div className="space-y-3">
            {R.eventosSimilares.map((ev, i) => (
              <div key={i} className="card-recessed p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-primary">{ev.nome}</p>
                  <MetaTag>{ev.data}</MetaTag>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Bar value={ev.similaridade} tone={ev.similaridade >= 85 ? "error" : ev.similaridade >= 70 ? "warning" : "secondary"} className="flex-1" />
                  <span className="text-[11px] font-black text-primary shrink-0">{ev.similaridade}%</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">{ev.desfecho}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Possíveis eventos → aprovação vira ocorrência */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader
          overline="PREVISÕES ATIVAS"
          title="Possíveis Eventos"
          action={
            <Chip tone="warning" icon="pending">
              {possiveis.filter((p) => p.status === "pendente").length} PENDENTES
            </Chip>
          }
        />
        <p className="text-[12px] text-on-surface-variant -mt-3 mb-6 max-w-2xl">
          Previsões geradas pela IA a partir das condições atuais. Ao aprovar, o possível evento é
          convertido em ocorrência preventiva; ao descartar, fica registrado no histórico.
        </p>

        <div className="space-y-3">
          {possiveis.map((p) => {
            const open = expanded === p.id;
            return (
              <div
                key={p.id}
                className={`card-recessed overflow-hidden transition-all ${
                  p.status === "descartado" ? "opacity-55" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : p.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      p.confianca >= 85 ? "bg-error-container" : "bg-orange-100"
                    }`}
                  >
                    <Icon
                      name="online_prediction"
                      filled
                      className={`text-[20px] ${p.confianca >= 85 ? "text-error" : "text-orange-600"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-primary truncate">{p.titulo}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {zonaNome(p.zona)} · Janela: {p.janela}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-headline font-black text-xl text-primary tracking-tighter">
                        {p.confianca.toFixed(1).replace(".", ",")}%
                      </p>
                      <MetaTag>CONFIANÇA</MetaTag>
                    </div>
                    {p.status === "pendente" && <Chip tone="warning">PENDENTE</Chip>}
                    {p.status === "aprovado" && <Chip tone="secondary">APROVADO → OCORRÊNCIA</Chip>}
                    {p.status === "descartado" && <Chip tone="neutral">DESCARTADO</Chip>}
                    <Icon
                      name={open ? "expand_less" : "expand_more"}
                      className="text-on-surface-variant text-[20px]"
                    />
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-outline-variant/20 pt-5">
                    <div>
                      <MetaTag className="block mb-2 text-secondary">BASE DA PREVISÃO</MetaTag>
                      <ul className="space-y-1.5">
                        {p.base.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface">
                            <Icon name="check_small" className="text-secondary text-[16px] mt-0.5 shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col">
                      <MetaTag className="block mb-2">EVENTOS PASSADOS NAS MESMAS CONDIÇÕES</MetaTag>
                      <ul className="space-y-1.5 mb-4">
                        {p.similares.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                            <Icon name="history" className="text-[16px] mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                      {p.status === "pendente" && (
                        <div className="mt-auto flex gap-2">
                          <Btn variant="success" icon="check" onClick={() => decidir(p.id, "aprovado")}>
                            Aprovar
                          </Btn>
                          <Btn variant="ghost" icon="close" onClick={() => decidir(p.id, "descartado")}>
                            Descartar
                          </Btn>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
