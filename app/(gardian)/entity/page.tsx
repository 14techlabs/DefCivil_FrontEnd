"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot, Tab } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { api } from "@/app/services/Api";
import {
  APOIO_TIPOS,
  PontoApoioFormModal,
  type Apoio,
} from "@/app/components/PontoApoioFormModal";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { PlanContingenciaEditor } from "@/app/components/PlanContingenciaEditor";
import {
  STATUS_CIDADE_META,
  formatBRL,
  type ContaEvento,
  type StatusCidade,
} from "@/app/data/mock";

interface EntityApiData {
  id: number;
  nome: string;
  cep: string;
  cnpj: string;
  uf: string | null;
  status: number | null;
  sigla: string;
  telefone: string;
  email: string;
  endereco: string;
  mensagem_publica: string;
  responsavel: number | null;
  responsavel_nome: string | null;
  cargo_responsavel: string | null;
  status_label: string | null;
  status_slug: StatusCidade | null;
  status_historico: EntityStatusHistory[];
}

interface EntityStatusHistory {
  id: number;
  status: number;
  status_label: string;
  status_slug: StatusCidade;
  motivo: string;
  autor: string | null;
  criado_em: string;
}

interface ChecklistApiItem {
  id: number;
  label: string;
  icon: string;
  ativo: boolean;
  fixo: boolean;
  ordem: number;
}

interface EventoFinanceiro {
  id: number;
  nome: string;
  tipo: string;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

interface OcorrenciaFinanceira {
  id: number;
  evento: number | null;
  familia: number | null;
}

interface PrestacaoApi {
  id: number;
  evento: number;
  evento_nome: string;
  evento_status: string | null;
  exercicio: number;
  decreto_municipal: string;
  fonte_recurso: "proprio" | "estadual" | "federal" | "outro";
  fonte_label: string;
  repasse_recebido: string;
  prazo_limite: string | null;
  status_prestacao: "em_curso" | "em_elaboracao" | "enviada" | "aprovada";
  status_label: string;
  observacao: string;
  custo: string;
  custo_consolidado: string | null;
  parcial: boolean;
}

type ContaEventoView = ContaEvento & {
  custoAtual: number;
  parcial: boolean;
  fonteLabel: string;
  statusLabel: string;
  prazoIso: string;
};

interface EntidadeDraft {
  sigla: string;
  telefone: string;
  email: string;
  endereco: string;
  responsavel: number | null;
}

interface UsuarioResponsavel {
  id: number;
  user_sys: { first_name: string; username: string } | null;
  nome_anonimo: string | null;
  telefone: string;
}

interface FormUiItem {
  id: string;
  label: string;
  icon: string;
  ativo: boolean;
  fixo?: boolean;
}

interface FormUiConfig {
  ativo: boolean;
  titulo: string;
  subtitulo: string;
  telefonesEmergencia: string;
  mensagemDesativado: string;
  exigirLocalizacao: boolean;
  permitirAnexos: boolean;
  exigirContato: boolean;
  mostrarAvisoEvento: boolean;
  minCaracteresDescricao: number;
  categorias: FormUiItem[];
  checklist: FormUiItem[];
}

interface ConfigFormularioApi {
  ativo: boolean;
  titulo: string;
  subtitulo: string;
  telefones_emergencia: string;
  mensagem_desativado: string;
  exigir_localizacao: boolean;
  permitir_anexos: boolean;
  exigir_contato: boolean;
  mostrar_aviso_evento: boolean;
  min_caracteres_descricao: number;
  categorias: FormUiItem[];
}

interface PlanoZona {
  id: number;
  nome: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
  descricao: string;
}

interface PlanoEvento {
  id: number;
  nome: string;
  tipo: string;
  status: string | null;
  descricao: string;
  data_inicio: string | null;
  recomendacoes: string[];
  zonas: number[];
}

interface PlanoFamiliasResumo {
  total_familias: number;
  total_pessoas: number;
  total_animais: number;
  total_em_risco: number;
}

interface PlanoMonitoramento {
  id: number;
  status: "estavel" | "risco_moderado" | "risco_alto" | "critico";
  resumo: string;
  zona: number | null;
  created_at: string;
}

interface PlanoEquipeKpis {
  efetivo: number;
  em_campo: number;
  atendimentos_30d: number;
  zonas_cobertas: number;
}

const CENARIOS_CONTINGENCIA = [
  {
    icon: "landslide",
    titulo: "Deslizamentos e movimentos de massa",
    gatilho: "Chuva persistente, trincas, movimentação de solo ou alerta técnico.",
    resposta: "Vistoria, isolamento preventivo e retirada das famílias expostas.",
  },
  {
    icon: "flood",
    titulo: "Alagamentos e inundações",
    gatilho: "Elevação de rios, canais ou acúmulo crítico de água em área urbana.",
    resposta: "Monitoramento, bloqueio de vias e encaminhamento aos pontos de apoio.",
  },
  {
    icon: "local_fire_department",
    titulo: "Incêndios e emergências urbanas",
    gatilho: "Foco de incêndio com risco à população, estruturas ou vegetação.",
    resposta: "Acionamento dos bombeiros, isolamento e apoio à evacuação.",
  },
];

const NIVEIS_CONTINGENCIA = [
  { nivel: "Observação", tone: "neutral" as const, descricao: "Monitorar indicadores e manter equipes informadas." },
  { nivel: "Atenção", tone: "warning" as const, descricao: "Mobilizar responsáveis e preparar recursos prioritários." },
  { nivel: "Alerta", tone: "error" as const, descricao: "Ativar resposta, comunicar a população e proteger áreas expostas." },
];

const PROTOCOLOS_CONTINGENCIA = [
  "Confirmar o cenário, a área atingida e o nível de resposta.",
  "Acionar coordenação, equipes de campo e órgãos parceiros.",
  "Definir bloqueios, rotas seguras e necessidade de evacuação.",
  "Preparar pontos de apoio e registrar famílias encaminhadas.",
  "Emitir comunicação oficial e manter atualizações periódicas.",
  "Registrar decisões, recursos utilizados e encerramento da operação.",
];

const EMPTY_FORM_CONFIG: FormUiConfig = {
  ativo: false,
  titulo: "",
  subtitulo: "",
  telefonesEmergencia: "",
  mensagemDesativado: "",
  exigirLocalizacao: false,
  permitirAnexos: false,
  exigirContato: false,
  mostrarAvisoEvento: false,
  minCaracteresDescricao: 0,
  categorias: [],
  checklist: [],
};

function normalizeFormConfig(
  value: Partial<ConfigFormularioApi> | null | undefined,
  checklist: FormUiItem[],
): FormUiConfig {
  return {
    ativo: value?.ativo ?? EMPTY_FORM_CONFIG.ativo,
    titulo: value?.titulo ?? "",
    subtitulo: value?.subtitulo ?? "",
    telefonesEmergencia: value?.telefones_emergencia ?? "",
    mensagemDesativado: value?.mensagem_desativado ?? "",
    exigirLocalizacao: value?.exigir_localizacao ?? EMPTY_FORM_CONFIG.exigirLocalizacao,
    permitirAnexos: value?.permitir_anexos ?? EMPTY_FORM_CONFIG.permitirAnexos,
    exigirContato: value?.exigir_contato ?? EMPTY_FORM_CONFIG.exigirContato,
    mostrarAvisoEvento: value?.mostrar_aviso_evento ?? EMPTY_FORM_CONFIG.mostrarAvisoEvento,
    minCaracteresDescricao:
      value?.min_caracteres_descricao ?? EMPTY_FORM_CONFIG.minCaracteresDescricao,
    categorias: Array.isArray(value?.categorias) ? value.categorias : [],
    checklist,
  };
}

const STATUS_FROM_API: Record<number, StatusCidade> = {
  0: "estavel",
  1: "alerta",
  2: "critico",
};

const STATUS_TO_API: Record<StatusCidade, number> = {
  estavel: 0,
  alerta: 1,
  critico: 2,
};

const custoEvento = (conta: ContaEventoView): number => conta.custoAtual;

const PointsMap = dynamic(
  () => import("@/app/components/PointsMap").then((m) => m.PointsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-surface-container-low h-[440px]">
        <span className="text-xs text-on-surface-variant font-medium">carregando mapa…</span>
      </div>
    ),
  },
);

type EntityTab = "status" | "formulario" | "contas" | "plano" | "apoios";
const TAB_IDS: EntityTab[] = ["status", "formulario", "contas", "plano", "apoios"];

