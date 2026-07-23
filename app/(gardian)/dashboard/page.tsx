"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Btn,
  Chip,
  Icon,
  KPI,
  MetaTag,
  SectionHeader,
  StatusDot,
} from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { api } from "@/app/services/Api";

// --- tipos da resposta da api ---

interface DashboardZona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
  area: GeoJSON.Polygon | null;
}

interface DashboardAlerta {
  id: number;
  titulo: string;
  resumo: string;
  confianca: number;
  aprovado: boolean | null;
}

interface DashboardResponse {
  zonas: DashboardZona[];
  alertas: DashboardAlerta[];
  indicadores_climaticos: {
    metereologia: unknown | null;
    geologia: unknown | null;
  };
}

interface MonitoramentoResponse {
  "total ocorrencias": number;
}

// --- componente do mapa (lazy, ssr=false) ---

const DashboardMap = dynamic(
  () => import("@/app/components/DashboardMap").then((m) => m.DashboardMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low min-h-[480px]">
        <p className="text-sm text-on-surface-variant font-medium">Carregando mapa…</p>
      </div>
    ),
  },
);

// --- helpers ---

function toneForStatus(
  status: string,
): "error" | "warning" | "secondary" {
  if (status === "critico") return "error";
  if (status === "atencao") return "warning";
  return "secondary";
}

const STATUS_LABEL: Record<string, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  estavel: "Estável",
};

const TIPO_LABEL: Record<string, string> = {
  urbana: "Urbana",
  rural: "Rural",
};

// --- página ---

