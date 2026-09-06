"use client";

import dynamic from "next/dynamic";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Chip, Icon, MetaTag, SectionHeader, StatusDot, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import { EventFormModal } from "@/app/components/EventFormModal";
import { DeleteEventModal } from "@/app/components/DeleteEventModal";
import { DataLoading } from "@/app/components/DataLoading";
import { PRIORIDADE_META, type RouteStop } from "@/app/components/RouteMap";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

const RouteMap = dynamic(
  () => import("@/app/components/RouteMap").then((module) => module.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[460px] items-center justify-center rounded-xl bg-surface-container-low">
        <p className="text-sm font-medium text-on-surface-variant">Carregando rota...</p>
      </div>
    ),
  },
);

interface TimelineItem {
  id: number;
  tipo: "ocorrencia_vinculada" | "ocorrencia_desvinculada" | "evento_criado" | "evento_ativado" | "evento_desativado" | "nota";
  titulo: string;
  detalhe: string;
  nivel: "info" | "atencao" | "critico";
  data_hora: string;
  autor_nome: string | null;
  ocorrencia: number | { id: number } | null;
  anterior_ao_evento: boolean;
  snapshot: Record<string, unknown> | null;
}

interface RotaEvento {
  prioridade: string;
  paradas: RouteStop[];
  distanciaTotal: string;
  tempoEstimado: string;
}

interface Evento {
  id: number;
  entidade: number;
  tipo: "desastre" | "mitigacao";
  nome: string;
  descricao: string;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  resumo_publico: string;
  recomendacoes: string[];
  timeline?: unknown[];
  zonas: number[];
  ocorrencias_count: number;
  rota_ia?: RotaEvento | null;
}

interface TimelineResponse {
  entradas: TimelineItem[];
}

interface Ocorrencia {
  id: number;
  titulo: string;
  evento: number | null;
}

// ocorrência completa vinculada ao evento
interface OcorrenciaDetalhada {
  id: number;
  titulo?: string;
  descricao?: string;
  categoria?: string;
  status?: string;
  endereco?: string;
  coordenadas?: { lat: number; lng: number } | null;
  created_at?: string;
  fatalidades?: number;
  custo_danos?: string | null;
  total_itens_danos?: number;
}

interface Zona {
  id: number;
  nome: string;
}

interface EventoListResponse {
  eventos: Evento[];
  evento_vinculado_id: number | null;
}

interface EventoDetailResponse {
  eventos: Evento;
  evento_vinculado_id: number | null;
}

interface OcorrenciaListResponse {
  ocorrencias: Ocorrencia[];
}

const EMPTY_ROUTE: RotaEvento = {
  prioridade: "—",
  paradas: [],
  distanciaTotal: "—",
  tempoEstimado: "—",
};

const NIVEL_DOT: Record<string, string> = {
  info: "bg-secondary",
  atencao: "bg-orange-500",
  critico: "bg-error",
};

const TIMELINE_TYPE_META: Record<TimelineItem["tipo"], { icon: string; label: string }> = {
  ocorrencia_vinculada: { icon: "link", label: "Ocorrência vinculada" },
  ocorrencia_desvinculada: { icon: "link_off", label: "Ocorrência desvinculada" },
  evento_criado: { icon: "add_circle", label: "Evento criado" },
  evento_ativado: { icon: "play_circle", label: "Evento ativado" },
  evento_desativado: { icon: "stop_circle", label: "Evento desativado" },
  nota: { icon: "note", label: "Nota manual" },
};

const formatTimelineDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

type TimelineAction = "carregar" | "adicionar" | "apagar";

function timelineErrorMessage(error: unknown, action: TimelineAction): string {
  if (!isAxiosError(error)) {
    return `Não foi possível ${action === "carregar" ? "carregar a timeline" : action === "adicionar" ? "adicionar a nota" : "apagar a nota"}. Tente novamente.`;
  }

  const status = error.response?.status;
  const data = error.response?.data as
    | { error?: string; detail?: string; titulo?: string[]; data_hora?: string[] }
    | undefined;
  const backendMessage = data?.error || data?.detail;

  if (status === 403) {
    if (backendMessage?.toLocaleLowerCase("pt-BR").includes("apenas notas")) {
      return "Esta entrada foi criada pelo sistema e não pode ser apagada. Apenas notas manuais podem ser removidas.";
    }
    return action === "carregar"
      ? "Você não tem permissão para acessar a timeline deste evento, pois ele pertence a outra entidade."
      : "Você não tem permissão para alterar a timeline deste evento, pois ele pertence a outra entidade.";
  }

  if (status === 404) {
    return action === "apagar"
      ? "A nota não foi encontrada. Ela pode já ter sido removida."
      : "O evento ou a entrada da timeline não foi encontrado.";
  }

  if (status === 400) {
    return data?.titulo?.[0] || data?.data_hora?.[0] || backendMessage || "Confira os dados informados na nota.";
  }

  return backendMessage || `Não foi possível ${action === "carregar" ? "carregar a timeline" : action === "adicionar" ? "adicionar a nota" : "apagar a nota"}. Tente novamente.`;
}

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

const TYPE_LABEL: Record<Evento["tipo"], string> = {
  desastre: "Desastre",
  mitigacao: "Mitigação",
};

