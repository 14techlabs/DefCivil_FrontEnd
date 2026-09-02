"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { api } from "@/app/services/Api";
import { EditZoneModal } from "@/app/components/EditZoneModal";
import { DeleteZoneModal } from "@/app/components/DeleteZoneModal";
import { DataLoading } from "@/app/components/DataLoading";
import type { MapPoint } from "@/app/components/PointsMap";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

function occurrencePointKind(status: string): MapPoint["kind"] {
  const key = getOccurrenceStatusMeta(status).key;
  return key === "desconhecido" ? "ocorrencia_em_analise" : `ocorrencia_${key}`;
}

const ZoneMap = dynamic(
  () => import("@/app/components/ZoneMap").then((m) => m.ZoneMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low min-h-[450px]">
        <p className="text-sm text-on-surface-variant font-medium">Carregando mapa…</p>
      </div>
    ),
  },
);

interface Zona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
}

interface Evento {
  id: number;
  zona: number;
  tipo: "desastre" | "mitigacao";
  nome: string;
  descricao: string;
  data_inicio: string | null;
  status: string | null;
}

interface ZoneDetailResponse {
  zonas: Zona;
  eventos: Evento[];
}

interface Ocorrencia {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  descricao: string;
  endereco: string;
  coordenadas: { lat: number; lng: number } | null;
  created_at: string;
  custo_danos?: string | number | null;
}

interface PontoApoio {
  id: number;
  tipo: string;
  tipo_label: string;
  nome: string;
  descricao: string;
  endereco: string;
  coordenadas: { lat: number; lng: number } | null;
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

const CATEGORIA_LABEL: Record<string, string> = {
  climatico: "Climático",
  geologico: "Geológico",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

// altura do mapa (px); o card lateral usa o mesmo valor + 16 (padding p-2 do card do mapa)
const ALTURA_MAPA = 500;

function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()
    .replace(/\./g, "")} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function SemItens({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <Icon name="inbox" className="text-outline text-[32px]" />
      <p className="text-[12px] text-on-surface-variant">{texto}</p>
    </div>
  );
}

function PainelOcorrencia({
  ocorrencia,
  onVoltar,
}: {
  ocorrencia: Ocorrencia;
  onVoltar: () => void;
}) {
  const meta = getOccurrenceStatusMeta(ocorrencia.status);
  const custo = Number(ocorrencia.custo_danos);
  return (
    <div>
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-4"
      >
        <Icon name="arrow_back" className="text-[14px]" /> Voltar
      </button>
      <MetaTag className="block mb-3">OCORRÊNCIA #{ocorrencia.id}</MetaTag>
      <span
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-mono-tight mb-3"
        style={{ color: meta.color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
        {meta.label}
      </span>
      <h3 className="font-headline font-black text-xl text-primary tracking-tighter mb-4">
        {ocorrencia.titulo || `Ocorrência #${ocorrencia.id}`}
      </h3>
      <dl className="space-y-3">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
            Categoria
          </dt>
          <dd className="text-[13px] font-semibold">
            {CATEGORIA_LABEL[ocorrencia.categoria] ?? ocorrencia.categoria}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
            Data de registro
          </dt>
          <dd className="text-[13px] font-semibold">
            {formatDataHora(ocorrencia.created_at)}
          </dd>
        </div>
        {ocorrencia.endereco ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
              Endereço
            </dt>
            <dd className="text-[13px] font-semibold">{ocorrencia.endereco}</dd>
          </div>
        ) : null}
        {ocorrencia.coordenadas ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
              Coordenadas
            </dt>
            <dd className="text-[13px] font-semibold font-mono">
              {ocorrencia.coordenadas.lat.toFixed(5)},{" "}
              {ocorrencia.coordenadas.lng.toFixed(5)}
            </dd>
          </div>
        ) : null}
        {Number.isFinite(custo) && custo > 0 ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
              Danos estimados
            </dt>
            <dd className="text-[13px] font-semibold">
              {custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </dd>
          </div>
        ) : null}
      </dl>
      {ocorrencia.descricao ? (
        <>
          <div className="h-px bg-outline-variant/20 my-4" />
          <p className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-1">
            Descrição
          </p>
          <p className="text-[12px] text-on-surface-variant leading-relaxed whitespace-pre-line">
            {ocorrencia.descricao}
          </p>
        </>
      ) : null}
    </div>
  );
}

function PainelApoio({
  apoio,
  onVoltar,
}: {
  apoio: PontoApoio;
  onVoltar: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-4"
      >
        <Icon name="arrow_back" className="text-[14px]" /> Voltar
      </button>
      <MetaTag className="block mb-3">PONTO DE APOIO</MetaTag>
      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-mono-tight text-[#7C4DFF] mb-3">
        <span className="w-2 h-2 rounded-full bg-[#7C4DFF]" />
        {apoio.tipo_label}
      </span>
      <h3 className="font-headline font-black text-xl text-primary tracking-tighter mb-4">
        {apoio.nome}
      </h3>
      <dl className="space-y-3">
        {apoio.endereco ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
              Endereço
            </dt>
            <dd className="text-[13px] font-semibold">{apoio.endereco}</dd>
          </div>
        ) : null}
        {apoio.coordenadas ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-0.5">
              Coordenadas
            </dt>
            <dd className="text-[13px] font-semibold font-mono">
              {apoio.coordenadas.lat.toFixed(5)},{" "}
              {apoio.coordenadas.lng.toFixed(5)}
            </dd>
          </div>
        ) : null}
      </dl>
      {apoio.descricao ? (
        <>
          <div className="h-px bg-outline-variant/20 my-4" />
          <p className="text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant mb-1">
            Descrição
          </p>
          <p className="text-[12px] text-on-surface-variant leading-relaxed whitespace-pre-line">
            {apoio.descricao}
          </p>
        </>
      ) : null}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase()
    .replace(/\./g, "");
}

function formatYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return dateStr.slice(0, 4);
}