export default function DashboardPage() {
  const { alertMode } = useGardian();
  const { go, openZone } = useAppNavigation();

  // estado dos dados
  const [dashboardData, setDashboardData] =
    useState<DashboardResponse | null>(null);
  const [totalOcorrencias, setTotalOcorrencias] = useState(0);
  const [loading, setLoading] = useState(true);

  // estado de seleção do mapa
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);

  // busca dados reais
  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
      try {
        const [geralRes, monRes] = await Promise.all([
          api.get<DashboardResponse>("/api/geral"),
          api.get<MonitoramentoResponse>("/monitoramentos/"),
        ]);

        if (cancelled) return;
        setDashboardData(geralRes.data);
        setTotalOcorrencias(monRes.data["total ocorrencias"]);
      } catch {
        // erro de rede ou api, mostrar só no console por enquanto
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- valores derivados ---

  const zonas = useMemo(() => dashboardData?.zonas ?? [], [dashboardData]);
  const alertas = useMemo(() => dashboardData?.alertas ?? [], [dashboardData]);

  const totalZonas = zonas.length;
  const urbanas = zonas.filter((z) => z.tipo === "urbana").length;
  const rurais = zonas.filter((z) => z.tipo === "rural").length;
  const emAlerta = zonas.filter((z) => z.status === "critico").length;
  const atencaoCount = zonas.filter((z) => z.status === "atencao").length;

  // zona selecionada
  const selectedZone = useMemo(
    () => zonas.find((z) => z.id === selectedZoneId) ?? null,
    [zonas, selectedZoneId],
  );

  // alerta com maior confiança (aprovados primeiro)
  const featuredAlerta = useMemo(
    () =>
      alertas
        .filter((a) => a.aprovado)
        .sort((a, b) => b.confianca - a.confianca)[0] ?? null,
    [alertas],
  );

  // callback de seleção no mapa
  const handleZoneSelect = useCallback(
    (zoneId: number | null) => {
      setSelectedZoneId(zoneId === selectedZoneId ? null : zoneId);
    },
    [selectedZoneId],
  );

  const handleCloseZone = useCallback(() => {
    setSelectedZoneId(null);
  }, []);

  // --- renderização ---

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <header className="mb-8">
          <MetaTag className="text-secondary">PAINEL GERAL</MetaTag>
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Centro de Comando
          </h1>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">
            Carregando painel…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>Painel Geral · Defesa Civil</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <span className="flex items-center gap-1.5">
            <StatusDot tone={alertMode ? "error" : "secondary"} />
            <MetaTag
              className={alertMode ? "text-error" : "text-secondary"}
            >
              {alertMode ? "Estado de Alerta" : "Operacional"}
            </MetaTag>
          </span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Centro de Comando
            </h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xl">
              Visão consolidada da operação · Dados em tempo real
            </p>
          </div>
          <div className="flex gap-3">
            <Btn
              variant="primary"
              icon="play_circle"
              onClick={() => go("monitoring")}
            >
              Modo Comando
            </Btn>
          </div>
        </div>
      </header>

      {/* Dados da API */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          label="Total de Zonas"
          value={totalZonas}
          icon="hub"
          tone="secondary"
          sub={`${urbanas} urbanas · ${rurais} rurais`}
        />
        <KPI
          label="Em Alerta"
          value={emAlerta}
          icon="warning"
          tone={emAlerta > 0 ? "error" : "secondary"}
          sub={`${emAlerta} críticas · ${atencaoCount} atenção`}
        />
        <KPI
          label="Ocorrências Ativas"
          value={totalOcorrencias}
          icon="emergency"
          tone={totalOcorrencias > 0 ? "warning" : "secondary"}
          sub="Validadas · Não concluídas"
        />
        <KPI
          label="Alertas"
          value={alertas.length}
          icon="notifications"
          tone={alertas.length > 0 ? "warning" : "secondary"}
          sub={
            featuredAlerta
              ? `Maior: ${featuredAlerta.confianca}% confiança`
              : "Nenhum ativo"
          }
        />
      </div>

      {/* Hero; Alerta em destaque (se houver) */}
      {featuredAlerta ? (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 bg-gradient-to-br from-primary to-primary-container rounded-xl p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-[0.04]">
              <Icon name="psychology" filled className="text-[400px]" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <Chip
                tone="secondary"
                className="!bg-secondary/20 !text-secondary-container"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" />{" "}
                ALERTA ATIVO
              </Chip>
              <h2 className="font-headline font-black text-4xl tracking-tighter mt-5 leading-tight">
                {featuredAlerta.titulo}
              </h2>
              <p className="text-white/70 text-sm mt-4 leading-relaxed max-w-xl">
                {featuredAlerta.resumo}
              </p>
              <div className="flex items-center gap-6 mt-6 text-[10px] font-mono uppercase tracking-mono font-bold text-white/50">
                <span>
                  CONFIANÇA:{" "}
                  <strong className="text-secondary-container">
                    {featuredAlerta.confianca}%
                  </strong>
                </span>
                <span>
                  STATUS:{" "}
                  <strong className="text-white/80">
                    {featuredAlerta.aprovado ? "APROVADO" : "PENDENTE"}
                  </strong>
                </span>
              </div>
              <div className="flex gap-3 mt-8">
                <Btn
                  variant="success"
                  icon="groups"
                  iconRight="arrow_forward"
                  onClick={() => go("monitoring")}
                >
                  Mobilizar Equipes
                </Btn>
                <button
                  onClick={() => go("zones")}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/10 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-mono-tight hover:bg-white/20 transition-all"
                >
                  Ver Zonas{" "}
                  <Icon name="arrow_forward" className="text-[16px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-[0.04]">
            <Icon name="shield" filled className="text-[400px]" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <Chip
              tone="secondary"
              className="!bg-secondary/20 !text-secondary-container"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" />{" "}
              SISTEMA OPERACIONAL
            </Chip>
            <h2 className="font-headline font-black text-4xl tracking-tighter mt-5 leading-tight">
              Nenhum alerta crítico no momento
            </h2>
            <p className="text-white/70 text-sm mt-4 leading-relaxed max-w-xl">
              Monitoramento contínuo ativo. {totalZonas} zonas sob
              vigilância, {totalOcorrencias} ocorrências em andamento.
            </p>
          </div>
        </div>
      )}

      {/* Mapa interativo + painel de zona */}
      <div className="grid grid-cols-12 gap-5 items-stretch">
        {/* Mapa */}
        <div className="col-span-12 lg:col-span-7 min-h-0">
          <div className="card-tonal p-2 shadow-ambient-sm h-full">
            <DashboardMap
              zones={zonas}
              height={480}
              onZoneSelect={handleZoneSelect}
              selectedZoneId={selectedZoneId}
            />
          </div>
        </div>

        {/* Painel lateral */}
        <div className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm flex flex-col min-h-0 h-full lg:max-h-[496px]">
          {selectedZone ? (
            <>
              <SectionHeader
                overline={`ZONA #${selectedZone.id}`}
                title={selectedZone.nome}
                action={
                  <button
                    type="button"
                    onClick={handleCloseZone}
                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-surface-container transition-all"
                    aria-label="Fechar"
                  >
                    <Icon name="close" className="text-on-surface-variant text-[18px]" />
                  </button>
                }
              />

              <div className="flex gap-2 mt-4 mb-4">
                <Chip tone={toneForStatus(selectedZone.status)}>
                  {STATUS_LABEL[selectedZone.status]}
                </Chip>
                <Chip tone="neutral">
                  {TIPO_LABEL[selectedZone.tipo] ?? selectedZone.tipo}
                </Chip>
              </div>

              {selectedZone.descricao && (
                <p className="text-[13px] text-on-surface-variant leading-relaxed mb-6">
                  {selectedZone.descricao}
                </p>
              )}

              {!selectedZone.descricao && (
                <p className="text-[13px] text-on-surface-variant italic mb-6">
                  Sem descrição cadastrada.
                </p>
              )}

              <div className="mt-auto flex gap-3 pt-4 border-t border-outline-variant/20">
                <Btn variant="ghost" icon="close" onClick={handleCloseZone}>
                  Fechar
                </Btn>
                <Btn
                  variant="primary"
                  icon="arrow_forward"
                  onClick={() => openZone(String(selectedZone.id))}
                >
                  Ver Detalhes
                </Btn>
              </div>
            </>
          ) : (
            <>
              <SectionHeader
                overline="EM CAMPO"
                title="Sinalizadores de Impacto"
              />
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1 mt-4">
                {[
                  {
                    icon: "warning",
                    iconColor: "text-orange-700",
                    iconBg: "bg-orange-100",
                    label: "Zonas em Crítico",
                    sub: "Zonas com status de risco máximo",
                    value: String(emAlerta),
                  },
                  {
                    icon: "trending_up",
                    iconColor: "text-amber-700",
                    iconBg: "bg-amber-100",
                    label: "Zonas em Atenção",
                    sub: "Zonas com status de risco moderado",
                    value: String(atencaoCount),
                  },
                  {
                    icon: "hub",
                    iconColor: "text-secondary",
                    iconBg: "bg-secondary/10",
                    label: "Total de Zonas",
                    sub: "Todas as zonas monitoradas",
                    value: String(totalZonas),
                  },
                  {
                    icon: "emergency",
                    iconColor: "text-rose-700",
                    iconBg: "bg-rose-100",
                    label: "Ocorrências Ativas",
                    sub: "Registros válidos não concluídos",
                    value: String(totalOcorrencias),
                  },
                  {
                    icon: "notifications",
                    iconColor: "text-violet-700",
                    iconBg: "bg-violet-100",
                    label: "Alertas",
                    sub: "Alertas registrados no sistema",
                    value: String(alertas.length),
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-all"
                  >
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${s.iconBg}`}
                    >
                      <Icon
                        name={s.icon}
                        filled
                        className={`text-[18px] ${s.iconColor}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-mono-tight text-primary">
                        {s.label}
                      </p>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2">
                        {s.sub}
                      </p>
                    </div>
                    <Chip tone="secondary" className="shrink-0">
                      {s.value}
                    </Chip>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
