"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, Chip, Icon, KPI, MetaTag } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";
import { CreateOccurrenceModal } from "@/app/components/CreateOccurrenceModal";
import { EditOccurrenceModal } from "@/app/components/EditOccurrenceModal";
import { DeleteOccurrenceModal } from "@/app/components/DeleteOccurrenceModal";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import {
  STATUS_OCORRENCIA_LABEL,
  googleMapsUrl,
} from "@/app/data/mock";

// --- tipos da resposta da api ---

interface Ocorrencia {
  id: number;
  entidade: number;
  zona: number | null;
  autor: number | null;
  cidadao: number | null;
  familia: number | null;
  titulo: string;
  categoria: string;
  status: string;
  coordenadas: { lat: number; lng: number } | null;
  descricao: string;
  nivel_perigo_ia: string | null;
  analise_ia: string | null;
  valido_ia: boolean;
  feito_ia: boolean;
  tecnico_responsavel: number | null;
  nivel_perigo_tecnico: string | null;
  analise_tecnico: string | null;
  valido_tecnico: boolean | null;
  created_at: string;
  anexos: unknown[];
  endereco?: string;
  evento: number | null;
  custo_danos: string | null;
  total_itens_danos: number | null;
  historico?: OcorrenciaHistorico[];
}

interface OcorrenciaHistorico {
  id: number;
  tipo_acao: "criacao" | "edicao" | "exclusao";
  dados_anteriores: Record<string, unknown>;
  dados_novos: Record<string, unknown>;
  campos_alterados: string[];
  criado_em: string;
  usuario: number | null;
}

interface EventoBasic {
  id: number;
  nome: string;
  status: string | null;
  tipo: "desastre" | "mitigacao";
}

interface EventoListResponse {
  eventos: EventoBasic[];
}

interface OcorrenciaAnexo {
  id?: number;
  arquivo?: {
    id?: number;
    nome?: string;
    reference_id?: string | null;
    local_storage?: string | null;
  };
}

interface OcorrenciaListResponse {
  ocorrencias: Ocorrencia[];
}

interface DanoOcorrencia {
  id: number;
  item_nome: string;
  unidade: string;
  categoria: string;
  quantidade: number;
  valor_unitario_aplicado: string | number;
  valor_total: string | number;
  observacoes: string;
  created_at: string;
}

interface DanosOcorrenciaResponse {
  danos: DanoOcorrencia[];
  custo_total: string | number;
}

interface ZonaBasic {
  id: number;
  nome: string;
}

interface ZonaListResponse {
  zonas: ZonaBasic[];
}

interface FamiliaBasic {
  id: number;
  nome: string;
}

interface FamiliaListResponse {
  familias: FamiliaBasic[];
}

interface ChecklistBasic {
  id: number;
  label: string;
}

interface UsuarioInfo {
  id: number;
  user_sys: { id: number; username: string; first_name: string; email: string } | null;
  telefone: string;
  nome_anonimo: string | null;
  tipo: number;
}

function separarRelato(descricao: string): { relato: string; marcacoes: string[] } {
  const marcador = "\n\nInformações marcadas:\n";
  const indice = descricao.indexOf(marcador);
  if (indice < 0) return { relato: descricao, marcacoes: [] };
  return {
    relato: descricao.slice(0, indice).trim(),
    marcacoes: descricao
      .slice(indice + marcador.length)
      .split("\n")
      .map((item) => item.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean),
  };
}

// --- helpers ---