function EntityPageContent() {
  const { showToast, user } = useGardian();
  const entidadeId = user?.entidade;

  // link profundo vindo do ZoneDetail: /entity?tab=apoios&ponto=<id>
  const router = useRouter();
  const searchParams = useSearchParams();

  // aba vem da URL (?tab=), permitindo link profundo direto para Pontos de Apoio
  const tabParam = searchParams.get("tab");
  const tab: EntityTab = TAB_IDS.includes(tabParam as EntityTab) ? (tabParam as EntityTab) : "status";
  const [planoModo, setPlanoModo] = useState<"documento" | "operacional">("documento");
  const [entidade, setEntidade] = useState<EntityApiData | null>(null);
  const [entidadeLoading, setEntidadeLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistApiItem[]>([]);
  const [config, setConfig] = useState<FormUiConfig>(EMPTY_FORM_CONFIG);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [contasBackend, setContasBackend] = useState<ContaEventoView[]>([]);
  const [exercicio, setExercicio] = useState<number | "todos">("todos");
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaDraft, setFichaDraft] = useState<EntidadeDraft>({ sigla: "", telefone: "", email: "", endereco: "", responsavel: null });
  const [responsaveis, setResponsaveis] = useState<UsuarioResponsavel[]>([]);
  const [responsaveisLoading, setResponsaveisLoading] = useState(true);
  const [contasLoading, setContasLoading] = useState(false);
  const [contasCarregadas, setContasCarregadas] = useState(false);
  const [prestacaoEditando, setPrestacaoEditando] = useState<ContaEventoView | null>(null);

  // rascunho da mudança de status
  const [novoStatus, setNovoStatus] = useState<StatusCidade>("estavel");
  const [motivoStatus, setMotivoStatus] = useState("");
  const [mensagemPublica, setMensagemPublica] = useState("");

  // rascunho de novo item do checklist
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCheck, setNovoCheck] = useState("");

  // pontos de apoio
  const [pontos, setPontos] = useState<Apoio[]>([]);
  const [pontosLoading, setPontosLoading] = useState(false);
  const [pontosCarregados, setPontosCarregados] = useState(false);
  const [pontoFormOpen, setPontoFormOpen] = useState(false);
  const [pontoEditando, setPontoEditando] = useState<Apoio | null>(null);
  const [pontoExcluindo, setPontoExcluindo] = useState<Apoio | null>(null);
  const [pontoSelecionadoId, setPontoSelecionadoId] = useState<number | null>(null);
  // pedido de foco do mapa (a versão sobe a cada seleção nova)
  const [focoVersao, setFocoVersao] = useState(0);
  // id de ponto pedido pela URL (?ponto=) enquanto a lista ainda não carregou
  const pontoUrlRef = useRef<number | null>(null);
  const [planoLoading, setPlanoLoading] = useState(false);
  const [planoCarregado, setPlanoCarregado] = useState(false);
  const [planoZonas, setPlanoZonas] = useState<PlanoZona[]>([]);
  const [planoEventos, setPlanoEventos] = useState<PlanoEvento[]>([]);
  const [planoFamilias, setPlanoFamilias] = useState<PlanoFamiliasResumo>({
    total_familias: 0,
    total_pessoas: 0,
    total_animais: 0,
    total_em_risco: 0,
  });
  const [planoMonitoramentos, setPlanoMonitoramentos] = useState<PlanoMonitoramento[]>([]);
  const [planoEquipe, setPlanoEquipe] = useState<PlanoEquipeKpis | null>(null);

  const fetchEntidadeEChecklist = useCallback(async () => {
    if (!entidadeId) {
      if (user !== null) {
        setEntidadeLoading(false);
      }
      return;
    }
    setEntidadeLoading(true);
    const [entidadeResult, checklistResult, configResult] = await Promise.allSettled([
      api.get<EntityApiData>(`/entidades/${entidadeId}/`),
      api.get<ChecklistApiItem[]>("/entidades/checklist/"),
      api.get<ConfigFormularioApi>(`/entidades/${entidadeId}/config-formulario/`),
    ]);

    if (entidadeResult.status === "fulfilled") {
      const atual = entidadeResult.value.data;
      setEntidade(atual);
      setNovoStatus(atual.status == null ? "estavel" : STATUS_FROM_API[atual.status] ?? "estavel");
      setMensagemPublica(atual.mensagem_publica ?? "");
    } else {
      setEntidade(null);
    }
    const checklistItems =
      checklistResult.status === "fulfilled" ? checklistResult.value.data ?? [] : [];
    setChecklist(checklistItems);
    const configFormulario = configResult.status === "fulfilled"
      ? configResult.value.data
      : null;
    const checklistFormulario = checklistItems.map((item) => ({
      ...item,
      id: String(item.id),
    }));
    setConfig((current) => configFormulario
      ? normalizeFormConfig(configFormulario, checklistFormulario)
      : { ...current, checklist: checklistFormulario });
    setEntidadeLoading(false);
  }, [entidadeId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchEntidadeEChecklist(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchEntidadeEChecklist]);

  useEffect(() => {
    api.get<UsuarioResponsavel[]>("/usuarios/")
      .then((response) => setResponsaveis(response.data ?? []))
      .catch(() => setResponsaveis([]))
      .finally(() => setResponsaveisLoading(false));
  }, []);

  useEffect(() => {
    if (!entidadeId || tab !== "contas" || contasCarregadas) return;
    let cancelled = false;
    setContasLoading(true);
    Promise.allSettled([
      api.get<{ eventos: EventoFinanceiro[] }>("/eventos/"),
      api.get<{ ocorrencias: OcorrenciaFinanceira[] }>("/ocorrencias/"),
      api.get<{ prestacoes: PrestacaoApi[] }>("/eventos/prestacoes/"),
    ]).then(([eventoResult, ocorrenciaResult, prestacaoResult]) => {
      if (cancelled) return;
      setContasCarregadas(true);
      const eventos = eventoResult.status === "fulfilled" ? eventoResult.value.data.eventos ?? [] : [];
      const ocorrencias = ocorrenciaResult.status === "fulfilled" ? ocorrenciaResult.value.data.ocorrencias ?? [] : [];
      const prestacoes = prestacaoResult.status === "fulfilled"
        ? prestacaoResult.value.data.prestacoes ?? []
        : [];
      const eventosPorId = new Map(eventos.map((evento) => [evento.id, evento]));
      setContasBackend(
        prestacoes.map((prestacao) => {
          const evento = eventosPorId.get(prestacao.evento);
          const ocorrenciasEvento = ocorrencias.filter((item) => item.evento === prestacao.evento);
          const inicio = evento?.data_inicio ? new Date(`${evento.data_inicio}T00:00:00`) : null;
          const fim = evento?.data_fim ? new Date(`${evento.data_fim}T00:00:00`) : null;
          const formatarData = (data: Date | null) => data?.toLocaleDateString("pt-BR") ?? "Não informada";
          return {
            id: prestacao.id,
            eventoId: prestacao.evento,
            nome: prestacao.evento_nome,
            tipo: evento?.tipo ?? "—",
            periodo: `${formatarData(inicio)} — ${fim ? formatarData(fim) : prestacao.evento_status ?? "em curso"}`,
            exercicio: prestacao.exercicio,
            ocorrencias: ocorrenciasEvento.length,
            familiasAtingidas: new Set(
              ocorrenciasEvento.map((item) => item.familia).filter((id) => id != null),
            ).size,
            custoConsolidado: prestacao.custo_consolidado == null ? null : Number(prestacao.custo_consolidado),
            custoAtual: Number(prestacao.custo || 0),
            parcial: prestacao.parcial,
            decretoMunicipal: prestacao.decreto_municipal || null,
            fonteRecurso: prestacao.fonte_recurso,
            fonteLabel: prestacao.fonte_label,
            repasseRecebido: Number(prestacao.repasse_recebido || 0),
            statusPrestacao: prestacao.status_prestacao,
            statusLabel: prestacao.status_label,
            prazoLimite: prestacao.prazo_limite
              ? new Date(`${prestacao.prazo_limite}T00:00:00`).toLocaleDateString("pt-BR")
              : "—",
            prazoIso: prestacao.prazo_limite ?? "",
            observacao: prestacao.observacao,
          };
        }),
      );
    }).catch(() => {
      if (!cancelled) setContasCarregadas(true);
    }).finally(() => {
      if (!cancelled) setContasLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entidadeId, tab, contasCarregadas]);

  /* ── pontos de apoio ── */

  const fetchPontos = useCallback(() => {
    let cancelled = false;
    setPontosLoading(true);
    api
      .get<Apoio[]>("/apoios/")
      .then((res) => {
        if (!cancelled) {
          setPontos(res.data);
          setPontosCarregados(true);
        }
        // link profundo: seleciona e foca o ponto pedido pela URL ao fim do carregamento
        const idPendente = pontoUrlRef.current;
        if (idPendente != null && !cancelled) {
          pontoUrlRef.current = null;
          const alvo = res.data.find((p) => p.id === idPendente);
          if (alvo) {
            setPontoSelecionadoId(alvo.id);
            setFocoVersao((v) => v + 1);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPontos([]);
          setPontosCarregados(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPontosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if ((tab !== "apoios" && tab !== "plano") || pontosCarregados) return;
    const timer = window.setTimeout(() => fetchPontos(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchPontos, tab, pontosCarregados]);

  useEffect(() => {
    if (!entidadeId || tab !== "plano" || planoCarregado) return;
    let cancelled = false;
    setPlanoLoading(true);
    Promise.allSettled([
      api.get<PlanoZona[] | { zonas: PlanoZona[] }>("/zonas/", { params: { cards: "1" } }),
      api.get<PlanoEvento[] | { eventos: PlanoEvento[] }>("/eventos/"),
      api.get<PlanoFamiliasResumo & { familias: unknown[] }>("/familias/"),
      api.get<PlanoMonitoramento[] | { monitoramentos: PlanoMonitoramento[] }>("/monitoramentos/"),
      api.get<{ kpis: PlanoEquipeKpis }>("/equipe/panorama/"),
    ]).then(([zonasResult, eventosResult, familiasResult, monitoramentosResult, equipeResult]) => {
      if (cancelled) return;
      setPlanoCarregado(true);
      if (zonasResult.status === "fulfilled") {
        const data = zonasResult.value.data;
        setPlanoZonas(Array.isArray(data) ? data : data.zonas ?? []);
      }
      if (eventosResult.status === "fulfilled") {
        const data = eventosResult.value.data;
        setPlanoEventos(Array.isArray(data) ? data : data.eventos ?? []);
      }
      if (familiasResult.status === "fulfilled") {
        const data = familiasResult.value.data;
        setPlanoFamilias({
          total_familias: data.total_familias ?? 0,
          total_pessoas: data.total_pessoas ?? 0,
          total_animais: data.total_animais ?? 0,
          total_em_risco: data.total_em_risco ?? 0,
        });
      }
      if (monitoramentosResult.status === "fulfilled") {
        const data = monitoramentosResult.value.data;
        setPlanoMonitoramentos(Array.isArray(data) ? data : data.monitoramentos ?? []);
      }
      if (equipeResult.status === "fulfilled") {
        setPlanoEquipe(equipeResult.value.data.kpis);
      }
    }).catch(() => {
      if (!cancelled) setPlanoCarregado(true);
    }).finally(() => {
      if (!cancelled) setPlanoLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entidadeId, tab, planoCarregado]);

  const excluirPonto = async (ponto: Apoio) => {
    try {
      await api.delete(`/apoios/${ponto.id}/`);
      setPontos((prev) => prev.filter((p) => p.id !== ponto.id));
      if (pontoSelecionadoId === ponto.id) {
        setPontoSelecionadoId(null);
        router.replace("?tab=apoios", { scroll: false });
      }
      showToast("Ponto de apoio excluído.");
    } catch {
      showToast("Erro ao excluir ponto de apoio.", "error");
    } finally {
      setPontoExcluindo(null);
    }
  };

  /* ── seleção de ponto de apoio (lista ↔ mapa) ── */

  const pontoSelecionado = useMemo(
    () => pontos.find((p) => p.id === pontoSelecionadoId) ?? null,
    [pontos, pontoSelecionadoId],
  );

  // pontos prontos para o mapa (identidade estável: não refaz/refoca a cada render)
  const pontosParaMapa = useMemo(
    () =>
      pontos
        .filter((p) => p.coordenadas)
        .map((p) => ({
          id: p.id,
          lat: p.coordenadas!.lat,
          lng: p.coordenadas!.lng,
          titulo: p.nome,
          subtitulo: p.endereco || undefined,
          kind: "ponto_apoio" as const,
        })),
    [pontos],
  );

  const selecionarPonto = useCallback(
    (id: number) => {
      setPontoSelecionadoId(id);
      setFocoVersao((v) => v + 1);
      router.replace(`?tab=apoios&ponto=${id}`, { scroll: false });
    },
    [router],
  );

  const fecharPonto = useCallback(() => {
    setPontoSelecionadoId(null);
    router.replace("?tab=apoios", { scroll: false });
  }, [router]);

  // trocar de aba mantendo a URL coerente (a aba vem da URL, então ela precisa mudar)
  const trocarTab = (proxima: EntityTab) => {
    if (proxima === tab) {
      // clique na aba atual de apoios fecha o detalhe aberto
      if (proxima === "apoios" && pontoSelecionado) {
        setPontoSelecionadoId(null);
        router.replace("?tab=apoios", { scroll: false });
      }
      return;
    }
    if (proxima !== "apoios") setPontoSelecionadoId(null);
    router.replace(`?tab=${proxima}`, { scroll: false });
  };

  // link profundo do ZoneDetail (?tab=apoios&ponto=<id>): guarda o ponto pedido
  useEffect(() => {
    const idParam = Number(searchParams.get("ponto"));
    if (Number.isFinite(idParam) && idParam > 0) pontoUrlRef.current = idParam;
    // roda só na montagem; a aba vem da URL e o ponto é aplicado ao carregar a lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── status da cidade ── */

  const aplicarStatus = async () => {
    if (!entidade) return;
    const statusAtual = entidade.status == null ? null : STATUS_FROM_API[entidade.status] ?? null;
    const statusMudou = novoStatus !== statusAtual;
    const mensagemMudou = mensagemPublica !== entidade.mensagem_publica;
    if (!statusMudou && !mensagemMudou) {
      showToast("Nenhuma alteração para aplicar.", "error");
      return;
    }
    if (statusMudou && !motivoStatus.trim()) {
      showToast("Informe o motivo da mudança de status.", "error");
      return;
    }
    try {
      const response = await api.post<EntityApiData>(`/entidades/${entidade.id}/status/`, {
        status: STATUS_TO_API[novoStatus],
        motivo: motivoStatus.trim(),
        mensagem_publica: mensagemPublica,
      });
      setEntidade(response.data);
      setMotivoStatus("");
      showToast(statusMudou
        ? `Município marcado como ${STATUS_CIDADE_META[novoStatus].label.toLowerCase()}.`
        : "Mensagem pública atualizada.");
    } catch {
      showToast("Não foi possível atualizar o status da entidade.", "error");
    }
  };

  const abrirEdicaoFicha = () => {
    if (!entidade) return;
    setFichaDraft({
      sigla: entidade.sigla ?? "",
      telefone: entidade.telefone ?? "",
      email: entidade.email ?? "",
      endereco: entidade.endereco ?? "",
      responsavel: entidade.responsavel,
    });
    setEditandoFicha(true);
  };

  const salvarFicha = async () => {
    if (!entidade) return;
    try {
      const response = await api.patch<EntityApiData>(`/entidades/${entidade.id}/`, fichaDraft);
      setEntidade(response.data);
      setEditandoFicha(false);
      showToast("Ficha da entidade atualizada.");
    } catch {
      showToast("Não foi possível atualizar a ficha da entidade.", "error");
    }
  };

  const salvarPrestacao = async () => {
    if (!prestacaoEditando) return;
    try {
      const response = await api.patch<PrestacaoApi>(`/eventos/prestacoes/${prestacaoEditando.id}/`, {
        decreto_municipal: prestacaoEditando.decretoMunicipal ?? "",
        fonte_recurso: prestacaoEditando.fonteRecurso,
        repasse_recebido: prestacaoEditando.repasseRecebido,
        prazo_limite: prestacaoEditando.prazoIso || null,
        status_prestacao: prestacaoEditando.statusPrestacao,
        observacao: prestacaoEditando.observacao,
      });
      const atualizada = response.data;
      setContasBackend((atuais) => atuais.map((conta) => conta.id === atualizada.id ? {
        ...conta,
        decretoMunicipal: atualizada.decreto_municipal || null,
        fonteRecurso: atualizada.fonte_recurso,
        fonteLabel: atualizada.fonte_label,
        repasseRecebido: Number(atualizada.repasse_recebido || 0),
        prazoIso: atualizada.prazo_limite ?? "",
        prazoLimite: atualizada.prazo_limite
          ? new Date(`${atualizada.prazo_limite}T00:00:00`).toLocaleDateString("pt-BR")
          : "—",
        statusPrestacao: atualizada.status_prestacao,
        statusLabel: atualizada.status_label,
        observacao: atualizada.observacao,
      } : conta));
      setPrestacaoEditando(null);
      showToast("Prestação de contas atualizada.");
    } catch {
      showToast("Não foi possível atualizar a prestação de contas.", "error");
    }
  };

  /* ── formulário público ── */

  const salvarConfigFormulario = async () => {
    if (!entidadeId) return;
    setSalvandoConfig(true);
    try {
      const payload: ConfigFormularioApi = {
        ativo: config.ativo,
        titulo: config.titulo,
        subtitulo: config.subtitulo,
        telefones_emergencia: config.telefonesEmergencia,
        mensagem_desativado: config.mensagemDesativado,
        exigir_localizacao: config.exigirLocalizacao,
        permitir_anexos: config.permitirAnexos,
        exigir_contato: config.exigirContato,
        mostrar_aviso_evento: config.mostrarAvisoEvento,
        min_caracteres_descricao: config.minCaracteresDescricao,
        categorias: config.categorias,
      };
      const response = await api.patch<ConfigFormularioApi>(
        `/entidades/${entidadeId}/config-formulario/`,
        payload,
      );
      setConfig((current) => normalizeFormConfig(response.data, current.checklist));
      showToast("Configurações do formulário atualizadas.");
    } catch {
      showToast("Não foi possível atualizar as configurações do formulário.", "error");
    } finally {
      setSalvandoConfig(false);
    }
  };

  const toggleChecklist = async (item: ChecklistApiItem) => {
    try {
      const response = await api.patch<ChecklistApiItem>(`/entidades/checklist/${item.id}/`, {
        ativo: !item.ativo,
      });
      setChecklist((current) =>
        current.map((currentItem) => currentItem.id === item.id ? response.data : currentItem),
      );
      setConfig((current) => ({
        ...current,
        checklist: current.checklist.map((currentItem) =>
          currentItem.id === String(item.id)
            ? { ...response.data, id: String(response.data.id) }
            : currentItem,
        ),
      }));
    } catch {
      showToast("Não foi possível atualizar o item.", "error");
    }
  };

  const removerChecklist = async (item: ChecklistApiItem) => {
    try {
      const response = await api.delete<{ item: ChecklistApiItem }>(
        `/entidades/checklist/${item.id}/`,
      );
      setChecklist((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? response.data.item : currentItem,
        ),
      );
      setConfig((current) => ({
        ...current,
        checklist: current.checklist.map((currentItem) =>
          currentItem.id === String(item.id)
            ? { ...response.data.item, id: String(response.data.item.id) }
            : currentItem,
        ),
      }));
    } catch {
      showToast("Não foi possível remover o item.", "error");
    }
  };

  const adicionarChecklist = async () => {
    const label = novoCheck.trim();
    if (!label) {
      showToast("Escreva o texto do item antes de adicionar.", "error");
      return;
    }
    try {
      const response = await api.post<ChecklistApiItem>("/entidades/checklist/", {
        label,
        icon: "check_circle",
        ativo: true,
        fixo: false,
        ordem: checklist.length,
      });
      setChecklist((current) => [...current, response.data]);
      setConfig((current) => ({
        ...current,
        checklist: [...current.checklist, { ...response.data, id: String(response.data.id) }],
      }));
      setNovoCheck("");
      showToast("Item adicionado ao formulário público.");
    } catch {
      showToast("Não foi possível adicionar o item.", "error");
    }
  };

  const toggleCampo = (grupo: "categorias" | "checklist", id: string) => {
    if (grupo === "categorias") {
      setConfig((current) => ({
        ...current,
        categorias: current.categorias.map((item) =>
          item.id === id ? { ...item, ativo: !item.ativo } : item,
        ),
      }));
      return;
    }
    const item = checklist.find((current) => current.id === Number(id));
    if (item) void toggleChecklist(item);
  };

  const removerCampo = (grupo: "categorias" | "checklist", id: string) => {
    if (grupo === "categorias") {
      setConfig((current) => ({
        ...current,
        categorias: current.categorias.map((item) =>
          item.id === id ? { ...item, ativo: false } : item,
        ),
      }));
      return;
    }
    const item = checklist.find((current) => current.id === Number(id));
    if (item) void removerChecklist(item);
  };

  const adicionarCampo = (grupo: "categorias" | "checklist") => {
    if (grupo === "categorias") {
      showToast("Escolha entre as categorias disponíveis.", "error");
      return;
    }
    void adicionarChecklist();
  };

  /* ── prestação de contas ── */

  const contas = useMemo(
    () =>
      exercicio === "todos"
        ? contasBackend
        : contasBackend.filter((c) => c.exercicio === exercicio),
    [contasBackend, exercicio],
  );

  const totais = useMemo(() => {
    const custo = contas.reduce((a, c) => a + custoEvento(c), 0);
    const repasse = contas.reduce((a, c) => a + c.repasseRecebido, 0);
    const ocorrencias = contas.reduce((a, c) => a + c.ocorrencias, 0);
    const familias = contas.reduce((a, c) => a + c.familiasAtingidas, 0);
    const pendentes = contas.filter((c) => c.statusPrestacao !== "aprovada").length;
    return {
      custo,
      repasse,
      proprio: custo - repasse,
      ocorrencias,
      familias,
      pendentes,
      medioPorOcorrencia: ocorrencias ? custo / ocorrencias : 0,
    };
  }, [contas]);

  const exercicios = useMemo(
    () => [...new Set(contasBackend.map((c) => c.exercicio))].sort((a, b) => b - a),
    [contasBackend],
  );

  if (entidadeLoading) {
    return <DataLoading />;
  }

  if (!entidade) {
    return <div className="p-8 text-sm text-error">Não foi possível carregar a entidade.</div>;
  }

  const statusCidade = entidade.status == null ? null : STATUS_FROM_API[entidade.status] ?? null;
  const statusMeta = statusCidade
    ? STATUS_CIDADE_META[statusCidade]
    : { label: "Não informado", cor: "#64748B", tone: "neutral" as const };
  const categoriasAtivas = config.categorias.filter((item) => item.ativo).length;
  const checksAtivos = checklist.filter((item) => item.ativo).length;
  const zonasPrioritarias = planoZonas.filter((zona) => zona.status !== "estavel");
  const eventosAtivos = planoEventos.filter((evento) => {
    const status = (evento.status ?? "").toLocaleLowerCase("pt-BR");
    return !["encerrado", "concluido", "concluído", "finalizado", "inativo"].includes(status);
  });
  const monitoramentosPrioritarios = planoMonitoramentos.filter(
    (item) => item.status === "risco_alto" || item.status === "critico",
  );

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* ── Cabeçalho ── */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ENTIDADE · #{entidade.id}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>CNPJ {entidade.cnpj}</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Gerenciamento da Entidade
          </h1>
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg card-tonal shadow-ambient-sm">
            <StatusDot tone={statusMeta.tone} />
            <div>
              <MetaTag className="block">STATUS DO MUNICÍPIO</MetaTag>
              <p className="text-[13px] font-black tracking-tight" style={{ color: statusMeta.cor }}>
                {statusMeta.label}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Ficha da entidade ── */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader
          overline="DADOS CADASTRAIS"
          title={entidade.nome}
          action={
            <div className="flex items-center gap-2">
              <Chip tone="primarySoft" icon="location_city">
                {entidade.nome}/{entidade.uf ?? "—"} · população —
              </Chip>
              <Btn variant="secondary" icon="edit" onClick={abrirEdicaoFicha}>Editar ficha</Btn>
            </div>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: "short_text", l: "Sigla", v: entidade.sigla || "—" },
            { icon: "supervisor_account", l: "Responsável", v: entidade.responsavel_nome || "—" },
            { icon: "work", l: "Cargo do responsável", v: entidade.cargo_responsavel || "—" },
            { icon: "call", l: "Telefone", v: entidade.telefone || "—" },
            { icon: "mail", l: "E-mail", v: entidade.email || "—" },
            { icon: "home_pin", l: "Endereço", v: entidade.endereco || "—" },
            { icon: "location_on", l: "UF", v: entidade.uf || "Não informada" },
            { icon: "markunread_mailbox", l: "CEP", v: entidade.cep || "Não informado" },
            { icon: "badge", l: "CNPJ", v: entidade.cnpj },
            { icon: "emergency_home", l: "Status", v: statusMeta.label },
          ].map((it, i) => (
            <div key={i} className="card-recessed p-4 flex items-start gap-3">
              <Icon name={it.icon} className="text-secondary text-[18px] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <MetaTag className="block">{it.l.toUpperCase()}</MetaTag>
                <p className="text-[12px] font-bold text-primary leading-snug">{it.v}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Abas ── */}
      <div className="flex flex-wrap gap-2">
        <Tab active={tab === "status"} onClick={() => trocarTab("status")} icon="emergency_home">
          Status do Município
        </Tab>
        <Tab active={tab === "formulario"} onClick={() => trocarTab("formulario")} icon="dynamic_form">
          Formulário Externo
        </Tab>
        <Tab active={tab === "contas"} onClick={() => trocarTab("contas")} icon="account_balance">
          Prestação de Contas
        </Tab>
        <Tab active={tab === "plano"} onClick={() => trocarTab("plano")} icon="assignment">
          Plano de Contingência
        </Tab>
        <Tab active={tab === "apoios"} onClick={() => trocarTab("apoios")} icon="home_work">
          Pontos de Apoio
        </Tab>
      </div>

      {/* ─────────── STATUS DO MUNICÍPIO ─────────── */}
      {tab === "status" && (
        <div className="grid grid-cols-12 gap-5 items-start">
          <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
            <SectionHeader
              overline="DEFINIÇÃO OPERACIONAL"
              title="Status da Cidade"
            />
            <p className="text-[12px] text-on-surface-variant -mt-3 mb-6 max-w-2xl">
              O status define o regime operacional cadastrado para a entidade.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {(Object.keys(STATUS_CIDADE_META) as StatusCidade[]).map((k) => {
                const meta = STATUS_CIDADE_META[k];
                const selecionado = novoStatus === k;
                const atual = statusCidade === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setNovoStatus(k)}
                    className={`p-5 rounded-xl text-left transition-all ${selecionado ? "text-white shadow-ambient" : "card-recessed hover:shadow-ambient-sm"
                      }`}
                    style={selecionado ? { background: meta.cor } : undefined}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon
                        name={meta.icon}
                        filled
                        className="text-[26px]"
                        style={{ color: selecionado ? "#fff" : meta.cor }}
                      />
                      {atual && (
                        <span
                          className={`text-[9px] font-black uppercase tracking-mono px-2 py-1 rounded ${selecionado ? "bg-white/20 text-white" : "bg-surface-container text-on-surface-variant"
                            }`}
                        >
                          ATUAL
                        </span>
                      )}
                    </div>
                    <p
                      className="font-headline font-black text-xl tracking-tighter"
                      style={{ color: selecionado ? "#fff" : meta.cor }}
                    >
                      {meta.label}
                    </p>
                    <p
                      className={`text-[11px] leading-relaxed mt-1.5 ${selecionado ? "text-white/80" : "text-on-surface-variant"
                        }`}
                    >
                      {meta.descricao}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <Btn variant="primary" icon="publish" onClick={() => void aplicarStatus()}>
                Aplicar status
              </Btn>
              <Btn
                variant="ghost"
                icon="undo"
                onClick={() => {
                  setNovoStatus(statusCidade ?? "estavel");
                }}
              >
                Descartar alterações
              </Btn>
            </div>

            {novoStatus !== statusCidade && (
              <div className="mt-5">
                <MetaTag className="mb-1.5 block">MOTIVO DA MUDANÇA</MetaTag>
                <textarea
                  value={motivoStatus}
                  onChange={(event) => setMotivoStatus(event.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo da mudança de status"
                  className="w-full resize-none rounded-lg bg-white px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
            )}

            <div className="mt-5">
              <MetaTag className="mb-1.5 block">MENSAGEM EXIBIDA NO CANAL PÚBLICO</MetaTag>
              <textarea
                value={mensagemPublica}
                onChange={(event) => setMensagemPublica(event.target.value)}
                placeholder="Nenhuma mensagem cadastrada"
                rows={3}
                className="w-full resize-none rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface-variant"
              />
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-5 space-y-5">
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="RASTREABILIDADE" title="Histórico de Status" />
              {entidade.status_historico.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-on-surface-variant">
                  Nenhuma alteração de status foi registrada até o momento.
                </p>
              ) : (
                <div className="space-y-3">
                  {entidade.status_historico.map((registro) => (
                    <div key={registro.id} className="card-recessed p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Chip tone={STATUS_CIDADE_META[registro.status_slug]?.tone ?? "neutral"}>
                          {registro.status_label}
                        </Chip>
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          {new Date(registro.criado_em).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-primary">{registro.motivo}</p>
                      <p className="mt-1 text-[10px] text-on-surface-variant">
                        {registro.autor || "Autor não identificado"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ─────────── FORMULÁRIO EXTERNO ─────────── */}
      {tab === "formulario" && (
        <div className="space-y-5">
          {/* estado do canal */}
          <section className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <SectionHeader
                  overline="CANAL PÚBLICO DE OCORRÊNCIAS"
                  title="Formulário Externo"
                />
                <p className="text-[12px] text-on-surface-variant -mt-3 max-w-2xl">
                  Configure as informações apresentadas à população durante o registro de uma ocorrência.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-secondary">
                  <Icon name="sync" className="text-[15px]" />
                  As alterações do checklist são aplicadas automaticamente.
                </p>
              </div>

              <div className="card-recessed p-5 min-w-[260px]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-mono-tight text-primary">Canal público</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 max-w-[170px]">
                      {config.ativo ? "Disponível para novos registros." : "Novos registros estão pausados."}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Ativar ou desativar o formulário"
                    onClick={() => setConfig((current) => ({ ...current, ativo: !current.ativo }))}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${config.ativo ? "bg-secondary" : "bg-slate-300"
                      }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${config.ativo ? "left-6" : "left-1"
                        }`}
                    />
                  </button>
                </div>
                <div className="flex gap-2 mt-4">
                  <Btn variant="ghost" icon="open_in_new" onClick={() => window.open("/report", "_blank")}>
                    Abrir
                  </Btn>
                  <Btn
                    variant="ghost"
                    icon="link"
                    onClick={() => {
                      const url =
                        typeof window !== "undefined" ? `${window.location.origin}/report` : "/report";
                      navigator.clipboard?.writeText(url);
                      showToast("Link do formulário copiado.");
                    }}
                  >
                    Copiar link
                  </Btn>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            {/* textos do formulário */}
            <section>
              <div className="card-tonal p-7 shadow-ambient-sm">
                <SectionHeader overline="APRESENTAÇÃO" title="Textos do Formulário" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <MetaTag className="block mb-1.5">TÍTULO</MetaTag>
                    <input
                      value={config.titulo}
                      onChange={(event) => setConfig((current) => ({ ...current, titulo: event.target.value }))}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">SUBTÍTULO</MetaTag>
                    <textarea
                      value={config.subtitulo}
                      onChange={(event) => setConfig((current) => ({ ...current, subtitulo: event.target.value }))}
                      rows={2}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">TELEFONES DE EMERGÊNCIA</MetaTag>
                    <input
                      value={config.telefonesEmergencia}
                      onChange={(event) => setConfig((current) => ({ ...current, telefonesEmergencia: event.target.value }))}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">MENSAGEM QUANDO DESATIVADO</MetaTag>
                    <textarea
                      value={config.mensagemDesativado}
                      onChange={(event) => setConfig((current) => ({ ...current, mensagemDesativado: event.target.value }))}
                      rows={2}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* categorias e checklist */}
            <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              {(
                [
                  {
                    grupo: "categorias" as const,
                    overline: "PASSO 1 DO FORMULÁRIO",
                    titulo: "Categorias de Ocorrência",
                    ajuda: "Tipos que o cidadão pode escolher ao abrir o registro.",
                    valor: novaCategoria,
                    setValor: setNovaCategoria,
                    placeholder: "Ex.: Queda de árvore",
                    ativos: categoriasAtivas,
                  },
                  {
                    grupo: "checklist" as const,
                    overline: "PASSO 3 DO FORMULÁRIO",
                    titulo: "Itens do Checklist",
                    ajuda: "Marcações rápidas que ajudam a definir a prioridade do atendimento.",
                    valor: novoCheck,
                    setValor: setNovoCheck,
                    placeholder: "Ex.: Há pessoas ilhadas",
                    ativos: checksAtivos,
                  },
                ]
              ).map((sec) => (
                <div key={sec.grupo} className="card-tonal h-full p-7 shadow-ambient-sm">
                  <SectionHeader
                    overline={sec.overline}
                    title={sec.titulo}
                    action={
                      <Chip tone="primarySoft">
                        {sec.ativos}/{config[sec.grupo].length} ATIVOS
                      </Chip>
                    }
                  />
                  <p className="text-[12px] text-on-surface-variant -mt-3 mb-5">{sec.ajuda}</p>

                  <div className="space-y-2 mb-4">
                    {config[sec.grupo].map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3.5 rounded-lg transition-all ${item.ativo ? "bg-surface-container-low" : "bg-surface-container-low opacity-50"
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCampo(sec.grupo, item.id)}
                          aria-label="Ativar ou desativar item"
                          className="shrink-0"
                        >
                          <Icon
                            name={item.ativo ? "toggle_on" : "toggle_off"}
                            filled
                            className={`text-[24px] ${item.ativo ? "text-secondary" : "text-slate-300"}`}
                          />
                        </button>
                        <Icon name={item.icon} className="text-on-surface-variant text-[18px] shrink-0" />
                        <span className="text-[12px] font-bold text-primary flex-1 min-w-0">
                          {item.label}
                        </span>
                        {item.fixo ? (
                          <Chip tone="neutral">OBRIGATÓRIO</Chip>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removerCampo(sec.grupo, item.id)}
                            className="p-1.5 rounded-md hover:bg-surface-container transition-all"
                            aria-label="Remover item"
                          >
                            <Icon name="delete" className="text-on-surface-variant text-[18px]" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {sec.grupo === "checklist" && <div className="flex gap-2">
                    <input
                      value={sec.valor}
                      onChange={(e) => sec.setValor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") adicionarCampo(sec.grupo);
                      }}
                      placeholder={sec.placeholder}
                      className="flex-1 bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                    <Btn variant="secondary" icon="add" onClick={() => adicionarCampo(sec.grupo)}>
                      Adicionar
                    </Btn>
                  </div>}
                </div>
              ))}

              <div className="flex justify-end gap-3 xl:col-span-2">
                <Btn
                  variant="primary"
                  icon="cloud_done"
                  onClick={() => void salvarConfigFormulario()}
                  disabled={salvandoConfig}
                >
                  {salvandoConfig ? "Salvando…" : "Salvar configurações"}
                </Btn>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ─────────── PRESTAÇÃO DE CONTAS ─────────── */}
      {tab === "contas" && (
        !contasCarregadas || contasLoading ? (
          <div className="flex flex-col items-center justify-center p-12 card-tonal shadow-ambient-sm">
            <Icon name="progress_activity" className="animate-spin text-[28px] text-secondary mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">Carregando prestação de contas…</p>
          </div>
        ) : (
          <div className="space-y-6">
          {/* filtro por exercício */}
          <div className="flex flex-wrap items-center gap-2">
            <MetaTag className="mr-1">EXERCÍCIO</MetaTag>
            <button
              type="button"
              onClick={() => setExercicio("todos")}
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${exercicio === "todos"
                  ? "bg-primary text-white shadow-ambient-sm"
                  : "bg-surface-container-high text-on-surface-variant"
                }`}
            >
              Todos
            </button>
            {exercicios.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setExercicio(ex)}
                className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${exercicio === ex
                    ? "bg-primary text-white shadow-ambient-sm"
                    : "bg-surface-container-high text-on-surface-variant"
                  }`}
              >
                {ex}
              </button>
            ))}
            <div className="flex-1" />
            <Btn
              variant="primary"
              icon="download"
              disabled
            >
              Exportação indisponível
            </Btn>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <KPI
              label="Custo Total"
              value={formatBRL(totais.custo)}
              icon="payments"
              tone="error"
              sub={`${contas.length} eventos no período`}
            />
            <KPI
              label="Ocorrências"
              value={totais.ocorrencias}
              icon="emergency"
              tone="secondary"
              sub="Vinculadas aos eventos"
            />
            <KPI
              label="Famílias Atingidas"
              value={totais.familias}
              icon="family_restroom"
              tone="warning"
              sub="Famílias únicas vinculadas"
            />
            <KPI
              label="Eventos"
              value={contas.length}
              icon="cyclone"
              tone="secondary"
              sub="No período selecionado"
            />
          </div>

          {/* comparativo de custo por evento */}
          <section className="card-tonal p-7 shadow-ambient-sm">
            <SectionHeader
              overline="PANORAMA FINANCEIRO"
              title="Custo por Evento"
              action={
                <div className="text-right">
                  <p className="font-headline font-black text-xl text-primary tracking-tighter">
                    {formatBRL(totais.medioPorOcorrencia)}
                  </p>
                  <MetaTag>CUSTO MÉDIO POR OCORRÊNCIA</MetaTag>
                </div>
              }
            />
            <div className="space-y-4">
              {[...contas]
                .sort((a, b) => custoEvento(b) - custoEvento(a))
                .map((c) => {
                  const custo = custoEvento(c);
                  const maior = Math.max(...contas.map(custoEvento), 1);
                  return (
                    <div key={c.id} className="grid grid-cols-[1fr_auto] gap-4 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <p className="text-[13px] font-bold text-primary truncate">{c.nome}</p>
                          <MetaTag>{c.periodo}</MetaTag>
                        </div>
                        <div className="relative h-3 rounded-full bg-surface-container-high overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-error/70"
                            style={{ width: `${(custo / maior) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-headline font-black text-lg text-primary tracking-tighter">
                          {formatBRL(custo)}
                        </p>
                        <MetaTag>CUSTO CATALOGADO</MetaTag>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center gap-5 mt-5 pt-4 border-t border-outline-variant/20">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                <span className="w-3 h-3 rounded-sm bg-error/70" /> Danos catalogados
              </span>
            </div>
          </section>

          {/* tabela detalhada */}
          <section className="card-tonal shadow-ambient-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-3.5 px-6"><MetaTag>EVENTO</MetaTag></th>
                  <th className="py-3.5 pr-4"><MetaTag>DECRETO / FONTE</MetaTag></th>
                  <th className="py-3.5 pr-4 text-right"><MetaTag>OCORR.</MetaTag></th>
                  <th className="py-3.5 pr-4 text-right"><MetaTag>FAMÍLIAS</MetaTag></th>
                  <th className="py-3.5 pr-4 text-right"><MetaTag>CUSTO</MetaTag></th>
                  <th className="py-3.5 pr-4 text-right"><MetaTag>REPASSE</MetaTag></th>
                  <th className="py-3.5 pr-4"><MetaTag>PRAZO</MetaTag></th>
                  <th className="py-3.5 pr-6"><MetaTag>PRESTAÇÃO</MetaTag></th>
                  <th className="py-3.5 pr-6"><MetaTag>AÇÕES</MetaTag></th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors align-top"
                  >
                    <td className="py-4 px-6">
                      <p className="text-[13px] font-bold text-primary">{c.nome}</p>
                      <p className="text-[11px] text-on-surface-variant">{c.tipo}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{c.periodo}</p>
                    </td>
                    <td className="py-4 pr-4 max-w-[220px]">
                      <p className="text-[11px] font-bold text-primary leading-snug">
                        {c.decretoMunicipal || "—"}
                      </p>
                      <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">
                        {c.fonteLabel}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-[13px] font-mono font-bold text-on-surface text-right">
                      {c.ocorrencias}
                    </td>
                    <td className="py-4 pr-4 text-[13px] font-mono font-bold text-on-surface text-right">
                      {c.familiasAtingidas}
                    </td>
                    <td className="py-4 pr-4 text-[13px] font-black text-primary text-right">
                      {formatBRL(custoEvento(c))}
                      {c.parcial && (
                        <span className="block text-[9px] font-bold uppercase tracking-mono-tight text-orange-600">
                          parcial
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-[13px] font-bold text-secondary text-right">
                      {c.repasseRecebido > 0 ? formatBRL(c.repasseRecebido) : "—"}
                    </td>
                    <td className="py-4 pr-4 text-[11px] font-mono font-bold text-slate-400">
                      {c.prazoLimite}
                    </td>
                    <td className="py-4 pr-6">
                      <Chip tone="neutral">{c.statusLabel}</Chip>
                      <p className="text-[10px] text-on-surface-variant mt-1.5 max-w-[180px] leading-snug">
                        {c.observacao}
                      </p>
                    </td>
                    <td className="py-4 pr-6">
                      <button
                        type="button"
                        onClick={() => setPrestacaoEditando({ ...c })}
                        className="rounded-lg p-2 text-secondary hover:bg-surface-container-high"
                        aria-label={`Editar prestação de ${c.nome}`}
                      >
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5">
            <Icon name="info" className="text-[14px] mt-0.5" />
            Eventos em curso aparecem com custo parcial, somado a partir dos itens catalogados na tela
            de Danos. O valor fecha automaticamente quando o evento é encerrado.
          </p>
        </div>
      )
    )}

      {/* ─────────── PLANO DE CONTINGÊNCIA ─────────── */}
      {tab === "plano" && (
        <div className="flex items-center gap-4 rounded-xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 shadow-ambient-sm flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="view_compact" className="text-secondary text-[18px]" />
            <div>
              <MetaTag className="block text-secondary">VISUALIZAÇÃO DO PLANO</MetaTag>
              <p className="text-[10px] text-on-surface-variant">Escolha como consultar o PLANCON</p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-container-high p-1">
            <button type="button" onClick={() => setPlanoModo("documento")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-mono-tight transition-all ${planoModo === "documento" ? "bg-surface text-secondary shadow-ambient-sm" : "text-on-surface-variant hover:text-primary"}`}>
              <Icon name="description" className="text-[15px]" /> Documento
            </button>
            <button type="button" onClick={() => setPlanoModo("operacional")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-mono-tight transition-all ${planoModo === "operacional" ? "bg-surface text-secondary shadow-ambient-sm" : "text-on-surface-variant hover:text-primary"}`}>
              <Icon name="monitoring" className="text-[15px]" /> Operacional
            </button>
          </div>
        </div>
      )}

      {tab === "plano" && planoLoading && (
        <div className="flex flex-col items-center justify-center p-12 card-tonal shadow-ambient-sm">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-secondary mb-3" />
          <p className="text-sm text-on-surface-variant font-medium">Carregando plano de contingência…</p>
        </div>
      )}

      {tab === "plano" && !planoLoading && planoModo === "documento" && (
        <PlanContingenciaEditor
          entidadeId={entidade.id}
          entidadeNome={entidade.nome}
          responsavel={entidade.responsavel_nome || ""}
          contato={entidade.telefone || entidade.email || ""}
          zonas={planoZonas}
          eventos={eventosAtivos}
          familiasEmRisco={planoFamilias.total_em_risco}
          totalPessoas={planoFamilias.total_pessoas}
          pontos={pontos}
          equipe={planoEquipe}
          onToast={showToast}
        />
      )}

      {tab === "plano" && !planoLoading && planoModo === "operacional" && (
        <div className="space-y-5">
          <section className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <MetaTag className="text-secondary">PLANEJAMENTO OPERACIONAL</MetaTag>
                  <Chip tone="secondary">DADOS CONSOLIDADOS</Chip>
                </div>
                <h2 className="font-headline font-black text-3xl tracking-tighter text-primary">
                  Plano de Contingência Municipal
                </h2>
                <p className="text-[12px] text-on-surface-variant mt-2 leading-relaxed">
                  Visão operacional de riscos, pessoas expostas, recursos e procedimentos de resposta
                  de {entidade.nome}. Os indicadores são atualizados a partir dos cadastros da entidade.
                </p>
              </div>
              <div className="card-recessed px-5 py-4 min-w-[220px]">
                <MetaTag className="block">STATUS OPERACIONAL</MetaTag>
                <p className="mt-1 flex items-center gap-2 text-sm font-black" style={{ color: statusMeta.cor }}>
                  <StatusDot tone={statusMeta.tone} live={false} /> {statusMeta.label}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-2">Status vigente da entidade</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPI label="Zonas prioritárias" value={zonasPrioritarias.length} icon="warning" tone={zonasPrioritarias.length > 0 ? "warning" : "secondary"} sub="Em atenção ou situação crítica" />
            <KPI label="Eventos ativos" value={eventosAtivos.length} icon="emergency" tone={eventosAtivos.length > 0 ? "error" : "secondary"} sub="Em acompanhamento" />
            <KPI label="Famílias em risco" value={planoFamilias.total_em_risco} icon="family_restroom" tone={planoFamilias.total_em_risco > 0 ? "warning" : "secondary"} sub={`${planoFamilias.total_pessoas} pessoas cadastradas`} />
            <KPI label="Pontos de apoio" value={pontos.length} icon="home_work" tone="secondary" sub="Cadastrados na entidade" />
          </div>

          <section>
            <SectionHeader overline="1 · CENÁRIO ATUAL" title="Informações para tomada de decisão" />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <article className="card-tonal p-6 shadow-ambient-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div><MetaTag className="text-secondary">ÁREAS PRIORITÁRIAS</MetaTag><h3 className="font-headline font-black text-lg text-primary">Zonas em atenção</h3></div>
                  <Chip tone={zonasPrioritarias.length > 0 ? "warning" : "secondary"}>{zonasPrioritarias.length}</Chip>
                </div>
                <div className="space-y-2">
                  {zonasPrioritarias.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant">Nenhuma zona crítica ou em atenção cadastrada.</p>
                  ) : zonasPrioritarias.map((zona) => (
                    <div key={zona.id} className="card-recessed p-3">
                      <div className="flex items-center justify-between gap-2"><p className="text-[12px] font-bold text-primary">{zona.nome}</p><Chip tone={zona.status === "critico" ? "error" : "warning"}>{zona.status === "critico" ? "Crítica" : "Atenção"}</Chip></div>
                      <p className="text-[10px] text-on-surface-variant mt-1">{zona.tipo === "rural" ? "Área rural" : "Área urbana"}{zona.descricao ? ` · ${zona.descricao}` : ""}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card-tonal p-6 shadow-ambient-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div><MetaTag className="text-secondary">OCORRÊNCIAS AMPLIADAS</MetaTag><h3 className="font-headline font-black text-lg text-primary">Eventos em curso</h3></div>
                  <Chip tone={eventosAtivos.length > 0 ? "error" : "secondary"}>{eventosAtivos.length}</Chip>
                </div>
                <div className="space-y-2">
                  {eventosAtivos.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant">Nenhum evento ativo cadastrado.</p>
                  ) : eventosAtivos.map((evento) => (
                    <div key={evento.id} className="card-recessed p-3">
                      <p className="text-[12px] font-bold text-primary">{evento.nome}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">{evento.status || "Status não informado"} · {evento.zonas.length} zona(s) relacionada(s)</p>
                      {evento.recomendacoes.length > 0 && <p className="text-[10px] text-secondary font-bold mt-2">{evento.recomendacoes.length} recomendação(ões) publicada(s)</p>}
                    </div>
                  ))}
                </div>
              </article>

              <article className="card-tonal p-6 shadow-ambient-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div><MetaTag className="text-secondary">ACOMPANHAMENTO</MetaTag><h3 className="font-headline font-black text-lg text-primary">Monitoramentos críticos</h3></div>
                  <Chip tone={monitoramentosPrioritarios.length > 0 ? "error" : "secondary"}>{monitoramentosPrioritarios.length}</Chip>
                </div>
                <div className="space-y-2">
                  {monitoramentosPrioritarios.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant">Nenhum monitoramento de risco alto ou crítico.</p>
                  ) : monitoramentosPrioritarios.slice(0, 5).map((item) => (
                    <div key={item.id} className="card-recessed p-3">
                      <div className="flex items-center gap-2"><StatusDot tone="error" /><p className="text-[11px] font-bold text-primary">{item.status === "critico" ? "Crítico" : "Risco alto"}</p></div>
                      <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">{item.resumo}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section>
            <SectionHeader overline="2 · PROTOCOLOS POR CENÁRIO" title="Riscos e respostas previstas" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {CENARIOS_CONTINGENCIA.map((cenario) => (
                <article key={cenario.titulo} className="card-tonal p-6 shadow-ambient-sm">
                  <div className="w-11 h-11 rounded-xl bg-error-container flex items-center justify-center mb-4">
                    <Icon name={cenario.icon} className="text-error text-[23px]" />
                  </div>
                  <h3 className="font-headline font-black text-lg tracking-tight text-primary">{cenario.titulo}</h3>
                  <div className="mt-4 space-y-3">
                    <div>
                      <MetaTag className="block">CRITÉRIO DE ATIVAÇÃO</MetaTag>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{cenario.gatilho}</p>
                    </div>
                    <div>
                      <MetaTag className="block">RESPOSTA INICIAL</MetaTag>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{cenario.resposta}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-12 gap-5 items-start">
            <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="3 · ATIVAÇÃO" title="Níveis de resposta" />
              <div className="space-y-3">
                {NIVEIS_CONTINGENCIA.map((item, index) => (
                  <div key={item.nivel} className="card-recessed p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 font-black text-xs text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <Chip tone={item.tone}>{item.nivel}</Chip>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed mt-2">{item.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="4 · COMANDO" title="Responsabilidades operacionais" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { icon: "account_tree", papel: "Coordenação geral", pessoa: entidade.responsavel_nome || "Não cadastrado", acao: "Autorizar ativação e coordenar os órgãos envolvidos." },
                  { icon: "engineering", papel: "Operações de campo", pessoa: planoEquipe ? `${planoEquipe.efetivo} integrante(s) · ${planoEquipe.em_campo} em campo` : "Equipe sem panorama disponível", acao: "Vistoriar áreas, executar isolamento e apoiar evacuações." },
                  { icon: "campaign", papel: "Comunicação", pessoa: entidade.telefone || entidade.email || "Contato não cadastrado", acao: "Publicar alertas, orientações e atualizações oficiais." },
                  { icon: "inventory_2", papel: "Logística e assistência", pessoa: `${pontos.length} ponto(s) de apoio · ${planoFamilias.total_em_risco} família(s) em risco`, acao: "Mobilizar transporte, suprimentos e acolhimento." },
                ].map((item) => (
                  <div key={item.papel} className="card-recessed p-4 flex items-start gap-3">
                    <Icon name={item.icon} className="text-secondary text-[20px] shrink-0" />
                    <div>
                      <MetaTag className="block">{item.papel.toUpperCase()}</MetaTag>
                      <p className="text-[12px] font-bold text-primary">{item.pessoa}</p>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed mt-1">{item.acao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-12 gap-5 items-start">
            <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="5 · PROCEDIMENTOS" title="Checklist de ativação" />
              <div className="space-y-2">
                {PROTOCOLOS_CONTINGENCIA.map((protocolo, index) => (
                  <div key={protocolo} className="card-recessed p-3.5 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center text-[11px] font-black shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[12px] font-medium text-primary">{protocolo}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="6 · RECURSOS" title="Estrutura disponível" />
              <div className="space-y-3">
                <div className="card-recessed p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon name="home_work" className="text-secondary" />
                    <div><p className="text-[12px] font-bold text-primary">Pontos de apoio</p><p className="text-[10px] text-on-surface-variant">Locais de acolhimento cadastrados</p></div>
                  </div>
                  <span className="font-headline font-black text-xl text-primary">{pontos.length}</span>
                </div>
                {pontos.slice(0, 3).map((ponto) => (
                  <div key={ponto.id} className="card-recessed p-3 pl-5">
                    <p className="text-[11px] font-bold text-primary">{ponto.nome}</p>
                    <p className="text-[10px] text-on-surface-variant">{ponto.endereco || ponto.descricao || "Localização cadastrada por coordenadas"}</p>
                  </div>
                ))}
                <div className="card-recessed p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon name="call" className="text-secondary" />
                    <div><p className="text-[12px] font-bold text-primary">Contato da entidade</p><p className="text-[10px] text-on-surface-variant">Canal para coordenação da resposta</p></div>
                  </div>
                  <span className="text-[11px] font-bold text-primary">{entidade.telefone || "Não cadastrado"}</span>
                </div>
                <div className="rounded-xl border border-dashed border-outline-variant p-4">
                  <MetaTag className="block">AINDA PRECISA SER LEVANTADO</MetaTag>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
                    Veículos, equipamentos, abrigos com capacidade, rotas de evacuação, contatos dos órgãos parceiros e recursos para públicos vulneráveis.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ─────────── PONTOS DE APOIO ─────────── */}
      {tab === "apoios" && (
        <div className="space-y-5">
          {/* cabecalho */}
          <section className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0 flex-1">
                <SectionHeader
                  overline="ABRIGO TEMPORÁRIO"
                  title="Pontos de Apoio"
                />
                <p className="text-[12px] text-on-surface-variant -mt-3 w-full">
                  Escolas, UPAs, hospitais, CREAs e outras entidades municipais que podem oferecer
                  ajuda ou abrigo às pessoas atingidas por eventos.
                </p>
              </div>
              <Btn
                variant="primary"
                icon="add"
                onClick={() => {
                  setPontoEditando(null);
                  setPontoFormOpen(true);
                }}
              >
                Novo ponto
              </Btn>
            </div>
          </section>

          <div className="grid grid-cols-12 gap-5 items-start">
            {/* mapa com os pontos */}
            <section className="col-span-12 lg:col-span-7 card-tonal p-4 shadow-ambient-sm">
              <PointsMap
                points={pontosParaMapa}
                height={440}
                showFilters={false}
                showPopups={false}
                selectedId={pontoSelecionadoId}
                onSelect={(pt) => selecionarPonto(Number(pt.id))}
                focusRequest={
                  pontoSelecionadoId != null
                    ? { id: pontoSelecionadoId, versao: focoVersao }
                    : null
                }
              />
            </section>

            {/* lista ↔ detalhe (mesma altura do mapa, rolagem interna) */}
            <section
              className="col-span-12 lg:col-span-5 card-tonal p-4 shadow-ambient-sm flex flex-col min-h-0"
              style={{ height: 440 + 32 }}
            >
              <div className="flex items-start justify-between gap-3 pb-3 shrink-0">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-mono-tight text-secondary">
                    Pontos de apoio
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {pontosLoading
                      ? "Carregando…"
                      : `${pontos.length} ponto(s) cadastrado(s)`}
                  </p>
                </div>
                {pontoSelecionado && (
                  <button
                    type="button"
                    onClick={fecharPonto}
                    className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline shrink-0"
                  >
                    <Icon name="arrow_back" className="text-[14px]" />
                    Voltar à lista
                  </button>
                )}
              </div>

              {/* área de rolagem: lista ou detalhe do ponto */}
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {pontosLoading ? (
                  <div className="card-recessed p-8 text-center">
                    <p className="text-sm text-on-surface-variant font-medium">Carregando pontos…</p>
                  </div>
                ) : pontos.length === 0 ? (
                  <div className="card-recessed p-8 text-center">
                    <Icon name="home_work" className="text-[32px] text-on-surface-variant/60" />
                    <p className="text-sm text-on-surface-variant font-medium mt-2">
                      Nenhum ponto de apoio cadastrado.
                    </p>
                  </div>
                ) : pontoSelecionado ? (
                  <div className="p-1 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                        <Icon name="home_work" className="text-secondary text-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-primary leading-snug">
                          {pontoSelecionado.nome}
                        </p>
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-mono-tight text-secondary">
                          {pontoSelecionado.tipo_label ||
                            APOIO_TIPOS.find((opcao) => opcao.value === pontoSelecionado.tipo)?.label ||
                            "Outro"}
                        </p>
                      </div>
                    </div>

                    {pontoSelecionado.descricao && (
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        {pontoSelecionado.descricao}
                      </p>
                    )}

                    <dl className="space-y-2.5 text-[12px]">
                      {pontoSelecionado.zona && (
                        <div className="flex items-start gap-2">
                          <Icon name="layers" className="text-[15px] text-primary mt-0.5 shrink-0" />
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-mono-tight text-on-surface-variant">
                              Zona
                            </dt>
                            <dd className="text-primary font-medium mt-0.5">
                              {planoZonas.find((z) => z.id === pontoSelecionado.zona)?.nome ??
                                `Zona #${pontoSelecionado.zona}`}
                            </dd>
                          </div>
                        </div>
                      )}
                      {pontoSelecionado.endereco && (
                        <div className="flex items-start gap-2">
                          <Icon name="place" className="text-[15px] text-primary mt-0.5 shrink-0" />
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-mono-tight text-on-surface-variant">
                              Endereço
                            </dt>
                            <dd className="text-on-surface font-medium mt-0.5">
                              {pontoSelecionado.endereco}
                            </dd>
                          </div>
                        </div>
                      )}
                      {pontoSelecionado.coordenadas && (
                        <div className="flex items-start gap-2">
                          <Icon name="pin_drop" className="text-[15px] text-primary mt-0.5 shrink-0" />
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-mono-tight text-on-surface-variant">
                              Coordenadas
                            </dt>
                            <dd className="font-mono text-[11px] text-on-surface-variant mt-0.5">
                              {pontoSelecionado.coordenadas.lat.toFixed(5)},{" "}
                              {pontoSelecionado.coordenadas.lng.toFixed(5)}
                            </dd>
                          </div>
                        </div>
                      )}
                    </dl>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pontos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selecionarPonto(p.id)}
                        className={`w-full flex items-start gap-3 card-recessed p-3 text-left transition-colors ${
                          pontoSelecionadoId === p.id
                            ? "ring-2 ring-primary/60"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                          <Icon name="home_work" className="text-secondary text-[16px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-primary leading-snug truncate">
                            {p.nome}
                          </p>
                          <p className="mt-0.5 text-[10px] font-black uppercase tracking-mono-tight text-secondary">
                            {p.tipo_label ||
                              APOIO_TIPOS.find((opcao) => opcao.value === p.tipo)?.label ||
                              "Outro"}
                          </p>
                          {p.endereco && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1 truncate">
                              <Icon name="place" className="text-[13px] shrink-0" /> {p.endereco}
                            </p>
                          )}
                        </div>
                        <Icon
                          name="chevron_right"
                          className="text-on-surface-variant text-[16px] mt-1 shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ações fixas do detalhe (fora da rolagem, nunca somem) */}
              {pontoSelecionado && (
                <div className="pt-3 mt-3 border-t border-outline-variant/20 space-y-2 shrink-0">
                  {pontoSelecionado.zona && (
                    <Btn
                      variant="ghost"
                      icon="open_in_new"
                      className="w-full"
                      onClick={() =>
                        // sem noopener: nova aba herda a sessionStorage (senão cai no login)
                        window.open(`/zonedetail?zone=${pontoSelecionado.zona}`, "_blank")
                      }
                    >
                      Ver a zona no mapa
                    </Btn>
                  )}
                  <div className="flex gap-2">
                    <Btn
                      variant="secondary"
                      icon="edit"
                      className="flex-1"
                      onClick={() => {
                        setPontoEditando(pontoSelecionado);
                        setPontoFormOpen(true);
                      }}
                    >
                      Editar
                    </Btn>
                    <Btn
                      variant="danger"
                      icon="delete"
                      className="flex-1"
                      onClick={() => setPontoExcluindo(pontoSelecionado)}
                    >
                      Excluir
                    </Btn>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* modal criar/editar ponto de apoio */}
      <PontoApoioFormModal
        open={pontoFormOpen}
        ponto={pontoEditando}
        onClose={() => setPontoFormOpen(false)}
        onSaved={fetchPontos}
      />

      <ModalShell open={editandoFicha} onClose={() => setEditandoFicha(false)} maxWidth="max-w-2xl">
        <div className="p-8">
          <MetaTag>FICHA DA ENTIDADE</MetaTag>
          <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">Editar dados cadastrais</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {([
              ["sigla", "Sigla"],
              ["telefone", "Telefone"],
              ["email", "E-mail"],
              ["endereco", "Endereço"],
            ] as const).map(([campo, label]) => (
              <label key={campo} className={campo === "endereco" ? "md:col-span-2" : ""}>
                <MetaTag className="mb-1.5 block">{label.toUpperCase()}</MetaTag>
                <input
                  type={campo === "email" ? "email" : "text"}
                  value={fichaDraft[campo]}
                  onChange={(event) => setFichaDraft((atual) => ({ ...atual, [campo]: event.target.value }))}
                  className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary"
                />
              </label>
            ))}
            <label className="md:col-span-2">
              <MetaTag className="mb-1.5 block">RESPONSÁVEL</MetaTag>
              <div className="relative">
                <select
                  value={fichaDraft.responsavel ?? ""}
                  onChange={(event) => setFichaDraft((atual) => ({ ...atual, responsavel: event.target.value ? Number(event.target.value) : null }))}
                  className="w-full appearance-none rounded-lg bg-surface-container-low py-3 pl-4 pr-12 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Sem responsável</option>
                  {responsaveis.map((responsavel) => (
                    <option key={responsavel.id} value={responsavel.id}>
                      {responsavel.user_sys?.first_name || responsavel.user_sys?.username || responsavel.nome_anonimo || responsavel.telefone}
                    </option>
                  ))}
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-primary"
                />
              </div>
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <Btn variant="secondary" onClick={() => setEditandoFicha(false)} full>Cancelar</Btn>
            <Btn variant="primary" icon="save" onClick={() => void salvarFicha()} full>Salvar</Btn>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={prestacaoEditando !== null} onClose={() => setPrestacaoEditando(null)} maxWidth="max-w-2xl">
        {prestacaoEditando && (
          <div className="p-8">
            <MetaTag>PRESTAÇÃO DE CONTAS</MetaTag>
            <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">{prestacaoEditando.nome}</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <MetaTag className="mb-1.5 block">DECRETO MUNICIPAL</MetaTag>
                <input value={prestacaoEditando.decretoMunicipal ?? ""} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, decretoMunicipal: e.target.value }))} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary" />
              </label>
              <label>
                <MetaTag className="mb-1.5 block">FONTE DO RECURSO</MetaTag>
                <select value={prestacaoEditando.fonteRecurso} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, fonteRecurso: e.target.value }))} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary">
                  <option value="proprio">Recurso próprio</option><option value="estadual">Recurso estadual</option><option value="federal">Recurso federal</option><option value="outro">Outro</option>
                </select>
              </label>
              <label>
                <MetaTag className="mb-1.5 block">REPASSE RECEBIDO</MetaTag>
                <input type="number" min="0" step="0.01" value={prestacaoEditando.repasseRecebido} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, repasseRecebido: Number(e.target.value) }))} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary" />
              </label>
              <label>
                <MetaTag className="mb-1.5 block">PRAZO LIMITE</MetaTag>
                <input type="date" value={prestacaoEditando.prazoIso} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, prazoIso: e.target.value }))} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary" />
              </label>
              <label className="md:col-span-2">
                <MetaTag className="mb-1.5 block">STATUS</MetaTag>
                <select value={prestacaoEditando.statusPrestacao} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, statusPrestacao: e.target.value as ContaEvento["statusPrestacao"] }))} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary">
                  <option value="em_curso">Em curso</option><option value="em_elaboracao">Em elaboração</option><option value="enviada">Enviada</option><option value="aprovada">Aprovada</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <MetaTag className="mb-1.5 block">OBSERVAÇÃO</MetaTag>
                <textarea rows={4} value={prestacaoEditando.observacao} onChange={(e) => setPrestacaoEditando((p) => p && ({ ...p, observacao: e.target.value }))} className="w-full resize-none rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <Btn variant="secondary" onClick={() => setPrestacaoEditando(null)} full>Cancelar</Btn>
              <Btn variant="primary" icon="save" onClick={() => void salvarPrestacao()} full>Salvar</Btn>
            </div>
          </div>
        )}
      </ModalShell>

      {/* confirmar exclusão */}
      <ModalShell
        open={pontoExcluindo !== null}
        onClose={() => setPontoExcluindo(null)}
        maxWidth="max-w-md"
      >
        <div className="p-8">
          <MetaTag>EXCLUIR PONTO DE APOIO</MetaTag>
          <h2 className="font-headline font-black text-xl tracking-tighter mt-2 text-primary">
            Excluir “{pontoExcluindo?.nome}”?
          </h2>
          <p className="text-[12px] text-on-surface-variant mt-2">
            Esta ação remove o ponto de apoio permanentemente.
          </p>
          <div className="flex gap-3 mt-6">
            <Btn variant="secondary" onClick={() => setPontoExcluindo(null)} full>
              Cancelar
            </Btn>
            <Btn
              variant="danger"
              icon="delete"
              onClick={() => pontoExcluindo && excluirPonto(pontoExcluindo)}
              full
            >
              Excluir
            </Btn>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

export default function EntityPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-on-surface-variant">
          Carregando a entidade…
        </div>
      }
    >
      <EntityPageContent />
    </Suspense>
  );
}