function ZoneDetailContent() {
  const searchParams = useSearchParams();
  const zoneId = searchParams.get("zone");
  const { router } = useAppNavigation();
  const back = () => router.push("/zones");

  const [data, setData] = useState<ZoneDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // lista lateral: ocorrências e pontos de apoio dentro da zona
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [apoios, setApoios] = useState<PontoApoio[]>([]);
  const [aba, setAba] = useState<"ocorrencias" | "apoios">("ocorrencias");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [avisoFicha, setAvisoFicha] = useState(false);

  useEffect(() => {
    if (!zoneId) return;

    let cancelled = false;
    api
      .get<ZoneDetailResponse>(`/zonas/${zoneId}/`)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setLoadError("");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const requestError = err as { response?: { status?: number } };
        setData(null);
        setLoadError(
          requestError.response?.status === 403
            ? "Você não tem permissão para visualizar esta zona."
            : requestError.response?.status === 404
              ? "Zona não encontrada."
              : "Não foi possível carregar os detalhes da zona.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  // carrega ocorrências e pontos de apoio da zona (falha silenciosa → lista vazia)
  useEffect(() => {
    if (!zoneId) return;
    let cancelled = false;

    api
      .get<{ ocorrencias: Ocorrencia[] }>(
        `/ocorrencias/ocorrencias_por_zona/?zona_id=${zoneId}`,
      )
      .then((res) => {
        if (!cancelled) setOcorrencias(res.data.ocorrencias ?? []);
      })
      .catch(() => {
        if (!cancelled) setOcorrencias([]);
      });

    api
      .get<PontoApoio[]>(`/apoios/?zona_id=${zoneId}`)
      .then((res) => {
        if (!cancelled) setApoios(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setApoios([]);
      });

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const z = data?.zonas;
  const eventos = useMemo(() => data?.eventos ?? [], [data]);

  const desastres = useMemo(
    () => eventos.filter((e) => e.tipo === "desastre"),
    [eventos],
  );

  const mitigacoes = useMemo(
    () => eventos.filter((e) => e.tipo === "mitigacao"),
    [eventos],
  );

  // pins do mapa: ocorrências + pontos de apoio dentro da zona
  const pontos: MapPoint[] = useMemo(() => {
    const lista: MapPoint[] = [];
    for (const o of ocorrencias) {
      if (!o.coordenadas) continue;
      lista.push({
        id: `oc-${o.id}`,
        lat: o.coordenadas.lat,
        lng: o.coordenadas.lng,
        titulo: o.titulo || `Ocorrência #${o.id}`,
        subtitulo: [
          CATEGORIA_LABEL[o.categoria] ?? o.categoria,
          getOccurrenceStatusMeta(o.status).label,
          o.endereco || null,
        ]
          .filter(Boolean)
          .join(" · "),
        kind: occurrencePointKind(o.status),
      });
    }
    for (const a of apoios) {
      if (!a.coordenadas) continue;
      lista.push({
        id: `apoio-${a.id}`,
        lat: a.coordenadas.lat,
        lng: a.coordenadas.lng,
        titulo: a.nome,
        subtitulo: [a.tipo_label, a.endereco || null].filter(Boolean).join(" · "),
        kind: "ponto_apoio",
      });
    }
    return lista;
  }, [ocorrencias, apoios]);

  // seleção vinda do mapa (pin) ou da lista lateral
  const selecionarPonto = (ponto: MapPoint | null) => {
    if (!ponto) {
      setSelecionadoId(null);
      setAvisoFicha(false);
      return;
    }
    const pid = String(ponto.id);
    setAba(pid.startsWith("apoio-") ? "apoios" : "ocorrencias");
    setSelecionadoId(pid);
    setAvisoFicha(false);
  };

  const mudarAba = (nova: "ocorrencias" | "apoios") => {
    setAba(nova);
    setSelecionadoId(null);
    setAvisoFicha(false);
  };

  const selecionadoOcorrencia = useMemo(() => {
    const id = selecionadoId?.startsWith("oc-")
      ? Number(selecionadoId.slice(3))
      : null;
    return id == null ? null : ocorrencias.find((o) => o.id === id) ?? null;
  }, [selecionadoId, ocorrencias]);

  const selecionadoApoio = useMemo(() => {
    const id = selecionadoId?.startsWith("apoio-")
      ? Number(selecionadoId.slice(6))
      : null;
    return id == null ? null : apoios.find((a) => a.id === id) ?? null;
  }, [selecionadoId, apoios]);


  const allEventsSorted = useMemo(
    () =>
      [...eventos].sort(
        (a, b) =>
          new Date(b.data_inicio ?? "").getTime() -
          new Date(a.data_inicio ?? "").getTime(),
      ),
    [eventos],
  );

  if (!zoneId) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-8"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="text-center py-20">
          <Icon
            name="search_off"
            className="text-on-surface-variant text-[48px] mb-4"
          />
          <p className="text-sm text-on-surface-variant">
            Nenhuma zona especificada.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <DataLoading description="Preparando os detalhes da zona..." />;
  }

  if (!z) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-8"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="text-center py-20">
          <Icon
            name="search_off"
            className="text-on-surface-variant text-[48px] mb-4"
          />
          <p className="text-sm text-on-surface-variant">
            {loadError || "Zona não encontrada."}
          </p>
        </div>
      </div>
    );
  }

  const tone =
    z.status === "critico"
      ? "error"
      : z.status === "atencao"
        ? "warning"
        : "secondary";

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header>
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-4"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag>ZONA #{z.id}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <Chip tone={tone}>{STATUS_LABEL[z.status]}</Chip>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <Chip tone="neutral">{TIPO_LABEL[z.tipo] ?? z.tipo}</Chip>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              {z.nome}
            </h1>
            {z.descricao && (
              <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">
                {z.descricao}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="delete" onClick={() => setShowDeleteModal(true)}>
              Excluir
            </Btn>
            <Btn variant="primary" icon="edit" onClick={() => setShowEditModal(true)}>
              Editar informações
            </Btn>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-5">
        {/* Map */}
        <section className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <ZoneMap
            zoneId={z.id}
            zoneName={z.nome}
            height={ALTURA_MAPA}
            editable={true}
            pontos={pontos}
            pontoSelecionadoId={selecionadoId}
            onSelecionarPonto={selecionarPonto}
          />
        </section>

        {/* Lista lateral: ocorrências e pontos de apoio da zona */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          <div
            className="card-tonal p-6 shadow-ambient-sm flex flex-col overflow-hidden"
            style={{ height: ALTURA_MAPA + 16 }}
          >
            {/* abas */}
            <div className="flex items-center gap-5 border-b border-outline-variant/20 px-1 mb-4">
              {(["ocorrencias", "apoios"] as const).map((chave) => {
                const ativa = aba === chave;
                const total =
                  chave === "ocorrencias" ? ocorrencias.length : apoios.length;
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => mudarAba(chave)}
                    className={`-mb-px pb-3 pt-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-mono-tight border-b-2 transition ${
                      ativa
                        ? "border-primary text-primary"
                        : "border-transparent text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    {chave === "ocorrencias"
                      ? "Ocorrências"
                      : "Pontos de Apoio"}
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        ativa
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      {String(total).padStart(2, "0")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* conteúdo: lista da aba ou detalhe do item selecionado */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
              {selecionadoOcorrencia ? (
                <PainelOcorrencia
                  ocorrencia={selecionadoOcorrencia}
                  onVoltar={() => {
                    setSelecionadoId(null);
                    setAvisoFicha(false);
                  }}
                />
              ) : selecionadoApoio ? (
                <PainelApoio
                  apoio={selecionadoApoio}
                  onVoltar={() => {
                    setSelecionadoId(null);
                    setAvisoFicha(false);
                  }}
                />
              ) : aba === "ocorrencias" ? (
                ocorrencias.length === 0 ? (
                  <SemItens texto="Nenhuma ocorrência registrada nesta zona." />
                ) : (
                  <div className="space-y-2">
                    {ocorrencias.map((o) => {
                      const meta = getOccurrenceStatusMeta(o.status);
                      const ativo = selecionadoId === `oc-${o.id}`;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setSelecionadoId(ativo ? null : `oc-${o.id}`);
                            setAvisoFicha(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg flex gap-3 items-start transition ${
                            ativo
                              ? "bg-primary/8 ring-1 ring-primary/30"
                              : "bg-surface-container-low hover:bg-surface-container-higher"
                          }`}
                        >
                          <span
                            className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: meta.color }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block font-bold text-[13px] text-primary truncate">
                              {o.titulo || `Ocorrência #${o.id}`}
                            </span>
                            <span className="block text-[11px] text-on-surface-variant truncate mt-0.5">
                              {CATEGORIA_LABEL[o.categoria] ?? o.categoria} ·{" "}
                              {meta.label}
                              {o.endereco ? ` · ${o.endereco}` : ""}
                            </span>
                            <span className="block text-[10px] font-mono text-slate-400 mt-1">
                              {formatDataHora(o.created_at)}
                            </span>
                          </span>
                          <Icon
                            name="chevron_right"
                            className="text-on-surface-variant text-[16px] mt-1"
                          />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : apoios.length === 0 ? (
                <SemItens texto="Nenhum ponto de apoio registrado nesta zona." />
              ) : (
                <div className="space-y-2">
                  {apoios.map((a) => {
                    const ativo = selecionadoId === `apoio-${a.id}`;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setSelecionadoId(ativo ? null : `apoio-${a.id}`);
                          setAvisoFicha(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg flex gap-3 items-start transition ${
                          ativo
                            ? "bg-primary/8 ring-1 ring-primary/30"
                            : "bg-surface-container-low hover:bg-surface-container-higher"
                        }`}
                      >
                        <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0 bg-[#7C4DFF]" />
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold text-[13px] text-primary truncate">
                            {a.nome}
                          </span>
                          <span className="block text-[11px] text-on-surface-variant truncate mt-0.5">
                            {a.tipo_label}
                            {a.endereco ? ` · ${a.endereco}` : ""}
                          </span>
                        </span>
                        <Icon
                          name="chevron_right"
                          className="text-on-surface-variant text-[16px] mt-1"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ações fixas do detalhe (fora da área de rolagem, nunca somem) */}
            {(selecionadoOcorrencia || selecionadoApoio) && (
              <div className="pt-4 mt-4 border-t border-outline-variant/20">
                {selecionadoOcorrencia ? (
                  <Btn
                    variant="primary"
                    icon="open_in_new"
                    className="w-full"
                    onClick={() =>
                      // sem noopener: nova aba herda a sessionStorage (senão cai no login)
                      window.open(
                        `/occurrences?id=${selecionadoOcorrencia.id}`,
                        "_blank",
                      )
                    }
                  >
                    Ver ocorrência completa
                  </Btn>
                ) : selecionadoApoio ? (
                  <>
                    <Btn
                      variant="secondary"
                      icon="open_in_new"
                      className="w-full"
                      onClick={() => setAvisoFicha((v) => !v)}
                    >
                      Abrir ficha completa
                    </Btn>
                    {avisoFicha ? (
                      <p className="text-[11px] text-on-surface-variant mt-3 text-center">
                        Ficha completa do ponto de apoio em breve.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Desastres section — using backend eventos */}
        <section className="col-span-12 lg:col-span-6 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="HISTÓRICO"
            title="Desastres Registrados"
            action={
              <Chip tone="error">
                {String(desastres.length).padStart(2, "0")}
              </Chip>
            }
          />
          {desastres.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">
              Nenhum desastre registrado para esta zona.
            </p>
          ) : (
            <div className="space-y-3">
              {desastres.map((e) => (
                <div
                  key={e.id}
                  className="bg-surface-container-low p-4 rounded-lg flex gap-4"
                >
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-mono font-black text-error">
                      {formatYear(e.data_inicio ?? "")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-primary">{e.nome}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed line-clamp-3">
                      {e.descricao}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(e.data_inicio ?? "")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mitigações section — using backend eventos */}
        <section className="col-span-12 lg:col-span-6 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="SOLUÇÕES APLICADAS"
            title="Histórico de Mitigação"
            action={
              <Chip tone="secondary">
                {String(mitigacoes.length).padStart(2, "0")}
              </Chip>
            }
          />
          {mitigacoes.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">
              Nenhuma mitigação registrada para esta zona.
            </p>
          ) : (
            <div className="space-y-4">
              {mitigacoes.map((e) => {
                const concluido =
                  e.status?.toLowerCase() === "concluído" ||
                  e.status?.toLowerCase() === "concluido";
                return (
                  <div
                    key={e.id}
                    className={`p-5 rounded-lg ${concluido
                        ? "bg-secondary/8"
                        : "bg-warning-container/40"
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon
                        name={concluido ? "check_circle" : "pending"}
                        filled
                        className={
                          concluido ? "text-secondary" : "text-orange-600"
                        }
                      />
                      <h5 className="font-bold text-sm text-primary">
                        {e.nome}
                      </h5>
                      {e.status && (
                        <Chip
                          tone={concluido ? "secondary" : "warning"}
                          className="ml-auto"
                        >
                          {concluido ? "CONCLUÍDA" : e.status.toUpperCase()}
                        </Chip>
                      )}
                    </div>
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">
                      {e.descricao}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(e.data_inicio ?? "")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Timeline of all eventos */}
        {allEventsSorted.length > 0 && (
          <section className="col-span-12 card-tonal p-10 shadow-ambient-sm relative overflow-hidden">
            <SectionHeader
              overline="LINHA DO TEMPO"
              title="Histórico de Eventos & Mitigação"
            />
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/40" />
              <div className="space-y-8 relative">
                {allEventsSorted.map((e) => {
                  const isDesastre = e.tipo === "desastre";
                  const color = isDesastre ? "primary" : "secondary";
                  return (
                    <div key={e.id} className="flex gap-6 pl-8 relative">
                      <div
                        className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full ring-4 ring-white ${color === "primary"
                            ? "bg-primary"
                            : "bg-secondary"
                          }`}
                        style={{
                          boxShadow:
                            "0 0 0 1px " +
                            (color === "primary" ? "#051125" : "#006A60"),
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-primary text-base">
                            {e.nome}
                          </h5>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-mono">
                            {formatDate(e.data_inicio ?? "")}
                          </span>
                        </div>
                        <p className="text-[13px] text-on-surface-variant leading-relaxed mb-3">
                          {e.descricao}
                        </p>
                        <div className="flex gap-2">
                          <Chip
                            tone={isDesastre ? "error" : "secondary"}
                          >
                            {isDesastre ? "DESASTRE" : "MITIGAÇÃO"}
                          </Chip>
                          {e.status && (
                            <Chip tone="neutral">{e.status}</Chip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {showEditModal && (
        <EditZoneModal
          open
          onClose={() => setShowEditModal(false)}
          onSaved={(zonaAtualizada) => {
            setData((current) =>
              current ? { ...current, zonas: { ...current.zonas, ...zonaAtualizada } } : current,
            );
            setShowEditModal(false);
          }}
          zona={z}
        />
      )}

      <DeleteZoneModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          setShowDeleteModal(false);
          router.push("/zones");
        }}
        zona={z}
      />
    </div>
  );
}

export default function ZoneDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-on-surface-variant">
          Carregando detalhes da zona…
        </div>
      }
    >
      <ZoneDetailContent />
    </Suspense>
  );
}
