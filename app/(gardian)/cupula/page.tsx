"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Btn, Chip, Icon, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { CupulaIcon } from "@/app/components/CupulaIcon";
import { useGardian } from "@/app/components/GardianContext";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { responderCupula, SUGESTOES_CUPULA, type RespostaCupula } from "@/app/lib/cupula";
import {
  MOCK_AI_REPORT,
  MOCK_POSSIVEIS_EVENTOS,
  MOCK_HIST_PREVISOES_IA,
  zonaNome,
  type PossivelEvento,
} from "@/app/data/mock";

interface Mensagem {
  id: number;
  autor: "cupula" | "usuario";
  texto: string;
  fontes?: string[];
  relatorio?: RespostaCupula["relatorio"];
  hora: string;
}

const agora = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const SAUDACAO: Mensagem = {
  id: 0,
  autor: "cupula",
  texto:
    "Cúpula ativa. Estou cruzando pluviometria, geologia, histórico e relatos da população em tempo real.\n\nNo momento tenho 3 previsões ativas e 1 evento em andamento. Pergunte o que quiser, peça um resumo ou solicite um relatório.",
  fontes: [],
  hora: agora(),
};

export default function CupulaPage() {
  const { showToast } = useGardian();
  const { go } = useAppNavigation();

  const [mensagens, setMensagens] = useState<Mensagem[]>([SAUDACAO]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [previsoes, setPrevisoes] = useState<PossivelEvento[]>(MOCK_POSSIVEIS_EVENTOS);

  const feedRef = useRef<HTMLDivElement>(null);
  const proximoId = useRef(1);

  // rola o feed a cada nova mensagem
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, pensando]);

  const perguntar = (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;

    setMensagens((prev) => [
      ...prev,
      { id: proximoId.current++, autor: "usuario", texto: pergunta, hora: agora() },
    ]);
    setEntrada("");
    setPensando(true);

    // resposta simulada — trocar por chamada ao backend quando integrado
    window.setTimeout(() => {
      const r = responderCupula(pergunta);
      setMensagens((prev) => [
        ...prev,
        {
          id: proximoId.current++,
          autor: "cupula",
          texto: r.texto,
          fontes: r.fontes,
          relatorio: r.relatorio,
          hora: agora(),
        },
      ]);
      setPensando(false);
    }, 900);
  };

  const decidirPrevisao = (id: number, decisao: "aprovado" | "descartado") => {
    setPrevisoes((prev) => prev.map((p) => (p.id === id ? { ...p, status: decisao } : p)));
    showToast(
      decisao === "aprovado"
        ? "Previsão aprovada — ocorrência preventiva gerada."
        : "Previsão descartada e registrada no histórico.",
      decisao === "aprovado" ? "secondary" : "error",
    );
  };

  const acuracia = useMemo(() => {
    const decididas = MOCK_HIST_PREVISOES_IA.filter((p) => p.status !== "pendente");
    const aprovadas = decididas.filter((p) => p.status === "aprovado").length;
    return decididas.length ? Math.round((aprovadas / decididas.length) * 100) : 0;
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* ── Cabeçalho ── */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">INTELIGÊNCIA DO SISTEMA · {MOCK_AI_REPORT.versao}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5">
            <StatusDot tone="secondary" />
            <MetaTag className="text-secondary">VARREDURA CONTÍNUA</MetaTag>
          </span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 shadow-ambient">
              <CupulaIcon size={36} active className="text-white" />
            </div>
            <div>
              <h1 className="font-headline font-black text-5xl tracking-tighter text-primary leading-none">
                Cúpula
              </h1>
              <p className="text-sm text-on-surface-variant mt-2">
                A redoma de proteção de Porto Seguro — previsões, análises e relatórios sob demanda.
              </p>
            </div>
          </div>
          <Btn variant="secondary" icon="psychology" onClick={() => go("ai-report")}>
            Relatório completo
          </Btn>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* ── Conversa ── */}
        <section className="col-span-12 lg:col-span-7 card-tonal shadow-ambient-sm overflow-hidden flex flex-col">
          {/* barra da conversa */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant/20">
            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
              <CupulaIcon size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-primary tracking-tight">Falar com a Cúpula</p>
              <p className="text-[10px] font-bold uppercase tracking-mono-tight text-secondary">
                Online · responde com base nos dados do momento
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMensagens([{ ...SAUDACAO, hora: agora() }])}
              className="p-2 rounded-lg hover:bg-surface-container transition-all"
              aria-label="Limpar conversa"
            >
              <Icon name="restart_alt" className="text-on-surface-variant text-[18px]" />
            </button>
          </div>

          {/* feed */}
          <div
            ref={feedRef}
            className="flex-1 min-h-[420px] max-h-[560px] overflow-y-auto px-6 py-5 space-y-4"
          >
            {mensagens.map((m) =>
              m.autor === "usuario" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-primary text-white rounded-xl rounded-br-sm px-4 py-3">
                      <p className="text-[13px] leading-relaxed">{m.texto}</p>
                    </div>
                    <p className="text-[10px] font-mono font-bold text-slate-400 text-right mt-1">
                      {m.hora}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                    <CupulaIcon size={18} className="text-primary" />
                  </div>
                  <div className="max-w-[85%] min-w-0">
                    {m.relatorio && (
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Chip tone="primarySoft" icon="description">
                          {m.relatorio.titulo}
                        </Chip>
                        <MetaTag>{m.relatorio.periodo}</MetaTag>
                      </div>
                    )}
                    <div
                      className={`rounded-xl rounded-tl-sm px-4 py-3 ${
                        m.relatorio ? "bg-surface-container border-l-4 border-secondary" : "bg-surface-container-low"
                      }`}
                    >
                      <p className="text-[13px] text-on-surface leading-relaxed whitespace-pre-line">
                        {m.texto}
                      </p>

                      {m.relatorio && (
                        <div className="mt-4 pt-3 border-t border-outline-variant/20">
                          <Btn
                            variant="secondary"
                            icon="download"
                            onClick={() => showToast(`${m.relatorio!.titulo} exportado (PDF simulado).`)}
                          >
                            Exportar relatório
                          </Btn>
                        </div>
                      )}
                    </div>

                    {m.fontes && m.fontes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <MetaTag className="mt-0.5">FONTES:</MetaTag>
                        {m.fontes.map((f, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-bold uppercase tracking-mono-tight px-2 py-0.5 rounded bg-surface-container text-on-surface-variant"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{m.hora}</p>
                  </div>
                </div>
              ),
            )}

            {pensando && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <CupulaIcon size={18} className="text-primary animate-pulse" />
                </div>
                <div className="bg-surface-container-low rounded-xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* sugestões */}
          <div className="px-6 pt-4 border-t border-outline-variant/20">
            <MetaTag className="block mb-2">SUGESTÕES</MetaTag>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES_CUPULA.map((s) => (
                <button
                  key={s.texto}
                  type="button"
                  onClick={() => perguntar(s.texto)}
                  disabled={pensando}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-bold hover:bg-surface-container hover:text-primary transition-all disabled:opacity-40"
                >
                  <Icon name={s.icon} className="text-[15px]" />
                  {s.texto}
                </button>
              ))}
            </div>
          </div>

          {/* entrada */}
          <div className="p-6 pt-4">
            <div className="flex gap-2">
              <input
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") perguntar(entrada);
                }}
                placeholder="Pergunte, peça um resumo, uma análise ou um relatório…"
                className="flex-1 bg-surface-container-low rounded-lg px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-on-surface-variant/50"
              />
              <Btn variant="primary" icon="send" onClick={() => perguntar(entrada)} disabled={pensando}>
                Enviar
              </Btn>
            </div>
          </div>
        </section>

        {/* ── Painel lateral: previsões e leitura da Cúpula ── */}
        <aside className="col-span-12 lg:col-span-5 space-y-5">
          {/* leitura atual */}
          <div className="card-tonal p-7 shadow-ambient-sm">
            <SectionHeader overline="LEITURA ATUAL" title="O que estou vendo" />
            <p className="text-[13px] text-on-surface leading-relaxed">{MOCK_AI_REPORT.resumo}</p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {MOCK_AI_REPORT.estatisticas.slice(0, 3).map((e, i) => (
                <div key={i} className="card-recessed p-4">
                  <MetaTag className="block mb-2">{e.label}</MetaTag>
                  <p className="font-headline font-black text-2xl text-primary tracking-tighter">{e.valor}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-outline-variant/20">
              <Icon name="verified" filled className="text-secondary text-[18px]" />
              <p className="text-[11px] text-on-surface-variant">
                <strong className="text-primary">{acuracia}%</strong> das minhas previsões decididas foram
                confirmadas em campo · atualizado em {MOCK_AI_REPORT.geradoEm}
              </p>
            </div>
          </div>

          {/* previsões ativas */}
          <div className="card-tonal p-7 shadow-ambient-sm">
            <SectionHeader
              overline="MINHAS PREVISÕES"
              title="Possíveis Eventos"
              action={
                <Chip tone="warning" icon="pending">
                  {previsoes.filter((p) => p.status === "pendente").length} PENDENTES
                </Chip>
              }
            />
            <div className="space-y-3">
              {previsoes.map((p) => (
                <div
                  key={p.id}
                  className={`card-recessed p-5 ${p.status === "descartado" ? "opacity-55" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-[13px] font-bold text-primary leading-snug">{p.titulo}</p>
                    <div className="text-right shrink-0">
                      <p className="font-headline font-black text-lg text-primary tracking-tighter">
                        {p.confianca.toFixed(1).replace(".", ",")}%
                      </p>
                      <MetaTag>CONFIANÇA</MetaTag>
                    </div>
                  </div>
                  <Bar
                    value={p.confianca}
                    tone={p.confianca >= 85 ? "error" : p.confianca >= 60 ? "warning" : "secondary"}
                    className="mb-3"
                  />
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Chip tone="neutral" icon="hub">{zonaNome(p.zona)}</Chip>
                    <Chip tone="neutral" icon="schedule">{p.janela}</Chip>
                    {p.status === "aprovado" && <Chip tone="secondary">APROVADA</Chip>}
                    {p.status === "descartado" && <Chip tone="neutral">DESCARTADA</Chip>}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed flex items-start gap-1.5">
                    <Icon name="database" className="text-[14px] mt-0.5 shrink-0" />
                    {p.base[0]}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Btn
                      variant="ghost"
                      icon="chat"
                      onClick={() => perguntar(`Detalhe a base da previsão: ${p.titulo}`)}
                    >
                      Perguntar
                    </Btn>
                    {p.status === "pendente" && (
                      <>
                        <Btn variant="success" icon="check" onClick={() => decidirPrevisao(p.id, "aprovado")}>
                          Aprovar
                        </Btn>
                        <Btn variant="ghost" icon="close" onClick={() => decidirPrevisao(p.id, "descartado")}>
                          Descartar
                        </Btn>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
