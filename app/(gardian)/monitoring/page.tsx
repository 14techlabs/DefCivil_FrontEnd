"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { DataLoading } from "@/app/components/DataLoading";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { api } from "@/app/services/Api";
import {
  MOCK_RESUMO_ZONAS,
  MOCK_POSSIVEIS_EVENTOS,
  MOCK_OCORRENCIAS,
  MOCK_ZONAS,
  zonaNome as zonaNomeMock,
} from "@/app/data/mock";

const MonitoringMap = dynamic(
  () => import("@/app/components/MonitoringMap").then((m) => m.MonitoringMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low min-h-[520px]">
        <p className="text-sm text-on-surface-variant font-medium">Carregando mapa…</p>
      </div>
    ),
  },
);

// --- tipos da resposta da api ---

interface Monitoramento {
  id: number;
  tipo: "entidade" | "zona";
  status: "estavel" | "risco_moderado" | "risco_alto" | "critico";
  entidade: number | null;
  zona: number | null;
  resumo: string;
  etiquetas: string[];
  created_at: string;
  sinalizador_impacto: Record<string, unknown> | null;
}

interface MonitoramentoListResponse {
  monitoramento_entidade: Monitoramento[];
  monitoramento_zonas: Monitoramento[];
  "total ocorrencias": number;
}

interface ZonaBasic {
  id: number;
  nome: string;
}

interface ZonaListResponse {
  zonas: ZonaBasic[];
}

// --- helpers ---

const STATUS_TONE: Record<string, "error" | "warning" | "secondary"> = {
  critico: "error",
  risco_alto: "error",
  risco_moderado: "warning",
  estavel: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  critico: "Crítico",
  risco_alto: "Risco Alto",
  risco_moderado: "Risco Moderado",
  estavel: "Estável",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  critico: "bg-error",
  risco_alto: "bg-error",
  risco_moderado: "bg-orange-500",
  estavel: "bg-secondary",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase()
    .replace(/\./g, "");
}

// --- componente ---

