"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_ENTIDADE,
  MOCK_STATUS_HISTORICO,
  MOCK_CONTAS_EVENTOS,
  MOCK_DANOS_CATALOGO,
  MOCK_DANOS_REGISTROS,
  MOCK_OCORRENCIAS,
  STATUS_CIDADE_META,
  STATUS_PRESTACAO_LABEL,
  formatBRL,
  type ConfigFormulario,
  type ContaEvento,
  type MockEntidade,
  type StatusCidade,
  type StatusCidadeRegistro,
} from "@/app/data/mock";
import { loadPublicFormConfig, savePublicFormConfig } from "@/app/lib/publicFormConfig";

/* custo do evento em curso, calculado a partir dos danos catalogados */
function custoCatalogado(eventoId: number): number {
  const catalogo = new Map(MOCK_DANOS_CATALOGO.map((c) => [c.id, c]));
  const ocs = MOCK_OCORRENCIAS.filter((o) => o.evento === eventoId).map((o) => o.id);
  return MOCK_DANOS_REGISTROS.filter((r) => ocs.includes(r.ocorrenciaId)).reduce(
    (acc, r) =>
      acc +
      r.itens.reduce(
        (a, it) => a + (catalogo.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade,
        0,
      ),
    0,
  );
}

const custoEvento = (c: ContaEvento): number =>
  c.custoConsolidado ?? (c.eventoId ? custoCatalogado(c.eventoId) : 0);

const STATUS_PRESTACAO_TONE: Record<
  ContaEvento["statusPrestacao"],
  "error" | "warning" | "secondary" | "neutral"
> = {
  em_curso: "error",
  em_elaboracao: "warning",
  enviada: "warning",
  aprovada: "secondary",
};

export default function EntityPage() {
  const { showToast } = useGardian();

  const [tab, setTab] = useState<"status" | "formulario" | "contas">("status");
  const [entidade, setEntidade] = useState<MockEntidade>(MOCK_ENTIDADE);
  const [historico, setHistorico] = useState<StatusCidadeRegistro[]>(MOCK_STATUS_HISTORICO);
  const [config, setConfig] = useState<ConfigFormulario>(loadPublicFormConfig);
  const [exercicio, setExercicio] = useState<number | "todos">("todos");

  // rascunho da mudança de status
  const [novoStatus, setNovoStatus] = useState<StatusCidade>(MOCK_ENTIDADE.statusCidade);
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState(MOCK_ENTIDADE.mensagemPublica);

  // rascunhos de novos itens do formulário
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCheck, setNovoCheck] = useState("");

  useEffect(() => {
    savePublicFormConfig(config);
  }, [config]);

  /* ── status da cidade ── */

  const aplicarStatus = () => {
    if (novoStatus === entidade.statusCidade && mensagem === entidade.mensagemPublica) {
      showToast("Nenhuma alteração para aplicar.", "error");
      return;
    }
    if (novoStatus !== entidade.statusCidade && !motivo.trim()) {
      showToast("Descreva o motivo da mudança de status.", "error");
      return;
    }
    if (novoStatus !== entidade.statusCidade) {
      setHistorico((prev) => [
        {
          id: prev.length + 1,
          status: novoStatus,
          quando: new Date().toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          autor: entidade.responsavel,
          motivo: motivo.trim(),
        },
        ...prev,
      ]);
    }
    setEntidade((e) => ({ ...e, statusCidade: novoStatus, mensagemPublica: mensagem }));
    setMotivo("");
    showToast(`Município marcado como ${STATUS_CIDADE_META[novoStatus].label.toLowerCase()}.`);
  };

  /* ── formulário público ── */

  const toggleCampo = (grupo: "categorias" | "checklist", id: string) =>
    setConfig((c) => ({
      ...c,
      [grupo]: c[grupo].map((x) => (x.id === id ? { ...x, ativo: !x.ativo } : x)),
    }));

  const removerCampo = (grupo: "categorias" | "checklist", id: string) =>
    setConfig((c) => ({ ...c, [grupo]: c[grupo].filter((x) => x.id !== id) }));

  const adicionarCampo = (grupo: "categorias" | "checklist") => {
    const label = (grupo === "categorias" ? novaCategoria : novoCheck).trim();
    if (!label) {
      showToast("Escreva o texto do item antes de adicionar.", "error");
      return;
    }
    const id = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    setConfig((c) => ({
      ...c,
      [grupo]: [
        ...c[grupo],
        { id, label, icon: grupo === "categorias" ? "category" : "check_circle", ativo: true },
      ],
    }));
    if (grupo === "categorias") setNovaCategoria("");
    else setNovoCheck("");
    showToast("Item adicionado ao formulário público.");
  };

  /* ── prestação de contas ── */

  const contas = useMemo(
    () =>
      exercicio === "todos"
        ? MOCK_CONTAS_EVENTOS
        : MOCK_CONTAS_EVENTOS.filter((c) => c.exercicio === exercicio),
    [exercicio],
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
    () => [...new Set(MOCK_CONTAS_EVENTOS.map((c) => c.exercicio))].sort((a, b) => b - a),
    [],
  );

  const statusMeta = STATUS_CIDADE_META[entidade.statusCidade];
  const categoriasAtivas = config.categorias.filter((c) => c.ativo).length;
  const checksAtivos = config.checklist.filter((c) => c.ativo).length;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* ── Cabeçalho ── */}
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ENTIDADE · {entidade.sigla.toUpperCase()}</MetaTag>
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
            <Chip tone="primarySoft" icon="location_city">
              {entidade.municipio}/{entidade.uf} · {entidade.populacao.toLocaleString("pt-BR")} HAB.
            </Chip>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: "badge", l: "Responsável", v: `${entidade.responsavel} — ${entidade.cargoResponsavel}` },
            { icon: "call", l: "Telefone", v: entidade.telefone },
            { icon: "mail", l: "E-mail", v: entidade.email },
            { icon: "home_pin", l: "Endereço", v: entidade.endereco },
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
              O status define o regime de operação da equipe e o aviso exibido no canal público.
              Toda mudança fica registrada com autor e motivo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {(Object.keys(STATUS_CIDADE_META) as StatusCidade[]).map((k) => {
                const meta = STATUS_CIDADE_META[k];
                const selecionado = novoStatus === k;
                const atual = entidade.statusCidade === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setNovoStatus(k)}
                    className={`p-5 rounded-xl text-left transition-all ${
                      selecionado ? "text-white shadow-ambient" : "card-recessed hover:shadow-ambient-sm"
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
                          className={`text-[9px] font-black uppercase tracking-mono px-2 py-1 rounded ${
                            selecionado ? "bg-white/20 text-white" : "bg-surface-container text-on-surface-variant"
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
                      className={`text-[11px] leading-relaxed mt-1.5 ${
                        selecionado ? "text-white/80" : "text-on-surface-variant"
                      }`}
                    >
                      {meta.descricao}
                    </p>
                  </button>
                );
              })}
            </div>

            {novoStatus !== entidade.statusCidade && (
              <div className="mb-5">
                <MetaTag className="block mb-1.5">MOTIVO DA MUDANÇA</MetaTag>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Ex.: pico de ocorrências e saturação de solo acima do limiar"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                />
              </div>
            )}

            <div className="mb-5">
              <MetaTag className="block mb-1.5">MENSAGEM EXIBIDA NO CANAL PÚBLICO</MetaTag>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Btn variant="primary" icon="publish" onClick={aplicarStatus}>
                Aplicar status
              </Btn>
              <Btn
                variant="ghost"
                icon="undo"
                onClick={() => {
                  setNovoStatus(entidade.statusCidade);
                  setMensagem(entidade.mensagemPublica);
                  setMotivo("");
                }}
              >
                Descartar alterações
              </Btn>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-5 space-y-5">
            {/* pré-visualização do aviso público */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="PRÉ-VISUALIZAÇÃO" title="Aviso ao Cidadão" />
              <div
                className="rounded-xl p-6 text-white"
                style={{ background: STATUS_CIDADE_META[novoStatus].cor }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={STATUS_CIDADE_META[novoStatus].icon} filled className="text-[20px]" />
                  <span className="text-[11px] font-black uppercase tracking-mono">
                    Município {STATUS_CIDADE_META[novoStatus].label}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-white/90">{mensagem}</p>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-4 flex items-start gap-1.5">
                <Icon name="info" className="text-[14px] mt-0.5" />
                Este bloco aparece no topo do formulário público em /report e na página inicial da cidade.
              </p>
            </div>

            {/* histórico */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="RASTREABILIDADE" title="Histórico de Status" />
              <div className="relative pl-6">
                <span className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/50" />
                <div className="space-y-5">
                  {historico.map((h) => {
                    const meta = STATUS_CIDADE_META[h.status];
                    return (
                      <div key={h.id} className="relative">
                        <span
                          className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                          style={{ background: meta.cor }}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[11px] font-black uppercase tracking-mono-tight"
                            style={{ color: meta.cor }}
                          >
                            {meta.label}
                          </span>
                          <MetaTag>{h.quando}</MetaTag>
                        </div>
                        <p className="text-[12px] text-on-surface mt-1 leading-relaxed">{h.motivo}</p>
                        <p className="text-[10px] font-bold uppercase tracking-mono-tight text-slate-400 mt-1">
                          por {h.autor}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  Configure o que a população vê e informa ao registrar uma ocorrência em
                  <span className="font-mono font-bold text-primary"> /report</span>.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-secondary">
                  <Icon name="sync" className="text-[15px]" />
                  Alterações aplicadas automaticamente ao formulário público neste navegador.
                </p>
              </div>

              <div className="card-recessed p-5 min-w-[260px]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-mono-tight text-primary">
                      Canal {config.ativo ? "no ar" : "desativado"}
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 max-w-[170px]">
                      {config.ativo
                        ? "A população pode registrar ocorrências agora."
                        : "Quem acessar verá apenas a mensagem de indisponibilidade."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfig((c) => ({ ...c, ativo: !c.ativo }));
                      showToast(
                        config.ativo ? "Formulário público desativado." : "Formulário público reativado.",
                        config.ativo ? "error" : "secondary",
                      );
                    }}
                    aria-label="Ativar ou desativar o formulário"
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                      config.ativo ? "bg-secondary" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        config.ativo ? "left-6" : "left-1"
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
                      onChange={(e) => setConfig((c) => ({ ...c, titulo: e.target.value }))}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">SUBTÍTULO</MetaTag>
                    <textarea
                      value={config.subtitulo}
                      onChange={(e) => setConfig((c) => ({ ...c, subtitulo: e.target.value }))}
                      rows={2}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">TELEFONES DE EMERGÊNCIA</MetaTag>
                    <input
                      value={config.telefonesEmergencia}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, telefonesEmergencia: e.target.value }))
                      }
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </div>
                  <div>
                    <MetaTag className="block mb-1.5">MENSAGEM QUANDO DESATIVADO</MetaTag>
                    <textarea
                      value={config.mensagemDesativado}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, mensagemDesativado: e.target.value }))
                      }
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
                    const ligado = config[r.id as keyof ConfigFormulario] as boolean;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setConfig((c) => ({ ...c, [r.id]: !ligado }))}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-lg text-left transition-all ${
                          ligado ? "bg-secondary/10 ring-1 ring-secondary/40" : "bg-surface-container-low"
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
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, minCaracteresDescricao: Number(e.target.value) }))
                    }
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
                        className={`flex items-center gap-3 p-3.5 rounded-lg transition-all ${
                          item.ativo ? "bg-surface-container-low" : "bg-surface-container-low opacity-50"
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
                  icon="save"
                  onClick={() => showToast("Configuração do formulário público publicada.")}
                >
                  Publicar configuração
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
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                exercicio === "todos"
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
                className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                  exercicio === ex
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
              onClick={() =>
                showToast(
                  `Prestação de contas (${exercicio === "todos" ? "todos os exercícios" : exercicio}) exportada.`,
                )
              }
            >
              Exportar prestação
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
              label="Repasses Recebidos"
              value={formatBRL(totais.repasse)}
              icon="account_balance"
              tone="secondary"
              sub="Transferências e convênios"
            />
            <KPI
              label="Custeado pelo Município"
              value={formatBRL(totais.proprio)}
              icon="savings"
              tone="warning"
              sub={`${totais.custo ? Math.round((totais.proprio / totais.custo) * 100) : 0}% do total`}
            />
            <KPI
              label="Prestações Pendentes"
              value={totais.pendentes}
              icon="pending_actions"
              tone={totais.pendentes > 0 ? "warning" : "secondary"}
              sub="Não aprovadas"
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
                  const pctRepasse = custo ? (c.repasseRecebido / custo) * 100 : 0;
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
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-secondary"
                            style={{ width: `${((custo / maior) * pctRepasse) / 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-headline font-black text-lg text-primary tracking-tighter">
                          {formatBRL(custo)}
                        </p>
                        <MetaTag>
                          {c.repasseRecebido > 0
                            ? `${Math.round(pctRepasse)}% COBERTO POR REPASSE`
                            : "SEM REPASSE"}
                        </MetaTag>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center gap-5 mt-5 pt-4 border-t border-outline-variant/20">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                <span className="w-3 h-3 rounded-sm bg-secondary" /> Coberto por repasse
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                <span className="w-3 h-3 rounded-sm bg-error/70" /> Custeado pelo município
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
                        {c.decretoMunicipal ?? "Sem decreto"}
                      </p>
                      <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">
                        {c.fonteRecurso}
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
                      {c.custoConsolidado === null && (
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
                      <Chip tone={STATUS_PRESTACAO_TONE[c.statusPrestacao]}>
                        {STATUS_PRESTACAO_LABEL[c.statusPrestacao]}
                      </Chip>
                      <p className="text-[10px] text-on-surface-variant mt-1.5 max-w-[180px] leading-snug">
                        {c.observacao}
                      </p>
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
    </div>
  );
}