const OCCURRENCE_CATEGORY_LABEL: Record<string, string> = {
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

const formatOccurrenceTitle = (title: string) =>
  Object.entries(OCCURRENCE_CATEGORY_LABEL).reduce(
    (formatted, [category, label]) => formatted.replaceAll(category, label),
    title,
  );

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  monitorando: "Monitorando",
  encerrado: "Encerrado",
  concluido: "Concluído",
  concluído: "Concluído",
  em_andamento: "Em Andamento",
  em_analise: "Em Análise",
  atencao: "Atenção",
  atenção: "Atenção",
  planejado: "Planejado",
};

const statusLabel = (status: string | null) => {
  if (!status) return "SEM STATUS";
  const value = normalize(status);
  return (STATUS_LABEL[value] ?? status.replaceAll("_", " ")).toLocaleUpperCase("pt-BR");
};

const statusTone = (status: string | null) => {
  const value = normalize(status);
  if (value === "ativo") return "error" as const;
  if (value === "monitorando") return "warning" as const;
  if (value === "encerrado" || value === "concluido" || value === "concluído") {
    return "neutral" as const;
  }
  return "primarySoft" as const;
};

const isClosed = (status: string | null) =>
  ["encerrado", "concluido", "concluído"].includes(normalize(status));

// limite por página usado na lista de ocorrências da aba Ocorrências
const OCORRENCIAS_POR_PAGINA = 50;

// formata valor monetário em reais (null quando zero ou ausente)
const formatarReais = (valor?: string | null) => {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

// formata coordenadas lat/lng para exibição (null quando ausentes)
const formatarCoordenadas = (coordenadas?: OcorrenciaDetalhada["coordenadas"]) => {
  if (!coordenadas || typeof coordenadas.lat !== "number" || typeof coordenadas.lng !== "number") {
    return null;
  }
  return `${coordenadas.lat.toFixed(5)}, ${coordenadas.lng.toFixed(5)}`;
};

// painel de detalhes da ocorrência selecionada na aba Ocorrências
function OcorrenciaDetalhePanel({ ocorrencia }: { ocorrencia: OcorrenciaDetalhada }) {
  const meta = getOccurrenceStatusMeta(ocorrencia.status);
  const categoriaLabel = ocorrencia.categoria
    ? OCCURRENCE_CATEGORY_LABEL[ocorrencia.categoria] ?? ocorrencia.categoria
    : "Sem categoria";
  const custo = formatarReais(ocorrencia.custo_danos);
  const coordenadas = formatarCoordenadas(ocorrencia.coordenadas);
  const titulo =
    formatOccurrenceTitle(ocorrencia.titulo ?? "") || `Ocorrência #${ocorrencia.id}`;

  return (
    <div className="h-fit rounded-xl bg-surface-container-low p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MetaTag className="text-secondary">OCORRÊNCIA #{ocorrencia.id}</MetaTag>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </div>
      <h3 className="mt-2 font-headline text-lg font-bold leading-snug text-primary">{titulo}</h3>
      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-on-surface-variant">Data</dt>
          <dd className="text-right font-semibold text-primary">{formatTimelineDate(ocorrencia.created_at ?? "")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-on-surface-variant">Categoria</dt>
          <dd className="text-right font-semibold text-primary">{categoriaLabel}</dd>
        </div>
        {ocorrencia.endereco && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-on-surface-variant">Endereço</dt>
            <dd className="text-right font-semibold text-primary">{ocorrencia.endereco}</dd>
          </div>
        )}
        {coordenadas && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-on-surface-variant">Coordenadas</dt>
            <dd className="font-mono text-right font-semibold text-primary">{coordenadas}</dd>
          </div>
        )}
        {typeof ocorrencia.fatalidades === "number" && ocorrencia.fatalidades > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-on-surface-variant">Fatalidades</dt>
            <dd className="text-right font-semibold text-error">{ocorrencia.fatalidades}</dd>
          </div>
        )}
        {custo && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-on-surface-variant">Custo em danos</dt>
            <dd className="text-right font-semibold text-primary">{custo}</dd>
          </div>
        )}
      </dl>
      {ocorrencia.descricao && (
        <p className="mt-3 text-[12px] leading-relaxed text-on-surface-variant">{ocorrencia.descricao}</p>
      )}
      <Btn
        variant="secondary"
        icon="open_in_new"
        className="mt-4 w-full"
        onClick={() =>
          // sem noopener: nova aba herda a sessionStorage (senão cai no login)
          window.open(`/occurrences?id=${ocorrencia.id}`, "_blank")
        }
      >
        Ver ocorrência completa
      </Btn>
    </div>
  );
}