export default function MonitoringPage() {
  const { openZone } = useAppNavigation();

  // estado dos dados
  const [entidadeList, setEntidadeList] = useState<Monitoramento[]>([]);
  const [zonaList, setZonaList] = useState<Monitoramento[]>([]);
  const [totalOcorrencias, setTotalOcorrencias] = useState(0);
  const [zonaLookup, setZonaLookup] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // busca monitoramentos + zonas para o lookup dos nomes
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [monRes, zonRes] = await Promise.all([
          api.get<MonitoramentoListResponse>("/monitoramentos/"),
          api.get<ZonaListResponse>("/zonas/", { params: { lookup: "1" } }),
        ]);

        if (cancelled) return;

        const { monitoramento_entidade, monitoramento_zonas, "total ocorrencias": totalOc } = monRes.data;
        setEntidadeList(monitoramento_entidade);
        setZonaList(monitoramento_zonas);
        setTotalOcorrencias(totalOc);

        const lookup = new Map<number, string>();
        for (const z of zonRes.data.zonas) {
          lookup.set(z.id, z.nome);
        }
        setZonaLookup(lookup);
      } catch {
        // api indisponível — usa base mockada enquanto não está integrado
        if (cancelled) return;
        setZonaList(
          MOCK_RESUMO_ZONAS.map((r, i) => ({
            id: 1000 + i,
            tipo: "zona" as const,
            status:
              r.status === "critico"
                ? ("critico" as const)
                : r.status === "atencao"
                  ? ("risco_moderado" as const)
                  : ("estavel" as const),
            entidade: null,
            zona: r.zona,
            resumo: r.resumo,
            etiquetas: r.possiveisEventos.length > 0 ? ["possível evento"] : [],
            created_at: new Date().toISOString(),
            sinalizador_impacto: null,
          })),
        );
        setTotalOcorrencias(
          MOCK_OCORRENCIAS.filter((o) => o.status !== "concluido").length,
        );
        setZonaLookup(new Map(MOCK_ZONAS.map((z) => [z.id, z.nome])));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // --- valores derivados dos kpis ---

  const totalMonitoramentos = entidadeList.length + zonaList.length;

  const zonasEmAlerta = useMemo(
    () => zonaList.filter((z) => z.status === "critico" || z.status === "risco_alto").length,
    [zonaList],
  );

  const highestSeverity = useMemo(() => {
    const all = [...entidadeList, ...zonaList];
    if (all.some((m) => m.status === "critico")) return { label: "Crítico", tone: "error" as const };
    if (all.some((m) => m.status === "risco_alto")) return { label: "Risco Alto", tone: "error" as const };
    if (all.some((m) => m.status === "risco_moderado")) return { label: "Moderado", tone: "warning" as const };
    return { label: "Estável", tone: "secondary" as const };
  }, [entidadeList, zonaList]);

  // --- mescla monitoramentos de entidade + zona para o feed ---

  const allMonitoramentos = useMemo(
    () =>
      [...entidadeList, ...zonaList].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [entidadeList, zonaList],
  );

  // --- renderização ---

  if (loading) {
    return <DataLoading />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* cabeçalho */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5">
            <StatusDot tone={highestSeverity.tone} />
            <MetaTag className={highestSeverity.tone === "error" ? "text-error" : "text-secondary"}>
              {totalMonitoramentos} INDICADORES · STATUS {highestSeverity.label.toUpperCase()}
            </MetaTag>
          </span>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Monitoramento
        </h1>
      </header>

      {/* kpis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          label="Indicadores"
          value={totalMonitoramentos}
          tone="secondary"
          icon="analytics"
          sub={`${entidadeList.length} entidade · ${zonaList.length} zona${zonaList.length !== 1 ? "s" : ""}`}
        />
        <KPI
          label="Ocorrências Ativas"
          value={String(totalOcorrencias).padStart(2, "0")}
          tone="error"
          icon="emergency"
          sub="Em triagem, despacho ou acompanhamento"
        />
        <KPI
          label="Zonas em Alerta"
          value={String(zonasEmAlerta).padStart(2, "0")}
          tone="warning"
          icon="terrain"
          sub={`Risco elevado · ${zonaList.length} zona${zonaList.length !== 1 ? "s" : ""} monitorada${zonaList.length !== 1 ? "s" : ""}`}
        />
        <KPI
          label="Status Consolidado"
          value={highestSeverity.label}
          tone={highestSeverity.tone}
          icon={highestSeverity.tone === "error" ? "warning" : "check_circle"}
          sub="Com base nos monitoramentos ativos"
        />
      </div>

      {/* resumo por zona em lista, destacando possíveis eventos */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader
          overline="VISÃO CONSOLIDADA"
          title="Resumo por Zona"
          action={
            <Chip tone="warning" icon="online_prediction">
              {MOCK_POSSIVEIS_EVENTOS.length} POSSÍVEIS EVENTOS
            </Chip>
          }
        />
        <div className="space-y-3">
          {MOCK_RESUMO_ZONAS.map((r) => {
            const tone =
              r.status === "critico" ? "error" : r.status === "atencao" ? "warning" : "secondary";
            const possiveis = MOCK_POSSIVEIS_EVENTOS.filter((p) =>
              r.possiveisEventos.includes(p.id),
            );
            return (
              <div key={r.zona} className="card-recessed p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        tone === "error" ? "bg-error" : tone === "warning" ? "bg-orange-500" : "bg-secondary"
                      }`}
                    />
                    <h3 className="font-headline font-bold text-[16px] text-primary tracking-tight">
                      {zonaNomeMock(r.zona)}
                    </h3>
                    <Chip tone={tone}>
                      {r.status === "critico" ? "Crítico" : r.status === "atencao" ? "Atenção" : "Estável"}
                    </Chip>
                  </div>
                  <Btn variant="ghost" icon="arrow_forward" onClick={() => openZone(String(r.zona))}>
                    Ver zona
                  </Btn>
                </div>

                <p className="text-[12px] text-on-surface-variant leading-relaxed mt-2">{r.resumo}</p>

                {possiveis.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {possiveis.map((p) => (
                      <div key={p.id} className="rounded-lg bg-orange-50 border-l-4 border-orange-400 p-4">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Icon name="online_prediction" filled className="text-orange-600 text-[18px]" />
                          <span className="text-[13px] font-black text-primary">{p.titulo}</span>
                          <Chip tone="warning">
                            {p.confianca.toFixed(1).replace(".", ",")}% · {p.janela}
                          </Chip>
                        </div>
                        <MetaTag className="block mb-1.5">BASE PARA ESTE EVENTO</MetaTag>
                        <ul className="space-y-1">
                          {p.base.map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] text-on-surface">
                              <Icon name="check_small" className="text-orange-600 text-[15px] mt-0.5 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* mapa + feed de monitoramento */}
      <div className="grid grid-cols-12 gap-5">
        {/* mapa */}
        <div className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MonitoringMap height={520} />
        </div>

        {/* feed */}
        <div className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="MONITORAMENTO ATIVO"
            title="Indicadores"
            action={
              <Chip tone="secondary">
                {allMonitoramentos.length} registro{allMonitoramentos.length !== 1 ? "s" : ""}
              </Chip>
            }
          />
          {allMonitoramentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name="monitoring" className="text-on-surface-variant text-[40px] mb-3" />
              <p className="text-sm text-on-surface-variant">
                Nenhum monitoramento disponível.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {allMonitoramentos.map((m) => {
                const tone = STATUS_TONE[m.status] ?? "secondary";
                const dotClass = STATUS_DOT_CLASS[m.status] ?? "bg-secondary";
                const tipoLabel = m.tipo === "entidade" ? "Entidade" : "Zona";
                const zonaNome =
                  m.tipo === "zona" && m.zona != null
                    ? zonaLookup.get(m.zona) ?? `#${m.zona}`
                    : null;

                return (
                  <div
                    key={m.id}
                    className="bg-surface-container-low rounded-lg p-4 hover:bg-surface-container transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                      <Chip tone="neutral">{tipoLabel}{zonaNome ? ` · ${zonaNome}` : ""}</Chip>
                      <Chip tone={tone}>{STATUS_LABEL[m.status] ?? m.status}</Chip>
                    </div>
                    <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-2">
                      {m.resumo}
                    </p>
                    {m.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.etiquetas.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-bold uppercase tracking-mono-tight px-2 py-0.5 rounded bg-surface-container text-on-surface-variant"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(m.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* cartões de monitoramento por zona */}
      {zonaList.length > 0 && (
        <section className="space-y-5">
          <SectionHeader
            overline="VIGILÂNCIA TERRITORIAL"
            title="Monitoramento por Zona"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {zonaList.map((m) => {
              const tone = STATUS_TONE[m.status] ?? "secondary";
              const dotClass = STATUS_DOT_CLASS[m.status] ?? "bg-secondary";
              const zonaNome = m.zona != null
                ? zonaLookup.get(m.zona) ?? `Zona #${m.zona}`
                : "Zona desconhecida";

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => m.zona != null && openZone(String(m.zona))}
                  disabled={m.zona == null}
                  className="group text-left rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low hover:border-secondary/50 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {/* barra de destaque superior */}
                  <div className={`h-1.5 ${tone === "error" ? "bg-error" : tone === "warning" ? "bg-orange-500" : "bg-secondary"}`} />

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${dotClass} shrink-0`} />
                        <h3 className="font-headline font-black text-lg text-primary tracking-tight truncate">
                          {zonaNome}
                        </h3>
                      </div>
                      <Chip tone={tone} className="shrink-0">
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Chip>
                    </div>

                    <p className="text-[12px] text-on-surface-variant leading-relaxed line-clamp-3">
                      {m.resumo || "Sem descrição."}
                    </p>

                    {m.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.etiquetas.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-bold uppercase tracking-mono-tight px-2 py-0.5 rounded bg-surface-container text-on-surface-variant"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-slate-400">
                        {formatDate(m.created_at)}
                      </span>
                      {m.zona != null && (
                        <span className="text-[10px] font-bold uppercase tracking-mono-tight text-primary group-hover:text-secondary transition-colors flex items-center gap-1">
                          Detalhes <Icon name="arrow_forward" className="text-[14px]" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
