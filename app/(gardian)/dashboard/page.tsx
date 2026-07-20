"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, StatusDot } from "@/app/components/Primitives";
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
  area?: unknown;
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

const AreaDrawMap = dynamic(
  () => import("@/app/components/AreaDrawMap").then((m) => m.AreaDrawMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low min-h-[420px]">
        <p className="text-sm text-on-surface-variant font-medium">Carregando mapa…</p>
      </div>
    ),
  },
);

// --- helpers ---

function toneForStatus(status: string): "error" | "warning" | "secondary" {
  if (status === "critico") return "error";
  if (status === "atencao") return "warning";
  return "secondary";
}

// --- página ---

export default function DashboardPage() {
  const { alertMode } = useGardian();
  const { go } = useAppNavigation();

  // estado dos dados
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [totalOcorrencias, setTotalOcorrencias] = useState(0);
  const [loading, setLoading] = useState(true);

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
    return () => { cancelled = true; };
  }, []);

  // --- valores derivados ---

  const zonas = dashboardData?.zonas ?? [];
  const alertas = dashboardData?.alertas ?? [];

  const totalZonas = zonas.length;
  const urbanas = zonas.filter((z) => z.tipo === "urbana").length;
  const rurais = zonas.filter((z) => z.tipo === "rural").length;
  const emAlerta = zonas.filter((z) => z.status === "critico").length;
  const atencaoCount = zonas.filter((z) => z.status === "atencao").length;

  // alerta com maior confiança (aprovados primeiro)
  const featuredAlerta = useMemo(
    () =>
      alertas
        .filter((a) => a.aprovado)
        .sort((a, b) => b.confianca - a.confianca)[0] ?? null,
    [alertas],
  );

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
            <MetaTag className={alertMode ? "text-error" : "text-secondary"}>
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
              <Chip tone="secondary" className="!bg-secondary/20 !text-secondary-container">
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
            <Chip tone="secondary" className="!bg-secondary/20 !text-secondary-container">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" />{" "}
              SISTEMA OPERACIONAL
            </Chip>
            <h2 className="font-headline font-black text-4xl tracking-tighter mt-5 leading-tight">
              Nenhum alerta crítico no momento
            </h2>
            <p className="text-white/70 text-sm mt-4 leading-relaxed max-w-xl">
              Monitoramento contínuo ativo. {totalZonas} zonas sob vigilância,
              {totalOcorrencias} ocorrências em andamento.
            </p>
          </div>
        </div>
      )}

      {/* Mapa interativo */}
      <div className="card-tonal p-4 shadow-ambient-sm">
        <AreaDrawMap height={420} />
      </div>
    </div>
  );
}