export default function EventsPage() {
  const { showToast } = useGardian();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoVinculadoId, setEventoVinculadoId] = useState<number | null>(null);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [zonaLookup, setZonaLookup] = useState<Map<number, string>>(new Map());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [tab, setTab] = useState<"tempo_real" | "ocorrencias" | "rota" | "timeline" | "publico">("tempo_real");
  const [paradaAtiva, setParadaAtiva] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [editandoPublico, setEditandoPublico] = useState(false);
  const [rascunhoResumo, setRascunhoResumo] = useState("");
  const [rascunhoRecs, setRascunhoRecs] = useState<string[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [adicionandoNota, setAdicionandoNota] = useState(false);
  const [notaTitulo, setNotaTitulo] = useState("");
  const [notaDetalhe, setNotaDetalhe] = useState("");
  const [notaNivel, setNotaNivel] = useState<TimelineItem["nivel"]>("info");
  const [notaDataHora, setNotaDataHora] = useState("");
  const [ocorrenciasEvento, setOcorrenciasEvento] = useState<OcorrenciaDetalhada[]>([]);
  const [ocorrenciasEventoId, setOcorrenciasEventoId] = useState<number | null>(null);
  const [loadingOcorrenciasEvento, setLoadingOcorrenciasEvento] = useState(false);
  const [ocorrenciasEventoError, setOcorrenciasEventoError] = useState("");
  const [ocorrenciaSelecionadaId, setOcorrenciaSelecionadaId] = useState<number | null>(null);
  const [ocorrenciasReloadKey, setOcorrenciasReloadKey] = useState(0);
  const ocorrenciasCacheRef = useRef<Map<number, OcorrenciaDetalhada[]>>(new Map());
  const ocorrenciasAlvoRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const eventResponse = await api.get<EventoListResponse>("/eventos/");
      const eventList = eventResponse.data.eventos ?? [];
      setEventos(eventList);
      setEventoVinculadoId(eventResponse.data.evento_vinculado_id ?? null);
      setSelectedId((current) =>
        current != null && eventList.some((event) => event.id === current)
          ? current
          : eventList[0]?.id ?? null,
      );

      const [occurrenceResult, zoneResult] = await Promise.allSettled([
        api.get<OcorrenciaListResponse>("/ocorrencias/"),
        api.get<{ zonas: Zona[] }>("/zonas/"),
      ]);

      setOcorrencias(
        occurrenceResult.status === "fulfilled"
          ? occurrenceResult.value.data.ocorrencias ?? []
          : [],
      );
      setZonaLookup(
        new Map(
          zoneResult.status === "fulfilled"
            ? (zoneResult.value.data.zonas ?? []).map((zone) => [zone.id, zone.nome])
            : [],
        ),
      );
    } catch {
      setEventos([]);
      setEventoVinculadoId(null);
      setOcorrencias([]);
      setZonaLookup(new Map());
      setSelectedId(null);
      setLoadError("Não foi possível carregar os eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setDetailError("");
      api
        .get<EventoDetailResponse>(`/eventos/${selectedId}/`)
        .then((response) => {
          if (cancelled) return;
          const detail = response.data.eventos;
          setEventoVinculadoId(response.data.evento_vinculado_id);
          setEventos((current) =>
            current.map((event) => (event.id === detail.id ? detail : event)),
          );
        })
        .catch(() => {
          if (!cancelled) setDetailError("Não foi possível atualizar os detalhes do evento.");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedId]);

  const fetchTimeline = useCallback(async (eventId: number) => {
    setLoadingTimeline(true);
    setTimelineError("");
    try {
      const response = await api.get<TimelineResponse>(`/eventos/${eventId}/timeline/`);
      setTimelineEntries(response.data.entradas ?? []);
    } catch (error) {
      setTimelineEntries([]);
      setTimelineError(timelineErrorMessage(error, "carregar"));
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId == null) {
        setTimelineEntries([]);
        return;
      }
      void fetchTimeline(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchTimeline, selectedId]);

  // carrega as ocorrências do evento selecionado (cache por evento para não dar refetch)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab !== "ocorrencias" || selectedId == null) return;
      const alvo = selectedId;
      ocorrenciasAlvoRef.current = alvo;

      const cached = ocorrenciasCacheRef.current.get(alvo);
      if (cached && ocorrenciasEventoId === alvo) return;

      setOcorrenciasEventoError("");
      setLoadingOcorrenciasEvento(true);

      if (cached) {
        setOcorrenciaSelecionadaId(null);
        setOcorrenciasEvento(cached);
        setOcorrenciasEventoId(alvo);
        setLoadingOcorrenciasEvento(false);
        return;
      }

      api
        .get<{ ocorrencias: OcorrenciaDetalhada[] }>(
          `/ocorrencias/?evento_id=${alvo}&quantidade_por_pagina=${OCORRENCIAS_POR_PAGINA}`,
        )
        .then((response) => {
          if (ocorrenciasAlvoRef.current !== alvo) return;
          const lista = response.data.ocorrencias ?? [];
          ocorrenciasCacheRef.current.set(alvo, lista);
          setOcorrenciaSelecionadaId(null);
          setOcorrenciasEvento(lista);
          setOcorrenciasEventoId(alvo);
        })
        .catch(() => {
          if (ocorrenciasAlvoRef.current !== alvo) return;
          setOcorrenciasEventoId(null);
          setOcorrenciasEvento([]);
          setOcorrenciasEventoError("Não foi possível carregar as ocorrências deste evento.");
        })
        .finally(() => {
          if (ocorrenciasAlvoRef.current === alvo) setLoadingOcorrenciasEvento(false);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, selectedId, ocorrenciasEventoId, ocorrenciasReloadKey]);

  // ocorrência escolhida na aba Ocorrências
  const ocorrenciaSelecionada = useMemo(
    () => ocorrenciasEvento.find((item) => item.id === ocorrenciaSelecionadaId) ?? null,
    [ocorrenciasEvento, ocorrenciaSelecionadaId],
  );

  // true quando a lista de ocorrências exibida corresponde ao evento selecionado
  const ocorrenciasCarregadas = selectedId != null && ocorrenciasEventoId === selectedId;

  // força recarga da lista de ocorrências do evento (limpa cache e dispara o efeito)
  const atualizarOcorrencias = useCallback(() => {
    if (selectedId == null) return;
    ocorrenciasCacheRef.current.delete(selectedId);
    setOcorrenciasEventoId(null);
    setOcorrenciasEvento([]);
    setOcorrenciasEventoError("");
    setOcorrenciasReloadKey((current) => current + 1);
  }, [selectedId]);

  const filteredEvents = useMemo(() => {
    const term = normalize(search);
    return eventos.filter((event) => {
      const matchesType = typeFilter === "todos" || event.tipo === typeFilter;
      const matchesStatus = statusFilter === "todos" || normalize(event.status) === statusFilter;
      const matchesSearch =
        !term ||
        [
          String(event.id),
          event.nome,
          event.descricao,
          event.tipo,
          TYPE_LABEL[event.tipo],
          event.status ?? "",
          statusLabel(event.status),
        ].some((value) => normalize(value).includes(term));
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [eventos, search, statusFilter, typeFilter]);

  const statusOptions = useMemo(
    () => [...new Set(eventos.map((event) => normalize(event.status)).filter(Boolean))],
    [eventos],
  );

  const evento = useMemo(
    () => eventos.find((event) => event.id === selectedId) ?? null,
    [eventos, selectedId],
  );

  const ocorrenciasVinculadas = useMemo(
    () => ocorrencias.filter((occurrence) => occurrence.evento === evento?.id),
    [evento?.id, ocorrencias],
  );

  const toggleVinculacao = async () => {
    if (!evento) return;
    setSavingAction(true);
    const vinculado = eventoVinculadoId === evento.id;
    try {
      const response = await api.post<{ evento_vinculado_id: number | null }>(
        vinculado ? `/eventos/${evento.id}/desativar/` : `/eventos/${evento.id}/ativar/`,
      );
      setEventoVinculadoId(response.data.evento_vinculado_id);
      showToast(
        vinculado
          ? "Vinculação automática desativada."
          : "Evento vinculado ao formulário público.",
      );
    } catch {
      showToast("Não foi possível atualizar a vinculação.", "error");
    } finally {
      setSavingAction(false);
    }
  };

  const abrirEdicaoPublico = () => {
    if (!evento) return;
    setRascunhoResumo(evento.resumo_publico ?? "");
    setRascunhoRecs([...(evento.recomendacoes ?? [])]);
    setEditandoPublico(true);
  };

  const salvarPublico = async () => {
    if (!evento) return;
    if (!rascunhoResumo.trim()) {
      showToast("O resumo público não pode ficar vazio.", "error");
      return;
    }
    setSavingAction(true);
    try {
      const response = await api.patch<Evento>(`/eventos/${evento.id}/`, {
        resumo_publico: rascunhoResumo.trim(),
        recomendacoes: rascunhoRecs.map((item) => item.trim()).filter(Boolean),
      });
      setEventos((current) =>
        current.map((item) => (item.id === evento.id ? { ...item, ...response.data } : item)),
      );
      setEditandoPublico(false);
      showToast("Resumo público atualizado com sucesso.");
    } catch {
      showToast("Não foi possível atualizar o resumo público.", "error");
    } finally {
      setSavingAction(false);
    }
  };

  const adicionarNotaTimeline = async () => {
    if (!evento) return;
    if (!notaTitulo.trim()) {
      setTimelineError("Informe o título da nota.");
      return;
    }
    setSavingAction(true);
    setTimelineError("");
    try {
      await api.post<TimelineItem>(`/eventos/${evento.id}/timeline/`, {
        titulo: notaTitulo.trim(),
        detalhe: notaDetalhe.trim(),
        nivel: notaNivel,
        ...(notaDataHora ? { data_hora: new Date(notaDataHora).toISOString() } : {}),
      });
      setNotaTitulo("");
      setNotaDetalhe("");
      setNotaNivel("info");
      setNotaDataHora("");
      setAdicionandoNota(false);
      await fetchTimeline(evento.id);
      showToast("Nota adicionada à timeline.");
    } catch (error) {
      setTimelineError(timelineErrorMessage(error, "adicionar"));
    } finally {
      setSavingAction(false);
    }
  };

  const apagarNotaTimeline = async (entrada: TimelineItem) => {
    if (!evento || entrada.tipo !== "nota") return;
    if (!window.confirm(`Apagar a nota “${entrada.titulo}”?`)) return;
    setSavingAction(true);
    setTimelineError("");
    try {
      await api.delete(`/eventos/${evento.id}/timeline/${entrada.id}/`);
      setTimelineEntries((current) => current.filter((item) => item.id !== entrada.id));
      showToast("Nota removida da timeline.");
    } catch (error) {
      setTimelineError(timelineErrorMessage(error, "apagar"));
    } finally {
      setSavingAction(false);
    }
  };

  if (loading) {
    return <DataLoading description="Preparando os eventos..." />;
  }

  const route = evento?.rota_ia ?? EMPTY_ROUTE;
  const realTime = timelineEntries[0] ?? null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-8">
      <header>
        <div className="mb-3 flex items-center gap-2">
          <MetaTag className="text-secondary">GERENCIAMENTO DE EVENTOS</MetaTag>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <MetaTag>{eventos.filter((item) => !isClosed(item.status)).length} ATIVO(S)</MetaTag>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h1 className="font-headline text-5xl font-black tracking-tighter text-primary">Eventos</h1>
          <Btn variant="primary" icon="add" onClick={() => setShowCreateModal(true)}>
            Novo evento
          </Btn>
        </div>
      </header>

      {loadError && (
        <div className="rounded-xl border border-error/20 bg-error-container p-5">
          <div className="flex items-center gap-3">
            <Icon name="error" filled className="text-[22px] text-error" />
            <p className="text-sm font-medium text-on-error-container">{loadError}</p>
          </div>
        </div>
      )}

      <section className="grid items-end gap-4 rounded-xl bg-surface-container-low p-4 md:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_220px_220px_auto]">
        <label className="min-w-0 md:col-span-2 xl:col-span-1">
          <MetaTag className="mb-2 block">Pesquisa</MetaTag>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-on-surface-variant" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por nome, descrição, tipo, status ou número do evento..."
              className="w-full rounded-lg border-none bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-primary placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-secondary"
            />
          </div>
        </label>

        <label className="min-w-0">
          <MetaTag className="mb-2 block">Status</MetaTag>
          <div className="relative">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-lg border-none bg-white py-3.5 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary">
              <option value="todos">Todos os status</option>
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <Icon name="keyboard_arrow_down" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-primary" />
          </div>
        </label>
        <label className="min-w-0">
          <MetaTag className="mb-2 block">Tipo</MetaTag>
          <div className="relative">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-full appearance-none rounded-lg border-none bg-white py-3.5 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary">
              <option value="todos">Todos os tipos</option>
              <option value="desastre">Desastre</option>
              <option value="mitigacao">Mitigação</option>
            </select>
            <Icon name="keyboard_arrow_down" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-primary" />
          </div>
        </label>
        <div className="flex min-h-12 items-center md:justify-end">
          <MetaTag>{filteredEvents.length} RESULTADO(S)</MetaTag>
        </div>
      </section>

      {!loadError && eventos.length === 0 && (
        <div className="py-20 text-center">
          <Icon name="event_busy" className="mb-4 text-[48px] text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">Nenhum evento cadastrado.</p>
        </div>
      )}

      {eventos.length > 0 && (
        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 space-y-3 lg:col-span-4">
            {filteredEvents.map((item) => {
              const active = item.id === evento?.id;
              return (
                <button key={item.id} type="button" onClick={() => { if (selectedId !== item.id) { setOcorrenciaSelecionadaId(null); setOcorrenciasEventoId(null); setOcorrenciasEvento([]); setOcorrenciasEventoError(""); } setSelectedId(item.id); setTimelineEntries([]); setLoadingTimeline(true); setAdicionandoNota(false); setTimelineError(""); }} className={`card-tonal relative w-full overflow-hidden p-5 text-left shadow-ambient-sm transition-all hover:shadow-ambient ${active ? "ring-2 ring-secondary" : ""}`}>
                  <span className={`absolute bottom-0 left-0 top-0 w-1 ${normalize(item.status) === "ativo" ? "bg-error" : normalize(item.status) === "monitorando" ? "bg-orange-500" : "bg-slate-300"}`} />
                  <div className="pl-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Chip tone={statusTone(item.status)}>{statusLabel(item.status)}</Chip>
                      {item.id === eventoVinculadoId && <span className="flex items-center gap-1.5"><StatusDot tone="secondary" /><MetaTag className="text-secondary">VINCULAÇÃO ATIVA</MetaTag></span>}
                    </div>
                    <p className="font-headline text-[15px] font-bold leading-snug text-primary">{item.nome}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">{TYPE_LABEL[item.tipo]}</p>
                    <div className="mt-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-mono text-slate-400">
                      <span>{item.ocorrencias_count ?? 0} OCORRÊNCIAS</span><span>·</span><span>{item.zonas?.length ?? 0} ZONAS</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredEvents.length === 0 && <p className="card-tonal p-6 text-sm text-on-surface-variant">Nenhum evento encontrado para estes filtros.</p>}
          </aside>

          {evento && (
            <div className="col-span-12 space-y-5 lg:col-span-8">
              {detailError && <p className="rounded-xl bg-error-container p-4 text-sm font-medium text-on-error-container">{detailError}</p>}
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="min-w-0">
                    <MetaTag className="mb-2 block text-secondary">EVENTO #{evento.id}</MetaTag>
                    <h2 className="font-headline text-3xl font-black tracking-tighter text-primary">{evento.nome}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{evento.descricao}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(evento.zonas ?? []).map((zoneId) => (
                        <button
                          key={zoneId}
                          type="button"
                          title={`Abrir página da zona ${zonaLookup.get(zoneId) ?? `#${zoneId}`}`}
                          onClick={() =>
                            // sem noopener: nova aba herda a sessionStorage (senão cai no login)
                            window.open(`/zonedetail?zone=${zoneId}`, "_blank")
                          }
                          className="rounded-full transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                        >
                          <Chip tone="neutral" icon="link">
                            {zonaLookup.get(zoneId) ?? `Zona #${zoneId}`}
                          </Chip>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <Btn variant="secondary" icon="edit" onClick={() => setShowEditModal(true)} full>Editar</Btn>
                    <Btn variant="danger" icon="delete" onClick={() => setShowDeleteModal(true)} full>Excluir</Btn>
                    <div className="card-recessed p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div><p className="text-[11px] font-black uppercase tracking-mono-tight text-primary">Vinculação automática</p><p className="mt-0.5 max-w-[180px] text-[10px] text-on-surface-variant">Configura este evento para receber novas ocorrências.</p></div>
                        <button type="button" onClick={toggleVinculacao} disabled={savingAction || isClosed(evento.status)} aria-label="Alternar vinculação automática" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${eventoVinculadoId === evento.id ? "bg-secondary" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${eventoVinculadoId === evento.id ? "left-6" : "left-1"}`} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Tab active={tab === "tempo_real"} onClick={() => setTab("tempo_real")} icon="podcasts">Tempo Real</Tab>
                <Tab active={tab === "ocorrencias"} onClick={() => setTab("ocorrencias")} icon="emergency">Ocorrências</Tab>
                <Tab active={tab === "rota"} onClick={() => setTab("rota")} icon="route">Rota IA</Tab>
                <Tab active={tab === "timeline"} onClick={() => setTab("timeline")} icon="timeline">Timeline</Tab>
                <Tab active={tab === "publico"} onClick={() => setTab("publico")} icon="campaign">Resumo Público</Tab>
              </div>

              {tab === "tempo_real" && (
                <div className="card-tonal p-7 shadow-ambient-sm">
                  <SectionHeader overline="RELATÓRIO EM TEMPO REAL" title="Dados que chegam do campo" />
                  {loadingTimeline ? (
                    <p className="text-[12px] text-on-surface-variant">Carregando atualização mais recente...</p>
                  ) : timelineError ? (
                    <p className="rounded-lg bg-error-container p-3 text-[12px] font-semibold text-error">{timelineError}</p>
                  ) : !realTime ? (
                    <p className="text-[12px] italic text-on-surface-variant">Nenhuma transmissão registrada para este evento.</p>
                  ) : (
                    <div className="flex gap-3 rounded-lg bg-surface-container-low p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                        <Icon name={TIMELINE_TYPE_META[realTime.tipo]?.icon ?? "sensors"} filled className="text-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-primary">{realTime.autor_nome || "Sistema"}</span>
                          <MetaTag>{TIMELINE_TYPE_META[realTime.tipo]?.label ?? realTime.tipo}</MetaTag>
                          <MetaTag className="text-secondary">{formatTimelineDate(realTime.data_hora)}</MetaTag>
                        </div>
                        <p className="mt-1 text-[13px] font-bold text-primary">{realTime.titulo}</p>
                        {realTime.detalhe && <p className="mt-1 text-[12px] leading-relaxed text-on-surface">{realTime.detalhe}</p>}
                        {realTime.anterior_ao_evento && (
                          <p className="mt-2 rounded-md bg-orange-100 px-3 py-2 text-[11px] font-semibold text-orange-800">
                            Ocorrência criada antes do evento; vinculada posteriormente.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-6 border-t border-outline-variant/20 pt-5">
                    <MetaTag className="mb-3 block">OCORRÊNCIAS VINCULADAS ({ocorrenciasVinculadas.length})</MetaTag>
                    {ocorrenciasVinculadas.length === 0 ? <p className="text-[12px] italic text-on-surface-variant">Nenhuma ocorrência vinculada.</p> : <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{ocorrenciasVinculadas.map((occurrence) => <div key={occurrence.id} className="flex items-center gap-2 rounded-lg bg-surface-container-low p-2.5 text-[12px]"><Icon name="emergency" className="shrink-0 text-[16px] text-error" /><span className="font-bold text-primary">#{occurrence.id}</span><span className="truncate">{formatOccurrenceTitle(occurrence.titulo)}</span></div>)}</div>}
                  </div>
                </div>
              )}

              {tab === "rota" && (
                <div className="card-tonal p-7 shadow-ambient-sm">
                  <SectionHeader overline="BACKTRACKING VEICULAR" title="Rota otimizada para os agentes" action={<Chip tone="primarySoft" icon="psychology">GERADA PELA IA</Chip>} />
                  {route.paradas.length === 0 ? <p className="text-[12px] italic text-on-surface-variant">Sem rota ativa para este evento.</p> : <><div className="card-recessed mb-5 flex flex-wrap items-center gap-x-8 gap-y-2 p-4"><div><MetaTag>PRIORIDADE</MetaTag><p className="text-[12px] font-bold text-primary">{route.prioridade}</p></div><div><MetaTag>PARADAS</MetaTag><p className="text-[12px] font-bold text-primary">{route.paradas.length}</p></div><div><MetaTag>DISTÂNCIA</MetaTag><p className="text-[12px] font-bold text-primary">{route.distanciaTotal}</p></div><div><MetaTag>TEMPO ESTIMADO</MetaTag><p className="text-[12px] font-bold text-primary">{route.tempoEstimado}</p></div></div><div className="mb-5"><RouteMap stops={route.paradas} height={460} activeStop={paradaAtiva} onSelectStop={(order) => setParadaAtiva(order === paradaAtiva ? null : order)} /></div><div className="space-y-2">{route.paradas.map((stop) => { const meta = PRIORIDADE_META[stop.prioridade]; return <div key={stop.ordem} className="flex gap-4 rounded-lg bg-surface-container-low p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: meta.color }}>{stop.ordem}</span><div><p className="font-bold text-primary">{stop.local}</p><p className="text-[11px] text-on-surface-variant">{stop.motivo}</p></div></div>; })}</div></>}
                </div>
              )}

              {tab === "timeline" && (
                <div className="card-tonal p-7 shadow-ambient-sm">
                  <SectionHeader
                    overline="CRESCIMENTO E DIMENSÃO"
                    title="Timeline do Evento"
                    action={
                      adicionandoNota ? (
                        <Btn variant="ghost" icon="close" onClick={() => { setAdicionandoNota(false); setTimelineError(""); }} disabled={savingAction}>Cancelar</Btn>
                      ) : (
                        <Btn variant="secondary" icon="add" onClick={() => setAdicionandoNota(true)}>Adicionar nota</Btn>
                      )
                    }
                  />
                  {adicionandoNota && (
                    <div className="mb-6 space-y-4 rounded-xl bg-surface-container-low p-5">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_220px]">
                        <label>
                          <MetaTag className="mb-1.5 block">Título</MetaTag>
                          <input value={notaTitulo} onChange={(event) => setNotaTitulo(event.target.value)} disabled={savingAction} placeholder="Título da nota" className="w-full rounded-lg border-none bg-white px-3 py-2.5 text-sm font-semibold text-primary focus:ring-2 focus:ring-secondary" />
                        </label>
                        <label>
                          <MetaTag className="mb-1.5 block">Nível</MetaTag>
                          <select value={notaNivel} onChange={(event) => setNotaNivel(event.target.value as TimelineItem["nivel"])} disabled={savingAction} className="w-full rounded-lg border-none bg-white px-3 py-2.5 text-sm font-semibold text-primary focus:ring-2 focus:ring-secondary">
                            <option value="info">Informativo</option>
                            <option value="atencao">Atenção</option>
                            <option value="critico">Crítico</option>
                          </select>
                        </label>
                        <label>
                          <MetaTag className="mb-1.5 block">Data e hora (opcional)</MetaTag>
                          <input type="datetime-local" value={notaDataHora} onChange={(event) => setNotaDataHora(event.target.value)} disabled={savingAction} className="w-full rounded-lg border-none bg-white px-3 py-2.5 text-sm font-semibold text-primary focus:ring-2 focus:ring-secondary" />
                        </label>
                      </div>
                      <label className="block">
                        <MetaTag className="mb-1.5 block">Detalhes (opcional)</MetaTag>
                        <textarea value={notaDetalhe} onChange={(event) => setNotaDetalhe(event.target.value)} disabled={savingAction} rows={3} placeholder="Informações adicionais..." className="w-full resize-none rounded-lg border-none bg-white px-3 py-2.5 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary" />
                      </label>
                      <Btn variant="success" icon="save" onClick={adicionarNotaTimeline} disabled={savingAction}>{savingAction ? "Salvando..." : "Salvar nota"}</Btn>
                    </div>
                  )}
                  {timelineError && <p role="alert" className="mb-4 rounded-lg bg-error-container p-3 text-sm font-semibold text-error">{timelineError}</p>}
                  {loadingTimeline ? (
                    <p className="text-[12px] text-on-surface-variant">Carregando timeline...</p>
                  ) : timelineEntries.length === 0 ? (
                    <p className="text-[12px] italic text-on-surface-variant">Nenhum registro na timeline.</p>
                  ) : (
                    <div className="relative pl-6">
                      <span className="absolute bottom-2 left-[7px] top-2 w-px bg-outline-variant/50" />
                      <div className="relative space-y-5">
                        {timelineEntries.map((item) => {
                          const tipoMeta = TIMELINE_TYPE_META[item.tipo];
                          const ocorrenciaId = typeof item.ocorrencia === "number" ? item.ocorrencia : item.ocorrencia?.id;
                          return (
                            <div key={item.id} className="relative rounded-lg bg-surface-container-low p-4">
                              <span className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow ${NIVEL_DOT[item.nivel] ?? "bg-slate-400"}`} />
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Icon name={tipoMeta?.icon ?? "history"} className="text-[16px] text-secondary" />
                                    <MetaTag>{tipoMeta?.label ?? item.tipo}</MetaTag>
                                    <MetaTag className="text-secondary">{formatTimelineDate(item.data_hora)}</MetaTag>
                                    {ocorrenciaId != null && <MetaTag>OCORRÊNCIA #{ocorrenciaId}</MetaTag>}
                                  </div>
                                  <p className="mt-2 text-[13px] font-bold text-primary">{item.titulo}</p>
                                  {item.detalhe && <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">{item.detalhe}</p>}
                                  <p className="mt-2 text-[10px] font-semibold text-on-surface-variant">{item.autor_nome || "Sistema"}</p>
                                  {item.anterior_ao_evento && (
                                    <p className="mt-3 rounded-md bg-orange-100 px-3 py-2 text-[11px] font-semibold text-orange-800">
                                      Ocorrência criada antes do evento; vinculada posteriormente.
                                    </p>
                                  )}
                                </div>
                                {item.tipo === "nota" && (
                                  <button type="button" onClick={() => void apagarNotaTimeline(item)} disabled={savingAction} className="shrink-0 rounded-lg p-2 text-on-surface-variant hover:bg-error-container hover:text-error disabled:opacity-50" aria-label={`Apagar nota ${item.titulo}`} title="Apagar nota">
                                    <Icon name="delete" className="text-[18px]" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "publico" && (
                <div className="card-tonal p-7 shadow-ambient-sm">
                  <SectionHeader
                    overline="INFORMATIVO À POPULAÇÃO"
                    title="Resumo e Recomendações"
                    action={
                      <div className="flex gap-2">
                        <Btn variant="ghost" icon="visibility" onClick={() => window.open("/report", "_blank")}>
                          Ver página pública
                        </Btn>
                        {!editandoPublico ? (
                          <Btn variant="secondary" icon="edit" onClick={abrirEdicaoPublico}>Editar</Btn>
                        ) : (
                          <Btn variant="ghost" icon="close" onClick={() => setEditandoPublico(false)}>Cancelar</Btn>
                        )}
                      </div>
                    }
                  />
                  {!editandoPublico ? <><div className="mb-5 rounded-xl bg-gradient-to-br from-primary to-primary-container p-7 text-white"><Chip tone="secondary" className="!bg-white/15 !text-white">AVISO À POPULAÇÃO</Chip><p className="mt-4 text-[14px] leading-relaxed text-white/85">{evento.resumo_publico || "Nenhum resumo público cadastrado."}</p></div>{evento.recomendacoes.length > 0 ? <div className="space-y-2">{evento.recomendacoes.map((recommendation, index) => <div key={index} className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3.5"><Icon name="verified_user" filled className="mt-0.5 shrink-0 text-[18px] text-secondary" /><p className="text-[13px] leading-relaxed text-on-surface">{recommendation}</p></div>)}</div> : <p className="text-[12px] italic text-on-surface-variant">Nenhuma recomendação cadastrada.</p>}</> : <div className="space-y-5"><div><MetaTag className="mb-2 block">RESUMO EXIBIDO À POPULAÇÃO</MetaTag><textarea value={rascunhoResumo} onChange={(event) => setRascunhoResumo(event.target.value)} rows={4} className="w-full resize-none rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary" /></div><div><div className="mb-2 flex items-center justify-between"><MetaTag>RECOMENDAÇÕES</MetaTag><Btn variant="ghost" icon="add" onClick={() => setRascunhoRecs((current) => [...current, ""])}>Adicionar</Btn></div><div className="space-y-2">{rascunhoRecs.map((recommendation, index) => <div key={index} className="flex items-start gap-2"><textarea value={recommendation} onChange={(event) => setRascunhoRecs((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} rows={2} className="flex-1 resize-none rounded-lg bg-surface-container-low px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-secondary" /><button type="button" onClick={() => setRascunhoRecs((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="mt-1.5 rounded-lg p-2 hover:bg-surface-container" aria-label="Remover recomendação"><Icon name="delete" className="text-[18px] text-on-surface-variant" /></button></div>)}</div></div><Btn variant="success" icon="check" onClick={salvarPublico} disabled={savingAction}>{savingAction ? "Salvando..." : "Publicar alterações"}</Btn></div>}
                </div>
              )}

              {tab === "ocorrencias" && (
                <div className="card-tonal p-7 shadow-ambient-sm">
                  <SectionHeader
                    overline="VINCULADAS AO EVENTO"
                    title="Ocorrências"
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        {ocorrenciasCarregadas && (
                          <Chip tone="primarySoft">{String(ocorrenciasEvento.length).padStart(2, "0")} OCORRÊNCIAS</Chip>
                        )}
                        <Btn variant="ghost" icon="refresh" onClick={atualizarOcorrencias} disabled={loadingOcorrenciasEvento}>
                          {ocorrenciasEventoError ? "Tentar novamente" : "Atualizar"}
                        </Btn>
                      </div>
                    }
                  />
                  {loadingOcorrenciasEvento ? (
                    <p className="text-[12px] text-on-surface-variant" role="status">Carregando ocorrências...</p>
                  ) : ocorrenciasEventoError ? (
                    <p role="alert" className="rounded-lg bg-error-container p-3 text-[12px] font-semibold text-error">
                      {ocorrenciasEventoError}
                    </p>
                  ) : !ocorrenciasCarregadas ? (
                    <p className="text-[12px] text-on-surface-variant">Carregando ocorrências...</p>
                  ) : ocorrenciasEvento.length > 0 ? (
                    <div className={ocorrenciaSelecionada ? "grid gap-5 lg:grid-cols-2" : ""}>
                      <div className="space-y-2">
                        {ocorrenciasEvento.map((item) => {
                          const meta = getOccurrenceStatusMeta(item.status);
                          const ativo = item.id === ocorrenciaSelecionadaId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-expanded={ativo}
                              onClick={() => setOcorrenciaSelecionadaId(ativo ? null : item.id)}
                              className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition ${ativo ? "bg-primary/8 ring-1 ring-primary/30" : "bg-surface-container-low hover:bg-surface-container-higher"}`}
                            >
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-bold text-primary">
                                  {formatOccurrenceTitle(item.titulo ?? "") || `Ocorrência #${item.id}`}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-on-surface-variant">
                                  #{item.id} · {item.categoria ? OCCURRENCE_CATEGORY_LABEL[item.categoria] ?? item.categoria : "Sem categoria"} · {meta.label}
                                </span>
                                <span className="mt-1 block font-mono text-[10px] text-slate-400">
                                  {formatTimelineDate(item.created_at ?? "")}
                                </span>
                              </span>
                              <Icon name="chevron_right" className="mt-1 text-[16px] text-on-surface-variant" />
                            </button>
                          );
                        })}
                      </div>
                      {ocorrenciaSelecionada && <OcorrenciaDetalhePanel ocorrencia={ocorrenciaSelecionada} />}
                    </div>
                  ) : (
                    <p className="text-[12px] italic text-on-surface-variant">Nenhuma ocorrência vinculada a este evento.</p>
                  )}
                  {ocorrenciasCarregadas && ocorrenciasEvento.length >= OCORRENCIAS_POR_PAGINA && (
                    <p className="mt-4 text-[11px] italic text-on-surface-variant">
                      Lista limitada a {OCORRENCIAS_POR_PAGINA} ocorrências deste evento. Use a página de ocorrências para ver todas.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && <EventFormModal open onClose={() => setShowCreateModal(false)} onSaved={fetchData} />}
      {showEditModal && evento && <EventFormModal open onClose={() => setShowEditModal(false)} onSaved={fetchData} evento={evento} />}
      {showDeleteModal && evento && (
        <DeleteEventModal
          open
          evento={evento}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            setSelectedId(null);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