const CATEGORIA_LABEL: Record<string, string> = {
  desabamento: "Desabamento",
  deslizamento: "Deslizamento",
  queda_de_barreira: "Queda De Barreira",
  erosao: "Erosão",
  incendio: "Incêndio",
  alagamento: "Alagamento",
  inundacao: "Inundação",
  outro: "Outro",
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

const CAMPO_HISTORICO_LABEL: Record<string, string> = {
  titulo: "Título",
  categoria: "Categoria",
  status: "Status",
  descricao: "Relato",
  coordenadas: "Coordenadas",
  endereco: "Endereço",
  zona: "Zona",
  zona_id: "Zona",
  evento: "Evento",
  evento_id: "Evento",
  familia_id: "Família",
  tecnico_responsavel: "Responsável",
  tecnico_responsavel_id: "Responsável",
  marcacoes: "Informações marcadas",
  nivel_perigo_tecnico: "Nível de perigo técnico",
  analise_tecnico: "Análise técnica",
  valido_tecnico: "Validação técnica",
};

function formatHistoryValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    if ("lat" in value && "lng" in value) {
      const coordinates = value as { lat?: unknown; lng?: unknown };
      return `${String(coordinates.lat ?? "—")}, ${String(coordinates.lng ?? "—")}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

const CATEGORIA_ICON: Record<string, string> = {
  geologico: "terrain",
  climatico: "thunderstorm",
  vias_publicas: "directions_car",
  produtos_perigosos: "science",
};

function categoriaLabel(categoria: string): string {
  const label = CATEGORIA_LABEL[categoria] ?? categoria.replaceAll("_", " ");
  return label
    .split(" ")
    .map((palavra) =>
      palavra
        ? palavra[0].toLocaleUpperCase("pt-BR") + palavra.slice(1)
        : palavra,
    )
    .join(" ");
}

function tituloOcorrencia(ocorrencia: Pick<Ocorrencia, "titulo" | "categoria">): string {
  const tituloAutomatico = ocorrencia.titulo.match(/^Ocorrência\s*[—-]\s*(.+)$/i);
  if (tituloAutomatico?.[1]?.trim().toLowerCase() === ocorrencia.categoria.toLowerCase()) {
    return `Ocorrência — ${categoriaLabel(ocorrencia.categoria)}`;
  }
  return ocorrencia.titulo;
}

function statusToneFor(
  status: string,
): "error" | "warning" | "secondary" | "info" | "progress" {
  const s = status.toLowerCase();
  if (s === "alta_prioridade" || s === "critico" || s === "r4" || s === "r3") return "error";
  if (s === "aguardando" || s === "atencao" || s === "risco_moderado" || s === "r2") {
    return "warning";
  }
  if (s === "em_analise") return "info";
  if (s === "em_andamento") return "progress";
  return "secondary";
}

function statusAccentClass(status: string): string {
  const tone = statusToneFor(status);
  if (tone === "error") return "bg-error";
  if (tone === "warning") return "bg-orange-500";
  if (tone === "info") return "bg-blue-500";
  if (tone === "progress") return "bg-violet-500";
  return "bg-secondary";
}

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

function mimeTypeDoArquivo(nome: string): string | null {
  const extensao = nome.split(".").pop()?.toLowerCase();
  const tipos: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return extensao ? tipos[extensao] ?? null : null;
}

// --- componente ---

function OccurrencesContent() {
  const { showToast } = useGardian();
  const searchParams = useSearchParams();

  // estado dos dados
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [zonaLookup, setZonaLookup] = useState<Map<number, string>>(new Map());
  const [usuarioLookup, setUsuarioLookup] = useState<Map<number, string>>(new Map());
  const [eventos, setEventos] = useState<EventoBasic[]>([]);
  const [familiaLookup, setFamiliaLookup] = useState<Map<number, string>>(new Map());
  const [checklistLookup, setChecklistLookup] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // estado da ui
  const [filter, setFilter] = useState("todas");
  const [selected, setSelected] = useState<number | null>(null);
  const [ocorrenciaParaPosicionar, setOcorrenciaParaPosicionar] = useState<number | null>(null);
  const [danosSelecionados, setDanosSelecionados] = useState<DanoOcorrencia[]>([]);
  const [carregandoDanos, setCarregandoDanos] = useState(false);
  const [erroDanos, setErroDanos] = useState("");
  const [mostrarTodosDanos, setMostrarTodosDanos] = useState(false);
  const [detailTab, setDetailTab] = useState<"detalhes" | "historico">("detalhes");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // busca, filtro por status e agrupamento em evento
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [modoAgrupar, setModoAgrupar] = useState(false);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [eventoAgrupamentoId, setEventoAgrupamentoId] = useState<number | null>(null);
  const [agrupando, setAgrupando] = useState(false);
  const [erroAgrupamento, setErroAgrupamento] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const occRes = await api.get<OcorrenciaListResponse>("/ocorrencias/");
      const lista = occRes.data.ocorrencias ?? [];

      setOcorrencias(lista);
      setSelected((current) =>
        current != null && lista.some((o) => o.id === current)
          ? current
          : lista[0]?.id ?? null,
      );

      const [zonRes, usuRes, eventosRes, familiasRes, checklistRes] = await Promise.allSettled([
        api.get<ZonaListResponse>("/zonas/"),
        api.get<UsuarioInfo[]>("/usuarios/"),
        api.get<EventoListResponse>("/eventos/"),
        api.get<FamiliaListResponse>("/familias/"),
        api.get<ChecklistBasic[]>("/entidades/checklist/"),
      ]);

      // lookup de zonas
      const zLookup = new Map<number, string>();
      if (zonRes.status === "fulfilled") {
        for (const z of zonRes.value.data.zonas ?? []) {
          zLookup.set(z.id, z.nome);
        }
      }
      setZonaLookup(zLookup);

      // lookup de usuarios
      const uLookup = new Map<number, string>();
      if (usuRes.status === "fulfilled") {
        for (const u of usuRes.value.data ?? []) {
          const nome =
            u.user_sys?.username ??
            u.nome_anonimo ??
            u.telefone ??
            `Usuário #${u.id}`;
          uLookup.set(u.id, nome);
        }
      }
      setUsuarioLookup(uLookup);

      setEventos(eventosRes.status === "fulfilled" ? eventosRes.value.data.eventos ?? [] : []);
      setFamiliaLookup(
        new Map(
          familiasRes.status === "fulfilled"
            ? (familiasRes.value.data.familias ?? []).map((familia) => [familia.id, familia.nome])
            : [],
        ),
      );
      setChecklistLookup(
        new Map(
          checklistRes.status === "fulfilled"
            ? (checklistRes.value.data ?? []).map((item) => [item.id, item.label])
            : [],
        ),
      );
    } catch {
      setOcorrencias([]);
      setSelected(null);
      setZonaLookup(new Map());
      setUsuarioLookup(new Map());
      setEventos([]);
      setFamiliaLookup(new Map());
      setChecklistLookup(new Map());
      setLoadError("Não foi possível carregar as ocorrências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  // seleciona ocorrência vinda do mapa da zona (?id=X)
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return;
    const id = Number(idParam);
    if (!Number.isFinite(id) || !ocorrencias.some((o) => o.id === id)) return;
    const timer = window.setTimeout(() => {
      setBusca("");
      setFilter("todas");
      setStatusFilter("todos");
      setSelected(id);
      setDetailTab("detalhes");
      setOcorrenciaParaPosicionar(id);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchParams, ocorrencias]);

  useEffect(() => {
    if (selected == null) return;

    let cancelado = false;
    const timer = window.setTimeout(() => {
      setCarregandoDanos(true);
      setErroDanos("");
      setMostrarTodosDanos(false);
      api.get<DanosOcorrenciaResponse>("/danos/registros/", {
        params: { ocorrencia: selected },
      })
        .then((response) => {
          if (!cancelado) setDanosSelecionados(response.data.danos ?? []);
        })
        .catch(() => {
          if (!cancelado) {
            setDanosSelecionados([]);
            setErroDanos("Não foi possível carregar os itens de danos.");
          }
        })
        .finally(() => {
          if (!cancelado) setCarregandoDanos(false);
        });
    }, 0);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [selected]);

  // agrupa categorias disponiveis a partir dos dados reais
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set(ocorrencias.map((o) => o.categoria));
    return ["todas", ...set];
  }, [ocorrencias]);

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ocorrencias
      .filter((o) => {
        if (filter !== "todas" && o.categoria !== filter) return false;
        if (statusFilter !== "todos" && o.status !== statusFilter) return false;
        if (termo) {
          const alvo = [
            String(o.id),
            o.titulo,
            o.descricao,
            o.endereco ?? "",
            o.zona != null ? zonaLookup.get(o.zona) ?? "" : "",
          ]
            .join(" ")
            .toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const prioridadeA = a.status === "alta_prioridade" ? 0 : 1;
        const prioridadeB = b.status === "alta_prioridade" ? 0 : 1;
        if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [ocorrencias, filter, statusFilter, busca, zonaLookup]);

  // --- indicadores ---

  const indicadores = useMemo(() => {
    const abertas = ocorrencias.filter(
      (o) => o.status === "em_analise" || o.status === "aguardando" || o.status === "alta_prioridade",
    ).length;
    const andamento = ocorrencias.filter((o) => o.status === "em_andamento").length;
    const resolvidas = ocorrencias.filter((o) => o.status === "concluida").length;

    const porZona = new Map<number, number>();
    for (const o of ocorrencias) {
      if (o.zona != null) porZona.set(o.zona, (porZona.get(o.zona) ?? 0) + 1);
    }
    const ranking = [...porZona.entries()].sort((a, b) => b[1] - a[1]);
    const topZona = ranking[0];

    return {
      abertas,
      andamento,
      resolvidas,
      topZonaNome: topZona ? zonaLookup.get(topZona[0]) ?? `Zona #${topZona[0]}` : "—",
      topZonaQtd: topZona ? topZona[1] : 0,
      ranking: ranking.slice(0, 4),
    };
  }, [ocorrencias, zonaLookup]);

  const statusDisponiveis = useMemo(() => {
    const set = new Set(ocorrencias.map((o) => o.status));
    return ["todos", ...set];
  }, [ocorrencias]);

  const toggleMarcada = (id: number) =>
    setMarcadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const abrirAnexo = async (anexo: OcorrenciaAnexo) => {
    const arquivo = anexo.arquivo;
    if (!arquivo?.reference_id) {
      showToast("Este anexo não possui um arquivo disponível para visualização.", "error");
      return;
    }

    const novaAba = window.open("", "_blank");
    if (novaAba) {
      novaAba.document.title = "Carregando anexo…";
      novaAba.document.body.textContent = "Carregando anexo…";
    }

    try {
      const response = await api.get<Blob>("/api/arquivo", {
        params: { reference_id: arquivo.reference_id },
        responseType: "blob",
      });
      const headerContentType = response.headers["content-type"];
      const tipoPeloNome = mimeTypeDoArquivo(arquivo.nome ?? "");
      const contentType = tipoPeloNome
        ?? (typeof headerContentType === "string" ? headerContentType : "application/octet-stream");
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.replace(url);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      novaAba?.close();
      showToast("Não foi possível abrir o anexo. Tente novamente.", "error");
    }
  };

  const abrirAgrupamento = () => {
    if (marcadas.length < 2) {
      showToast("Selecione ao menos duas ocorrências para formar um evento.", "error");
      return;
    }
    if (eventos.length === 0) {
      showToast("Nenhum evento disponível. Cadastre um evento primeiro.", "error");
      return;
    }
    setEventoAgrupamentoId(null);
    setErroAgrupamento("");
    setShowGroupModal(true);
  };

  const confirmarAgrupamento = async () => {
    if (eventoAgrupamentoId === null) {
      setErroAgrupamento("Selecione o evento que receberá as ocorrências.");
      return;
    }

    setAgrupando(true);
    setErroAgrupamento("");
    const resultados = await Promise.allSettled(
      marcadas.map((id) => api.patch(`/ocorrencias/${id}/`, { evento: eventoAgrupamentoId })),
    );
    const idsComFalha = marcadas.filter((_, index) => resultados[index].status === "rejected");
    const quantidadeSucesso = marcadas.length - idsComFalha.length;

    if (quantidadeSucesso > 0) {
      await fetchData();
    }

    if (idsComFalha.length === 0) {
      showToast(
        `${quantidadeSucesso} ocorrência${quantidadeSucesso !== 1 ? "s" : ""} vinculada${quantidadeSucesso !== 1 ? "s" : ""} ao evento.`,
      );
      setMarcadas([]);
      setModoAgrupar(false);
      setShowGroupModal(false);
    } else {
      setMarcadas(idsComFalha);
      setErroAgrupamento(
        quantidadeSucesso > 0
          ? `${quantidadeSucesso} ocorrência(s) foram vinculadas, mas ${idsComFalha.length} falharam. Tente novamente.`
          : "Não foi possível vincular as ocorrências ao evento. Tente novamente.",
      );
    }
    setAgrupando(false);
  };

  const selecionada = useMemo(
    () =>
      ocorrenciasFiltradas.find((o) => o.id === selected) ??
      ocorrenciasFiltradas[0] ??
      null,
    [ocorrenciasFiltradas, selected],
  );
  const relatoSelecionado = useMemo(
    () => (selecionada ? separarRelato(selecionada.descricao) : { relato: "", marcacoes: [] }),
    [selecionada],
  );
  const historicoSelecionado = useMemo(
    () =>
      [...(selecionada?.historico ?? [])].sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
      ),
    [selecionada],
  );

  const formatHistoryFieldValue = (campo: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "Não informado";

    const relationId = typeof value === "number" ? value : Number(value);
    if (campo === "zona_id" || campo === "zona") {
      return Number.isFinite(relationId)
        ? zonaLookup.get(relationId) ?? "Zona não identificada"
        : "Zona não identificada";
    }
    if (campo === "evento_id" || campo === "evento") {
      return Number.isFinite(relationId)
        ? eventos.find((evento) => evento.id === relationId)?.nome ?? "Evento não identificado"
        : "Evento não identificado";
    }
    if (campo === "familia_id") {
      return Number.isFinite(relationId)
        ? familiaLookup.get(relationId) ?? "Família não identificada"
        : "Família não identificada";
    }
    if (campo === "tecnico_responsavel_id" || campo === "tecnico_responsavel") {
      return Number.isFinite(relationId)
        ? usuarioLookup.get(relationId) ?? "Responsável não identificado"
        : "Responsável não identificado";
    }
    if (campo === "marcacoes" && Array.isArray(value)) {
      if (value.length === 0) return "Nenhuma";
      return value
        .map((item) => {
          const itemId = Number(item);
          return Number.isFinite(itemId)
            ? checklistLookup.get(itemId) ?? "Informação não identificada"
            : "Informação não identificada";
        })
        .join(", ");
    }
    if (campo === "categoria" && typeof value === "string") {
      return CATEGORIA_LABEL[value] ?? categoriaLabel(value);
    }
    if (campo === "status" && typeof value === "string") {
      return STATUS_OCORRENCIA_LABEL[value] ?? value.replaceAll("_", " ");
    }

    return formatHistoryValue(value);
  };

  // contagem por categoria para as abas
  const contagem = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ocorrencias) {
      map.set(o.categoria, (map.get(o.categoria) ?? 0) + 1);
    }
    return map;
  }, [ocorrencias]);

  // --- renderização ---

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <header className="mb-8">
          <MetaTag className="text-secondary">CENTRAL DE OCORRÊNCIAS</MetaTag>
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Ocorrências em Aberto
          </h1>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">
            Carregando ocorrências…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-clip p-8">
      {/* cabeçalho */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">CENTRAL DE OCORRÊNCIAS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>
            {ocorrencias.length} REGISTRO{ocorrencias.length !== 1 ? "S" : ""}
          </MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Ocorrências em Aberto
            </h1>
            { /*
            <p className="text-sm text-on-surface-variant mt-2">
              Triagem unificada · Relatos da população, sensores IoT e parceiros
              institucionais
            </p>
             */ }
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" icon="add" onClick={() => setShowCreateModal(true)}>
              Nova Ocorrência
            </Btn>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="mb-6 rounded-xl border border-error/20 bg-error-container p-5">
          <div className="flex items-center gap-3">
            <Icon name="error" filled className="text-[22px] text-error" />
            <p className="text-sm font-medium text-on-error-container">
              {loadError}
            </p>
          </div>
        </div>
      )}

      {/* indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <KPI
          label="Em Aberto"
          value={indicadores.abertas}
          icon="pending"
          tone={indicadores.abertas > 0 ? "warning" : "secondary"}
          sub="Aguardando triagem ou despacho"
        />
        <KPI
          label="Em Andamento"
          value={indicadores.andamento}
          icon="engineering"
          tone={indicadores.andamento > 0 ? "error" : "secondary"}
          sub="Com equipe atuando"
        />
        <KPI
          label="Resolvidas"
          value={indicadores.resolvidas}
          icon="task_alt"
          tone="secondary"
          sub="Concluídas pela equipe"
        />
        <KPI
          label="Zona com Mais Registros"
          value={indicadores.topZonaQtd}
          icon="hub"
          tone="secondary"
          sub={indicadores.topZonaNome}
        />
      </div>

      {/* ranking por zona */}
      {indicadores.ranking.length > 0 && (
        <section className="card-tonal mb-6 p-6 shadow-ambient-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Icon name="leaderboard" className="text-[22px]" />
              </span>
              <h2 className="font-headline text-lg font-black tracking-tight text-primary">
                Zonas com Mais Ocorrências
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {indicadores.ranking.map(([zid, qtd], index) => {
              const nome = zonaLookup.get(zid) ?? `Zona #${zid}`;
              const maiorQuantidade = indicadores.ranking[0]?.[1] ?? 1;
              const proporcao = Math.max(8, (qtd / maiorQuantidade) * 100);

              return (
                <button
                  key={zid}
                  type="button"
                  onClick={() => setBusca(nome)}
                  className="group rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/35 hover:bg-white hover:shadow-ambient-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  aria-label={`Filtrar ocorrências da ${nome}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index === 0
                        ? "bg-secondary text-white"
                        : "bg-surface-container-high text-on-surface-variant"
                        }`}
                    >
                      {index + 1}º
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-mono-tight text-primary shadow-sm">
                      {qtd} {qtd === 1 ? "registro" : "registros"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Icon name="location_on" filled className="text-[17px] text-secondary" />
                    <p className="truncate text-sm font-bold text-primary">{nome}</p>
                  </div>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${index === 0 ? "bg-secondary" : "bg-primary/45"}`}
                      style={{ width: `${proporcao}%` }}
                    />
                  </div>

                  <span className="mt-3 flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-mono-tight text-on-surface-variant transition-colors group-hover:text-secondary">
                    Filtrar ocorrências
                    <Icon
                      name="arrow_forward"
                      className="text-[14px] transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* filtros fixos: permanecem visíveis durante a leitura da lista */}
      <section className="sticky top-16 z-20 mb-6 min-w-0 max-w-full overflow-hidden rounded-xl border border-outline-variant/25 bg-surface/95 p-4 shadow-ambient-sm backdrop-blur-xl">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white sm:flex">
            <Icon name="filter_list" className="text-[20px]" />
          </div>

          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px]"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por título, endereço, zona ou número…"
              className="h-11 w-full rounded-lg border border-transparent bg-surface-container-low pl-11 pr-10 text-sm font-medium outline-none transition-all placeholder:text-on-surface-variant/50 hover:border-outline-variant/40 focus:border-secondary/40 focus:ring-2 focus:ring-secondary/30"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:bg-surface-container"
                aria-label="Limpar busca"
              >
                <Icon name="close" className="text-on-surface-variant text-[16px]" />
              </button>
            )}
          </div>

          <label className="relative w-full shrink-0 sm:w-auto">
            <span className="sr-only">Filtrar por status</span>
            <Icon
              name="tune"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[17px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-outline-variant/25 bg-white pl-10 pr-10 text-xs font-bold text-primary outline-none transition-all hover:border-secondary/40 focus:ring-2 focus:ring-secondary/30 sm:min-w-[180px]"
            >
              {statusDisponiveis.map((st) => (
                <option key={st} value={st}>
                  {st === "todos" ? "Todos os Status" : STATUS_OCORRENCIA_LABEL[st] ?? st}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
            />
          </label>

          <label className="relative w-full shrink-0 sm:w-auto">
            <span className="sr-only">Filtrar por categoria</span>
            <Icon
              name="category"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[17px]"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-outline-variant/25 bg-white pl-10 pr-10 text-xs font-bold text-primary outline-none transition-all hover:border-secondary/40 focus:ring-2 focus:ring-secondary/30 sm:min-w-[210px]"
            >
              {categoriasDisponiveis.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "todas"
                    ? "Todas as Categorias"
                    : `${categoriaLabel(cat)} (${contagem.get(cat) ?? 0})`}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
            />
          </label>

          <div className="hidden h-11 shrink-0 items-center rounded-lg bg-primary/5 px-3 xl:flex">
            <span className="text-[10px] font-bold uppercase tracking-mono-tight text-primary">
              <strong className="text-sm text-secondary">{ocorrenciasFiltradas.length}</strong>{" "}
              de {ocorrencias.length}
            </span>
          </div>

          {(busca || statusFilter !== "todos" || filter !== "todas") && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setStatusFilter("todos");
                setFilter("todas");
              }}
              className="hidden h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary sm:flex"
            >
              <Icon name="filter_alt_off" className="text-[16px]" />
              Limpar
            </button>
          )}
        </div>

      </section>

      {/* Cabeçalho da Lista */}
      <div className="mb-4">
        <h2 className="font-headline text-lg font-black tracking-tight text-primary">
          Lista de Ocorrências
        </h2>
        <p className="text-[11px] text-on-surface-variant">
          {ocorrenciasFiltradas.length} ocorrência{ocorrenciasFiltradas.length !== 1 ? "s" : ""} encontrada{ocorrenciasFiltradas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Lista + detalhe */}
      {ocorrenciasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="search_off" className="text-on-surface-variant text-[48px] mb-4" />
          <p className="text-sm text-on-surface-variant">
            Nenhuma ocorrência encontrada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Lista */}
          <div className="col-span-12 lg:col-span-7 space-y-3">
            <div className="z-10 flex flex-col gap-3 rounded-xl border border-outline-variant/25 bg-surface/95 p-3 shadow-ambient-sm backdrop-blur-xl lg:sticky lg:top-36 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  name={modoAgrupar ? "checklist" : "event"}
                  className={`shrink-0 text-[18px] ${modoAgrupar ? "text-secondary" : "text-on-surface-variant"}`}
                />
                <p className="truncate text-[11px] font-medium text-on-surface-variant">
                  {modoAgrupar
                    ? `${marcadas.length} ocorrência${marcadas.length !== 1 ? "s" : ""} selecionada${marcadas.length !== 1 ? "s" : ""}`
                    : "Selecione ocorrências para vincular a um evento"}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {modoAgrupar && (
                  <Btn
                    variant="success"
                    icon="cyclone"
                    onClick={abrirAgrupamento}
                    disabled={marcadas.length < 2}
                  >
                    Agrupar ({marcadas.length})
                  </Btn>
                )}
                <Btn
                  variant={modoAgrupar ? "ghost" : "secondary"}
                  icon={modoAgrupar ? "close" : "checklist"}
                  onClick={() => {
                    setModoAgrupar((v) => !v);
                    setMarcadas([]);
                  }}
                >
                  {modoAgrupar ? "Cancelar" : "Selecionar p/ evento"}
                </Btn>
              </div>
            </div>

            {ocorrenciasFiltradas.map((o) => {
              const zonaNome =
                o.zona != null ? zonaLookup.get(o.zona) ?? `#${o.zona}` : null;
              const autorNome =
                o.autor != null
                  ? usuarioLookup.get(o.autor) ?? `#${o.autor}`
                  : null;

              return (
                <button
                  key={o.id}
                  id={`ocorrencia-${o.id}`}
                  ref={(elemento) => {
                    if (!elemento || ocorrenciaParaPosicionar !== o.id) return;
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(() => {
                        elemento.scrollIntoView({ behavior: "smooth", block: "center" });
                        setOcorrenciaParaPosicionar(null);
                      });
                    });
                  }}
                  onClick={() => {
                    if (modoAgrupar) toggleMarcada(o.id);
                    else {
                      setSelected(o.id);
                      setDetailTab("detalhes");
                    }
                  }}
                  className={`w-full scroll-mt-36 card-tonal p-6 shadow-ambient-sm text-left relative overflow-hidden hover:shadow-ambient transition-all ${modoAgrupar && marcadas.includes(o.id)
                    ? "ring-2 ring-secondary"
                    : !modoAgrupar && selected === o.id
                      ? "ring-2 ring-secondary"
                      : ""
                    }`}
                >
                  <span
                    className={`absolute top-0 left-0 bottom-0 w-1 ${statusAccentClass(o.status)}`}
                  />
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {modoAgrupar && (
                          <Icon
                            name={marcadas.includes(o.id) ? "check_box" : "check_box_outline_blank"}
                            className={`text-[20px] ${marcadas.includes(o.id) ? "text-secondary" : "text-on-surface-variant"}`}
                          />
                        )}
                        <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">
                          #{o.id}
                        </span>
                        <Chip tone={statusToneFor(o.status)}>
                          {(STATUS_OCORRENCIA_LABEL[o.status] ?? o.status.replaceAll("_", " ")).toUpperCase()}
                        </Chip>
                      </div>
                      <MetaTag>{formatDate(o.created_at)}</MetaTag>
                    </div>
                    <h3 className="font-headline font-bold text-lg text-primary mb-2">
                      {tituloOcorrencia(o)}
                    </h3>
                    {o.endereco && (
                      <p className="text-[12px] text-on-surface-variant mb-2 flex items-start gap-1.5">
                        <Icon name="home_pin" className="text-[15px] mt-0.5 shrink-0" />
                        {o.endereco}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-on-surface-variant flex-wrap">
                      {zonaNome && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="location_on" className="text-[14px]" />
                          {zonaNome}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Icon
                          name={
                            CATEGORIA_ICON[o.categoria] ?? "help"
                          }
                          className="text-[14px]"
                        />
                        {categoriaLabel(o.categoria)}
                      </span>
                      {autorNome && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="person" className="text-[14px]" />
                          {autorNome}
                        </span>
                      )}
                      {o.anexos.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="attach_file" className="text-[14px]" />
                          {o.anexos.length} anexo{o.anexos.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* painel de detalhe */}
          {selecionada && (
            <aside className="col-span-12 lg:col-span-5">
              <div className="card-tonal shadow-ambient-sm overflow-hidden lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
                {/* cabeçalho do detalhe */}
                <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6">
                  <div className="flex items-start justify-between gap-3">
                    <Chip tone="primarySoft" className="!bg-white/15 !text-white">
                      {categoriaLabel(selecionada.categoria).toUpperCase()}
                    </Chip>
                    <div className="flex items-center gap-2">
                      <Btn
                        variant="ghostDark"
                        icon="delete"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        Excluir
                      </Btn>
                      <Btn variant="ghostDark" icon="edit" onClick={() => setShowEditModal(true)}>
                        Editar
                      </Btn>
                    </div>
                  </div>
                  <h2 className="font-headline font-black text-2xl tracking-tighter mt-3">
                    {tituloOcorrencia(selecionada)}
                  </h2>
                  {selecionada.zona != null && (
                    <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
                      <Icon name="location_on" className="text-[14px]" />
                      {zonaLookup.get(selecionada.zona) ?? `Zona #${selecionada.zona}`}
                    </p>
                  )}
                </div>

                <div className="sticky top-0 z-10 flex border-b border-outline-variant/20 bg-white px-6 pt-3">
                  <button
                    type="button"
                    onClick={() => setDetailTab("detalhes")}
                    className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-[11px] font-black uppercase tracking-mono-tight transition-colors ${
                      detailTab === "detalhes"
                        ? "border-secondary text-secondary"
                        : "border-transparent text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    <Icon name="description" className="text-[17px]" />
                    Detalhes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("historico")}
                    className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-[11px] font-black uppercase tracking-mono-tight transition-colors ${
                      detailTab === "historico"
                        ? "border-secondary text-secondary"
                        : "border-transparent text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    <Icon name="history" className="text-[17px]" />
                    Histórico
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] text-primary">
                      {historicoSelecionado.length}
                    </span>
                  </button>
                </div>

                {detailTab === "detalhes" && (
                <div className="p-6 space-y-6">
                  {/* endereço por extenso */}
                  <div className="card-recessed p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon name="location_on" filled className="text-[18px] text-secondary" />
                      <MetaTag>LOCALIZAÇÃO</MetaTag>
                    </div>

                    {selecionada.endereco && (
                      <p className="mb-4 text-[13px] font-bold leading-relaxed text-primary">
                        {selecionada.endereco}
                      </p>
                    )}

                    {selecionada.coordenadas ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-outline-variant/20 bg-white p-3">
                          <MetaTag className="mb-1 block">Latitude</MetaTag>
                          <p className="font-mono text-sm font-bold text-primary">
                            {selecionada.coordenadas.lat.toFixed(6).replace(".", ",")}
                          </p>
                        </div>
                        <div className="rounded-lg border border-outline-variant/20 bg-white p-3">
                          <MetaTag className="mb-1 block">Longitude</MetaTag>
                          <p className="font-mono text-sm font-bold text-primary">
                            {selecionada.coordenadas.lng.toFixed(6).replace(".", ",")}
                          </p>
                        </div>
                      </div>
                    ) : !selecionada.endereco ? (
                      <p className="text-[13px] font-medium text-on-surface-variant">
                        Localização não informada
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={googleMapsUrl(selecionada.coordenadas, selecionada.endereco)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-mono-tight text-secondary transition-all hover:bg-secondary/15"
                      >
                        <Icon name="map" className="text-[16px]" /> Abrir no mapa
                      </a>
                    </div>
                  </div>

                  {/* descricao (relato) */}
                  <div>
                    <MetaTag className="block mb-2">RELATO</MetaTag>
                    <p className="text-[13px] text-on-surface leading-relaxed">
                      {relatoSelecionado.relato}
                    </p>

                    {relatoSelecionado.marcacoes.length > 0 && (
                      <div className="mt-4 rounded-lg bg-secondary/10 p-4">
                        <MetaTag className="mb-2 block text-secondary">INFORMAÇÕES MARCADAS NO FORMULÁRIO</MetaTag>
                        <div className="flex flex-wrap gap-2">
                          {relatoSelecionado.marcacoes.map((item) => (
                            <Chip key={item} tone="secondary" icon="check">{item}</Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {selecionada.autor != null && (
                      <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-on-surface-variant">
                        <span className="flex items-center gap-1.5">
                          <Icon name="person" className="text-[14px]" />
                          {usuarioLookup.get(selecionada.autor) ??
                            `Usuário #${selecionada.autor}`}
                        </span>
                      </div>
                    )}

                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(selecionada.created_at)}
                    </span>
                  </div>

                  <div className="card-recessed p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon name="description" filled className="text-[18px] text-secondary" />
                      <MetaTag>DADOS DO REGISTRO</MetaTag>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div><MetaTag className="mb-1 block">STATUS</MetaTag><p className="font-bold text-primary">{STATUS_OCORRENCIA_LABEL[selecionada.status] ?? selecionada.status}</p></div>
                      <div><MetaTag className="mb-1 block">CATEGORIA</MetaTag><p className="font-bold text-primary">{CATEGORIA_LABEL[selecionada.categoria] ?? selecionada.categoria}</p></div>
                      <div><MetaTag className="mb-1 block">ORIGEM</MetaTag><p className="font-bold text-primary">{selecionada.cidadao != null && selecionada.autor == null ? "Formulário público" : "Registro interno"}</p></div>
                      <div><MetaTag className="mb-1 block">EVENTO</MetaTag><p className="font-bold text-primary">{selecionada.evento != null ? eventos.find((evento) => evento.id === selecionada.evento)?.nome ?? `Evento #${selecionada.evento}` : "Não vinculado"}</p></div>
                      <div><MetaTag className="mb-1 block">ZONA</MetaTag><p className="font-bold text-primary">{selecionada.zona != null ? zonaLookup.get(selecionada.zona) ?? `Zona #${selecionada.zona}` : "Não vinculada"}</p></div>
                      <div><MetaTag className="mb-1 block">RESPONSÁVEL</MetaTag><p className="font-bold text-primary">{selecionada.tecnico_responsavel != null ? usuarioLookup.get(selecionada.tecnico_responsavel) ?? `Usuário #${selecionada.tecnico_responsavel}` : "Não atribuído"}</p></div>
                    </div>
                  </div>

                  <div className="card-recessed p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon name="payments" filled className="text-[18px] text-secondary" />
                      <MetaTag>DANOS E CUSTOS</MetaTag>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white p-3">
                        <MetaTag className="mb-1 block">CUSTO DOS DANOS</MetaTag>
                        <p className="font-headline text-lg font-black text-primary">
                          {Number(selecionada.custo_danos || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <MetaTag className="mb-1 block">ITENS REGISTRADOS</MetaTag>
                        <p className="font-headline text-lg font-black text-primary">
                          {selecionada.total_itens_danos ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-outline-variant/20 pt-4">
                      <MetaTag className="mb-3 block">ITENS DE DANOS</MetaTag>

                      {carregandoDanos ? (
                        <p className="text-xs text-on-surface-variant">Carregando itens…</p>
                      ) : erroDanos ? (
                        <p className="text-xs font-semibold text-error">{erroDanos}</p>
                      ) : danosSelecionados.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">
                          Nenhum item de dano foi registrado nesta ocorrência.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(mostrarTodosDanos ? danosSelecionados : danosSelecionados.slice(0, 4)).map((dano) => (
                            <div key={dano.id} className="rounded-lg bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-bold text-primary">
                                    {dano.item_nome}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-on-surface-variant">
                                    {categoriaLabel(dano.categoria)} · {formatDate(dano.created_at)}
                                  </p>
                                </div>
                                <p className="shrink-0 text-[12px] font-black text-primary">
                                  {Number(dano.valor_total || 0).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </p>
                              </div>
                              <p className="mt-2 text-[11px] text-on-surface-variant">
                                {dano.quantidade} {dano.unidade} × {Number(dano.valor_unitario_aplicado || 0).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </p>
                              {dano.observacoes && (
                                <p className="mt-2 rounded-md bg-surface-container-low px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                                  {dano.observacoes}
                                </p>
                              )}
                            </div>
                          ))}

                          {danosSelecionados.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setMostrarTodosDanos((atual) => !atual)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-mono-tight text-secondary transition-colors hover:bg-secondary/10"
                            >
                              {mostrarTodosDanos ? "Mostrar menos" : `Ver todos os ${danosSelecionados.length} itens`}
                              <Icon name={mostrarTodosDanos ? "expand_less" : "expand_more"} className="text-[16px]" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* analise de ia */}
                  {selecionada.feito_ia && (
                    <div className="card-recessed p-4 border-l-4 border-secondary">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="psychology"
                          filled
                          className="text-secondary text-[18px]"
                        />
                        <MetaTag className="text-secondary">
                          ANÁLISE DE IA
                        </MetaTag>
                      </div>

                      {selecionada.analise_ia && (
                        <p className="text-[13px] text-on-surface leading-relaxed mb-3">
                          {selecionada.analise_ia}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {selecionada.nivel_perigo_ia && (
                          <Chip tone={statusToneFor(selecionada.nivel_perigo_ia)}>
                            {selecionada.nivel_perigo_ia}
                          </Chip>
                        )}
                        <Chip tone={selecionada.valido_ia ? "secondary" : "warning"}>
                          {selecionada.valido_ia
                            ? "VALIDA"
                            : "INVÁLIDA"}
                        </Chip>
                      </div>
                    </div>
                  )}

                  {!selecionada.feito_ia && (
                    <div className="card-recessed p-4 border-l-4 border-outline-variant">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="psychology"
                          className="text-on-surface-variant text-[18px]"
                        />
                        <MetaTag>ANÁLISE DE IA</MetaTag>
                      </div>
                      <p className="text-[12px] text-on-surface-variant">
                        Análise de IA pendente para esta ocorrência.
                      </p>
                    </div>
                  )}

                  {/* analise tecnica */}
                  {selecionada.analise_tecnico && (
                    <div className="card-recessed p-4 border-l-4 border-primary">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="engineering"
                          className="text-primary text-[18px]"
                        />
                        <MetaTag className="text-primary">
                          ANÁLISE TÉCNICA
                        </MetaTag>
                      </div>

                      <p className="text-[13px] text-on-surface leading-relaxed mb-3">
                        {selecionada.analise_tecnico}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {selecionada.nivel_perigo_tecnico && (
                          <Chip tone={statusToneFor(selecionada.nivel_perigo_tecnico)}>
                            {selecionada.nivel_perigo_tecnico}
                          </Chip>
                        )}
                        {selecionada.valido_tecnico != null && (
                          <Chip tone={selecionada.valido_tecnico ? "secondary" : "warning"}>
                            {selecionada.valido_tecnico
                              ? "VALIDADA"
                              : "REJEITADA"}
                          </Chip>
                        )}
                      </div>
                    </div>
                  )}

                  {/* anexos */}
                  <div>
                    <MetaTag className="block mb-2">
                      ANEXOS ({selecionada.anexos.length})
                    </MetaTag>
                    {selecionada.anexos.length === 0 ? (
                      <p className="text-[12px] text-on-surface-variant italic">
                        Nenhum arquivo anexado a esta ocorrência.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(selecionada.anexos as OcorrenciaAnexo[]).map((a, i) => {
                          const nome = a.arquivo?.nome ?? `Arquivo ${i + 1}`;
                          const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
                          const tipo = ["mp4", "webm", "mov", "avi"].includes(extensao)
                            ? "video"
                            : ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extensao)
                              ? "foto"
                              : "documento";
                          const icone =
                            tipo === "video"
                              ? "movie"
                              : tipo === "documento"
                                ? "description"
                                : "image";
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => void abrirAnexo(a)}
                              className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-all text-left"
                            >
                              <div
                                className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${tipo === "video"
                                  ? "bg-orange-100"
                                  : tipo === "documento"
                                    ? "bg-primary/8"
                                    : "bg-secondary/10"
                                  }`}
                              >
                                <Icon
                                  name={icone}
                                  filled
                                  className={`text-[20px] ${tipo === "video"
                                    ? "text-orange-700"
                                    : tipo === "documento"
                                      ? "text-primary"
                                      : "text-secondary"
                                    }`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-bold text-primary truncate">
                                  {nome}
                                </p>
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                                  {tipo} · {extensao || "arquivo"}
                                </p>
                              </div>
                              <Icon
                                name="open_in_new"
                                className="text-on-surface-variant text-[16px] shrink-0"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                )}

                {detailTab === "historico" && (
                  <div className="p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <MetaTag className="mb-1 block">AUDITORIA</MetaTag>
                        <h3 className="font-headline text-xl font-black tracking-tight text-primary">
                          Histórico da ocorrência
                        </h3>
                      </div>
                      <Chip tone="neutral">
                        {historicoSelecionado.length} registro
                        {historicoSelecionado.length !== 1 ? "s" : ""}
                      </Chip>
                    </div>

                    {historicoSelecionado.length === 0 ? (
                      <div className="flex flex-col items-center rounded-xl bg-surface-container-low px-5 py-10 text-center">
                        <Icon name="history_toggle_off" className="mb-3 text-[36px] text-on-surface-variant" />
                        <p className="text-[12px] text-on-surface-variant">
                          Nenhuma alteração registrada para esta ocorrência.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {historicoSelecionado.map((registro) => {
                          const campos = (registro.campos_alterados ?? []).filter(
                            (campo) => campo !== "id",
                          );
                          const acaoLabel =
                            registro.tipo_acao === "criacao"
                              ? "Ocorrência criada"
                              : registro.tipo_acao === "exclusao"
                                ? "Ocorrência excluída"
                                : "Ocorrência editada";
                          const acaoIcon =
                            registro.tipo_acao === "criacao"
                              ? "add_circle"
                              : registro.tipo_acao === "exclusao"
                                ? "delete"
                                : "edit";

                          return (
                            <details key={registro.id} className="group rounded-xl bg-surface-container-low">
                              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-secondary">
                                  <Icon name={acaoIcon} className="text-[18px]" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-bold text-primary">{acaoLabel}</p>
                                  <p className="mt-1 text-[10px] font-medium text-on-surface-variant">
                                    {formatDate(registro.criado_em)} · {registro.usuario != null
                                      ? usuarioLookup.get(registro.usuario) ?? `Usuário #${registro.usuario}`
                                      : "Sistema"}
                                  </p>
                                </div>
                                <Icon name="expand_more" className="text-[18px] text-on-surface-variant transition-transform group-open:rotate-180" />
                              </summary>

                              <div className="border-t border-outline-variant/20 px-4 pb-4 pt-3">
                                {campos.length === 0 ? (
                                  <p className="text-[11px] text-on-surface-variant">
                                    {registro.tipo_acao === "criacao"
                                      ? "Registro inicial da ocorrência."
                                      : "Nenhum campo alterado foi informado."}
                                  </p>
                                ) : (
                                  <div className="space-y-3">
                                    {campos.map((campo) => (
                                      <div key={campo}>
                                        <MetaTag className="mb-1.5 block">
                                          {CAMPO_HISTORICO_LABEL[campo] ?? campo.replaceAll("_", " ")}
                                        </MetaTag>
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]">
                                          <span className="min-w-0 break-words rounded-lg bg-white p-2 text-on-surface-variant">
                                            {formatHistoryFieldValue(campo, registro.dados_anteriores?.[campo])}
                                          </span>
                                          <Icon name="arrow_forward" className="text-[15px] text-secondary" />
                                          <span className="min-w-0 break-words rounded-lg bg-secondary/10 p-2 font-semibold text-primary">
                                            {formatHistoryFieldValue(campo, registro.dados_novos?.[campo])}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      <CreateOccurrenceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchData();
        }}
        zonas={Array.from(zonaLookup.entries()).map(([id, nome]) => ({ id, nome }))}
      />

      <ModalShell
        open={showGroupModal}
        onClose={() => {
          if (!agrupando) setShowGroupModal(false);
        }}
        maxWidth="max-w-lg"
      >
        <div className="bg-surface-container-low px-8 py-6">
          <MetaTag>VINCULAR A EVENTO</MetaTag>
          <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">
            Agrupar ocorrências
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            {marcadas.length} ocorrências selecionadas
          </p>
        </div>
        <div className="space-y-4 p-8">
          <label className="block">
            <MetaTag className="mb-2 block">Evento de destino</MetaTag>
            <div className="relative">
              <select
                value={eventoAgrupamentoId ?? ""}
                onChange={(event) => {
                  setEventoAgrupamentoId(event.target.value ? Number(event.target.value) : null);
                  setErroAgrupamento("");
                }}
                disabled={agrupando}
                className={`w-full appearance-none rounded-lg border-none bg-surface-container-low py-3.5 pl-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-secondary ${
                  eventoAgrupamentoId === null ? "text-on-surface-variant" : "text-primary"
                }`}
              >
                <option value="">Selecione um evento</option>
                {eventos.map((evento) => (
                  <option key={evento.id} value={evento.id}>
                    #{evento.id} · {evento.nome}
                  </option>
                ))}
              </select>
              <Icon
                name="keyboard_arrow_down"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-primary"
              />
            </div>
          </label>
          {erroAgrupamento && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-error-container p-4 text-sm font-medium text-on-error-container">
              <Icon name="error" filled className="shrink-0 text-[20px] text-error" />
              <p>{erroAgrupamento}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-outline-variant/20 px-8 py-5">
          <Btn variant="secondary" onClick={() => setShowGroupModal(false)} disabled={agrupando} full>
            Cancelar
          </Btn>
          <Btn variant="success" icon="cyclone" onClick={confirmarAgrupamento} disabled={agrupando} full>
            {agrupando ? "Vinculando…" : "Vincular ocorrências"}
          </Btn>
        </div>
      </ModalShell>

      {selecionada && (
        <>
          <EditOccurrenceModal
            open={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSaved={() => {
              setShowEditModal(false);
              fetchData();
            }}
            zonas={Array.from(zonaLookup.entries()).map(([id, nome]) => ({ id, nome }))}
            ocorrencia={selecionada}
          />
          <DeleteOccurrenceModal
            open={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onDeleted={() => {
              setShowDeleteModal(false);
              fetchData();
            }}
            ocorrencia={selecionada}
          />
        </>
      )}
    </div>
  );
}

export default function OccurrencesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-on-surface-variant">
          Carregando ocorrências…
        </div>
      }
    >
      <OccurrencesContent />
    </Suspense>
  );
}
