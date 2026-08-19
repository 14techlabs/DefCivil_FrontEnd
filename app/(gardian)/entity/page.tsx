"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot, Tab } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { api } from "@/app/services/Api";
import {
  PontoApoioFormModal,
  type Apoio,
} from "@/app/components/PontoApoioFormModal";
import { useGardian } from "@/app/components/GardianContext";
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

export default function EntityPage() {
  const { showToast, user } = useGardian();
  const entidadeId = user?.entidade;

  const [tab, setTab] = useState<"status" | "formulario" | "contas" | "apoios">("status");
  const [entidade, setEntidade] = useState<EntityApiData | null>(null);
  const [entidadeLoading, setEntidadeLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistApiItem[]>([]);
  const [config, setConfig] = useState<FormUiConfig>(EMPTY_FORM_CONFIG);
  const [contasBackend, setContasBackend] = useState<ContaEventoView[]>([]);
  const [exercicio, setExercicio] = useState<number | "todos">("todos");
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaDraft, setFichaDraft] = useState<EntidadeDraft>({ sigla: "", telefone: "", email: "", endereco: "", responsavel: null });
  const [responsaveis, setResponsaveis] = useState<UsuarioResponsavel[]>([]);
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
  const [pontosLoading, setPontosLoading] = useState(true);
  const [pontoFormOpen, setPontoFormOpen] = useState(false);
  const [pontoEditando, setPontoEditando] = useState<Apoio | null>(null);
  const [pontoExcluindo, setPontoExcluindo] = useState<Apoio | null>(null);

  const fetchEntidadeEChecklist = useCallback(async () => {
    if (!entidadeId) return;
    setEntidadeLoading(true);
    const [entidadeResult, checklistResult] = await Promise.allSettled([
      api.get<EntityApiData>(`/entidades/${entidadeId}/`),
      api.get<ChecklistApiItem[]>("/entidades/checklist/"),
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
    setConfig((current) => ({
      ...current,
      checklist: checklistItems.map((item) => ({ ...item, id: String(item.id) })),
    }));
    setEntidadeLoading(false);
  }, [entidadeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchEntidadeEChecklist(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchEntidadeEChecklist]);

  useEffect(() => {
    api.get<UsuarioResponsavel[]>("/usuarios/")
      .then((response) => setResponsaveis(response.data ?? []))
      .catch(() => setResponsaveis([]));
  }, []);

  useEffect(() => {
    if (!entidadeId) return;
    let cancelled = false;
    Promise.allSettled([
      api.get<{ eventos: EventoFinanceiro[] }>("/eventos/"),
      api.get<{ ocorrencias: OcorrenciaFinanceira[] }>("/ocorrencias/"),
      api.get<{ prestacoes: PrestacaoApi[] }>("/eventos/prestacoes/"),
    ]).then(([eventoResult, ocorrenciaResult, prestacaoResult]) => {
      if (cancelled) return;
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
    });
    return () => {
      cancelled = true;
    };
  }, [entidadeId]);

  /* ── pontos de apoio ── */

  const fetchPontos = useCallback(() => {
    let cancelled = false;
    setPontosLoading(true);
    api
      .get<Apoio[]>("/apoios/")
      .then((res) => {
        if (!cancelled) setPontos(res.data);
      })
      .catch(() => {
        if (!cancelled) setPontos([]);
      })
      .finally(() => {
        if (!cancelled) setPontosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchPontos(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchPontos]);

  const excluirPonto = async (ponto: Apoio) => {
    try {
      await api.delete(`/apoios/${ponto.id}/`);
      setPontos((prev) => prev.filter((p) => p.id !== ponto.id));
      showToast("Ponto de apoio excluído.");
    } catch {
      showToast("Erro ao excluir ponto de apoio.", "error");
    } finally {
      setPontoExcluindo(null);
    }
  };

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
      showToast("Informe o motivo da mudança de situação.", "error");
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
      showToast("A configuração de categorias ainda não está disponível.", "error");
      return;
    }
    const item = checklist.find((current) => current.id === Number(id));
    if (item) void toggleChecklist(item);
  };

  const removerCampo = (grupo: "categorias" | "checklist", id: string) => {
    if (grupo === "categorias") return;
    const item = checklist.find((current) => current.id === Number(id));
    if (item) void removerChecklist(item);
  };

  const adicionarCampo = (grupo: "categorias" | "checklist") => {
    if (grupo === "categorias") {
      showToast("A configuração de categorias ainda não está disponível.", "error");
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
    return <div className="p-8 text-sm text-on-surface-variant">Carregando entidade…</div>;
  }

  if (!entidade) {
    return <div className="p-8 text-sm text-error">Não foi possível carregar a entidade.</div>;
  }

  const statusCidade = entidade.status == null ? null : STATUS_FROM_API[entidade.status] ?? null;
  const statusMeta = statusCidade
    ? STATUS_CIDADE_META[statusCidade]
    : { label: "Não informado", cor: "#64748B", tone: "neutral" as const };
  const categoriasAtivas = 0;
  const checksAtivos = checklist.filter((item) => item.ativo).length;

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
              <MetaTag className="block">SITUAÇÃO DO MUNICÍPIO</MetaTag>
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
            { icon: "emergency_home", l: "Situação", v: statusMeta.label },
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
        <Tab active={tab === "status"} onClick={() => setTab("status")} icon="emergency_home">
          Situação do Município
        </Tab>
        <Tab active={tab === "formulario"} onClick={() => setTab("formulario")} icon="dynamic_form">
          Formulário Externo
        </Tab>
        <Tab active={tab === "contas"} onClick={() => setTab("contas")} icon="account_balance">
          Prestação de Contas
        </Tab>
        <Tab active={tab === "apoios"} onClick={() => setTab("apoios")} icon="home_work">
          Pontos de Apoio
        </Tab>
      </div>

      {/* ─────────── SITUAÇÃO DO MUNICÍPIO ─────────── */}
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
                  placeholder="Descreva o motivo da mudança de situação"
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
                  Nenhuma alteração de situação foi registrada até o momento.
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
                    <p className="text-[11px] font-black uppercase tracking-mono-tight text-primary">
                      Configuração geral indisponível
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 max-w-[170px]">
                      Esta opção ainda não está disponível.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    aria-label="Ativar ou desativar o formulário"
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

          <div className="grid grid-cols-12 gap-5 items-start">
            {/* textos e regras */}
            <section className="col-span-12 lg:col-span-5 space-y-5">
              <div className="card-tonal p-7 shadow-ambient-sm">
                <SectionHeader overline="APRESENTAÇÃO" title="Textos do Formulário" />
                <div className="space-y-4">
                  <div>
                    <MetaTag className="block mb-1.5">TÍTULO</MetaTag>
                    <input
                      value={config.titulo}
                      disabled
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">SUBTÍTULO</MetaTag>
                    <textarea
                      value={config.subtitulo}
                      disabled
                      rows={2}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">TELEFONES DE EMERGÊNCIA</MetaTag>
                    <input
                      value={config.telefonesEmergencia}
                      disabled
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">MENSAGEM QUANDO DESATIVADO</MetaTag>
                    <textarea
                      value={config.mensagemDesativado}
                      disabled
                      rows={2}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="card-tonal p-7 shadow-ambient-sm">
                <SectionHeader overline="REGRAS DE PREENCHIMENTO" title="Exigências" />
                <div className="space-y-2">
                  {[
                    { id: "exigirLocalizacao", label: "Exigir localização (endereço ou coordenada)", icon: "location_on" },
                    { id: "permitirAnexos", label: "Permitir anexar fotos e vídeos", icon: "attach_file" },
                    { id: "exigirContato", label: "Exigir telefone de contato", icon: "call" },
                    { id: "mostrarAvisoEvento", label: "Exibir aviso do evento em andamento", icon: "campaign" },
                  ].map((r) => {
                    const ligado = config[r.id as keyof FormUiConfig] as boolean;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled
                        className={`w-full flex items-center gap-3 p-3.5 rounded-lg text-left transition-all ${ligado ? "bg-secondary/10 ring-1 ring-secondary/40" : "bg-surface-container-low"
                          }`}
                      >
                        <Icon
                          name={ligado ? "toggle_on" : "toggle_off"}
                          filled
                          className={`text-[24px] shrink-0 ${ligado ? "text-secondary" : "text-slate-300"}`}
                        />
                        <Icon
                          name={r.icon}
                          className={`text-[18px] shrink-0 ${ligado ? "text-secondary" : "text-on-surface-variant"}`}
                        />
                        <span className={`text-[12px] ${ligado ? "font-bold text-primary" : "text-on-surface"}`}>
                          {r.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 pt-5 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between mb-2">
                    <MetaTag>MÍNIMO DE CARACTERES NA DESCRIÇÃO</MetaTag>
                    <span className="text-[13px] font-black text-primary">
                      {config.minCaracteresDescricao}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={10}
                    value={config.minCaracteresDescricao}
                    disabled
                    className="w-full accent-[#006A60]"
                  />
                </div>
              </div>
            </section>

            {/* categorias e checklist */}
            <section className="col-span-12 lg:col-span-7 space-y-5">
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
                <div key={sec.grupo} className="card-tonal p-7 shadow-ambient-sm">
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

                  <div className="flex gap-2">
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
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Btn
                  variant="primary"
                  icon="cloud_done"
                  disabled
                >
                  Checklist salvo automaticamente
                </Btn>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ─────────── PRESTAÇÃO DE CONTAS ─────────── */}
      {tab === "contas" && (
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
      )}

      {/* ─────────── PONTOS DE APOIO ─────────── */}
      {tab === "apoios" && (
        <div className="space-y-5">
          {/* cabecalho */}
          <section className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <SectionHeader
                  overline="ABRIGO TEMPORÁRIO"
                  title="Pontos de Apoio"
                />
                <p className="text-[12px] text-on-surface-variant -mt-3 max-w-2xl">
                  Locais onde a população em risco pode ficar temporariamente durante uma calamidade
                  (escolas, igrejas, ginásios…).
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
                points={pontos
                  .filter((p) => p.coordenadas)
                  .map((p) => ({
                    id: p.id,
                    lat: p.coordenadas!.lat,
                    lng: p.coordenadas!.lng,
                    titulo: p.nome,
                    subtitulo: p.endereco || undefined,
                    kind: "ponto_apoio" as const,
                  }))}
                height={440}
              />
            </section>

            {/* lista + CRUD */}
            <section className="col-span-12 lg:col-span-5 space-y-3">
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
              ) : (
                pontos.map((p) => (
                  <div key={p.id} className="card-recessed p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                      <Icon name="home_work" className="text-secondary text-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-primary leading-snug">{p.nome}</p>
                      {p.endereco && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                          <Icon name="place" className="text-[13px]" /> {p.endereco}
                        </p>
                      )}
                      {p.descricao && (
                        <p className="text-[11px] text-on-surface-variant/80 mt-1 leading-snug">
                          {p.descricao}
                        </p>
                      )}
                      {p.coordenadas && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          {p.coordenadas.lat.toFixed(4)}, {p.coordenadas.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPontoEditando(p);
                          setPontoFormOpen(true);
                        }}
                        className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-center"
                        aria-label={`Editar ${p.nome}`}
                      >
                        <Icon name="edit" className="text-[15px] text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPontoExcluindo(p)}
                        className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-error/15 transition-colors flex items-center justify-center"
                        aria-label={`Excluir ${p.nome}`}
                      >
                        <Icon name="delete" className="text-[15px] text-red-600" />
                      </button>
                    </div>
                  </div>
                ))
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
              <select
                value={fichaDraft.responsavel ?? ""}
                onChange={(event) => setFichaDraft((atual) => ({ ...atual, responsavel: event.target.value ? Number(event.target.value) : null }))}
                className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary"
              >
                <option value="">Sem responsável</option>
                {responsaveis.map((responsavel) => (
                  <option key={responsavel.id} value={responsavel.id}>
                    {responsavel.user_sys?.first_name || responsavel.user_sys?.username || responsavel.nome_anonimo || responsavel.telefone}
                  </option>
                ))}
              </select>
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
                <MetaTag className="mb-1.5 block">SITUAÇÃO</MetaTag>
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
