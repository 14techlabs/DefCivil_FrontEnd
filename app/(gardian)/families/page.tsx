// DefCivil_FrontEnd/app/(gardian)/families/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import { CreateFamilyModal } from "@/app/components/CreateFamilyModal";
import {
  DesligarCidadaoModal,
  EditFamilyModal,
  TransferCidadaoModal,
} from "@/app/components/FamilyModals";

/* ── tipos vindos da API (GET /familias/) ── */

type Cidadao = {
  id: number;
  nome: string;
  cpf: string | null;
  cpf_formatado: string;
  data_nascimento: string | null;
  idade: number | null; // calculada no backend a partir da data
  parentesco: string;
  responsavel: boolean;
  telefone: string;
  necessidade_especial: string;
  ativo: boolean;
  motivo_desligamento: string;
  motivo_label: string;
  data_desligamento: string | null;
  observacao_desligamento: string;
};

type Animal = {
  id: number;
  nome: string;
  especie: string;
  porte: "pequeno" | "medio" | "grande";
  porte_label: string;
  observacoes: string;
};

type OcorrenciaResumo = {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  created_at: string;
};

type Familia = {
  id: number;
  nome: string;
  endereco: string;
  telefone: string;
  coordenadas: { lat: number; lng: number } | null;
  zona: number | null;
  zona_nome: string | null;
  zona_status: string | null;
  area_de_risco: boolean;
  observacoes: string;
  cidadaos: Cidadao[];
  cidadaos_desligados: Cidadao[];
  animais: Animal[];
  total_cidadaos: number;
  total_animais: number;
  ocorrencias: OcorrenciaResumo[];
};

type ListaResposta = {
  familias: Familia[];
  total_familias: number;
  total_pessoas: number;
  total_animais: number;
  total_em_risco: number;
};

type ZonaResumo = { id: number; nome: string };

const PORTES: Animal["porte"][] = ["pequeno", "medio", "grande"];

function mapsUrl(c: Familia["coordenadas"]) {
  if (!c) return null;
  return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
}

export default function FamiliesPage() {
  const { showToast } = useGardian();

  const [dados, setDados] = useState<ListaResposta | null>(null);
  const [zonas, setZonas] = useState<ZonaResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [busca, setBusca] = useState("");
  const [filtroZona, setFiltroZona] = useState<number | "todas" | "sem_zona">("todas");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [novoCidadao, setNovoCidadao] = useState({ nome: "", cpf: "", nascimento: "", parentesco: "" });
  const [novoAnimal, setNovoAnimal] = useState({ nome: "", especie: "", porte: "medio" });
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [transferindo, setTransferindo] = useState<Cidadao | null>(null);
  const [desligando, setDesligando] = useState<Cidadao | null>(null);

  const msgErro = useCallback(
    (e: unknown, padrao: string) =>
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? padrao,
    [],
  );

  /** Erro de validação de um campo específico (ex.: cpf), com fallback. */
  const campoOuErro = useCallback(
    (e: unknown, campo: string, padrao: string) => {
      const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const doCampo = data?.[campo];
      if (Array.isArray(doCampo) && doCampo.length) return String(doCampo[0]);
      if (typeof data?.error === "string") return data.error;
      return padrao;
    },
    [],
  );

  /* ── carrega famílias ── */
  useEffect(() => {
    let cancelado = false;
    api
      .get<ListaResposta>("/familias/")
      .then((res) => {
        if (cancelado) return;
        setDados(res.data);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setDados(null);
        setErro(msgErro(e, "Não foi possível carregar as famílias."));
      });
    return () => {
      cancelado = true;
    };
  }, [recarga, msgErro]);

  /* ── zonas para o filtro ── */
  useEffect(() => {
    let cancelado = false;
    api
      .get<{ zonas: ZonaResumo[] }>("/zonas/")
      .then((res) => {
        if (!cancelado) setZonas(res.data.zonas ?? []);
      })
      .catch(() => {
        if (!cancelado) setZonas([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const familias = useMemo(() => dados?.familias ?? [], [dados]);

  const filtradas = useMemo(() => {
    let lista = familias;
    if (filtroZona === "sem_zona") lista = lista.filter((f) => f.zona == null);
    else if (filtroZona !== "todas") lista = lista.filter((f) => f.zona === filtroZona);

    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    // Filtra no cliente porque a lista já está carregada; para bases grandes
    // o endpoint /familias/?busca= faz o mesmo no servidor.
    const digitos = termo.replace(/\D/g, "");
    return lista.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        f.endereco.toLowerCase().includes(termo) ||
        f.cidadaos.some(
          (c) =>
            c.nome.toLowerCase().includes(termo) ||
            (digitos.length >= 3 && (c.cpf ?? "").includes(digitos)),
        ),
    );
  }, [familias, filtroZona, busca]);

  const familia = useMemo(
    () => familias.find((f) => f.id === selectedId) ?? filtradas[0] ?? familias[0] ?? null,
    [familias, filtradas, selectedId],
  );

  const semZona = familias.filter((f) => f.zona == null).length;

  /* ── ações ── */
  const vincularCidadao = async () => {
    if (!familia) return;
    if (!novoCidadao.nome.trim()) {
      showToast("Informe o nome do cidadão.", "error");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/familias/${familia.id}/cidadaos/`, {
        nome: novoCidadao.nome.trim(),
        cpf: novoCidadao.cpf.trim() || null,
        data_nascimento: novoCidadao.nascimento || null,
        parentesco: novoCidadao.parentesco.trim(),
      });
      setNovoCidadao({ nome: "", cpf: "", nascimento: "", parentesco: "" });
      setRecarga((n) => n + 1);
      showToast("Cidadão vinculado.");
    } catch (e) {
      // O backend explica CPF inválido/duplicado citando a família — repassamos
      // a mensagem dele em vez de um texto genérico.
      showToast(campoOuErro(e, "cpf", "Não foi possível vincular o cidadão."), "error");
    } finally {
      setSalvando(false);
    }
  };

  const reativarCidadao = async (id: number) => {
    if (!familia) return;
    try {
      await api.post(`/familias/${familia.id}/cidadaos/${id}/reativar/`, {});
      setRecarga((n) => n + 1);
      showToast("Cidadão reativado.");
    } catch (e) {
      showToast(msgErro(e, "Não foi possível reativar o cidadão."), "error");
    }
  };

  const vincularAnimal = async () => {
    if (!familia) return;
    if (!novoAnimal.especie.trim()) {
      showToast("Informe ao menos a espécie.", "error");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/familias/${familia.id}/animais/`, {
        nome: novoAnimal.nome.trim(),
        especie: novoAnimal.especie.trim(),
        porte: novoAnimal.porte,
      });
      setNovoAnimal({ nome: "", especie: "", porte: "medio" });
      setRecarga((n) => n + 1);
      showToast("Animal vinculado.");
    } catch (e) {
      showToast(msgErro(e, "Não foi possível vincular o animal."), "error");
    } finally {
      setSalvando(false);
    }
  };

  const removerAnimal = async (id: number) => {
    if (!familia) return;
    try {
      await api.delete(`/familias/${familia.id}/animais/${id}/`);
      setRecarga((n) => n + 1);
    } catch (e) {
      showToast(msgErro(e, "Não foi possível remover o animal."), "error");
    }
  };

  /* ── estados de carga ── */
  if (erro) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-error/10">
            <Icon name="cloud_off" filled className="text-[32px] text-error" />
          </div>
          <h3 className="font-headline font-black text-xl text-primary tracking-tight">
            Não foi possível carregar
          </h3>
          <p className="text-sm text-on-surface-variant mt-2">{erro}</p>
          <div className="mt-5">
            <Btn variant="secondary" icon="refresh" onClick={() => setRecarga((n) => n + 1)}>
              Tentar de novo
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <Icon name="progress_activity" className="text-secondary text-[32px] animate-spin" />
          <p className="text-sm text-on-surface-variant mt-3">Carregando famílias…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">POPULAÇÃO CADASTRADA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{dados.total_familias} FAMÍLIAS</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Gerenciamento das Famílias
          </h1>
          <Btn variant="primary" icon="add" onClick={() => setModalAberto(true)}>
            Nova família
          </Btn>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          label="Famílias"
          value={dados.total_familias}
          icon="family_restroom"
          tone="secondary"
          sub={`${dados.total_pessoas} cidadãos cadastrados`}
        />
        <KPI
          label="Em Área de Risco"
          value={dados.total_em_risco}
          icon="warning"
          tone={dados.total_em_risco > 0 ? "error" : "secondary"}
          sub="Prioridade em eventos"
        />
        <KPI
          label="Sem Zona Definida"
          value={semZona}
          icon="wrong_location"
          tone={semZona > 0 ? "warning" : "secondary"}
          sub="Coordenada fora das zonas"
        />
        <KPI
          label="Animais"
          value={dados.total_animais}
          icon="pets"
          tone="secondary"
          sub="Vinculados às famílias"
        />
      </div>

      <div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por família, endereço, morador ou CPF…"
          className="w-full bg-white rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none shadow-ambient-sm"
        />
      </div>

      {/* filtro por zona */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltroZona("todas")}
          className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
            filtroZona === "todas"
              ? "bg-primary text-white shadow-ambient-sm"
              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          Todas as zonas
        </button>
        {zonas.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => setFiltroZona(z.id)}
            className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
              filtroZona === z.id
                ? "bg-primary text-white shadow-ambient-sm"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {z.nome} ({familias.filter((f) => f.zona === z.id).length})
          </button>
        ))}
        {semZona > 0 && (
          <button
            type="button"
            onClick={() => setFiltroZona("sem_zona")}
            className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
              filtroZona === "sem_zona"
                ? "bg-primary text-white shadow-ambient-sm"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            Sem zona ({semZona})
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Lista */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          {filtradas.length === 0 && (
            <p className="text-[12px] text-on-surface-variant italic">
              Nenhuma família nesta zona.
            </p>
          )}
          {filtradas.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`w-full card-tonal p-5 shadow-ambient-sm text-left relative overflow-hidden transition-all hover:shadow-ambient ${
                familia?.id === f.id ? "ring-2 ring-secondary" : ""
              }`}
            >
              <span
                className={`absolute top-0 left-0 bottom-0 w-1 ${
                  f.area_de_risco ? "bg-error" : "bg-secondary"
                }`}
              />
              <div className="pl-3">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <p className="text-[14px] font-bold text-primary truncate">{f.nome}</p>
                  {f.area_de_risco && <Chip tone="error">ÁREA DE RISCO</Chip>}
                </div>
                <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                  <Icon name="location_on" className="text-[14px]" /> {f.endereco || "Sem endereço"}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] font-mono font-bold uppercase tracking-mono text-slate-400">
                  <span>{f.zona_nome ?? "SEM ZONA"}</span>
                  <span>·</span>
                  <span>{f.total_cidadaos} {f.total_cidadaos === 1 ? "CIDADÃO" : "CIDADÃOS"}</span>
                  <span>·</span>
                  <span>{f.ocorrencias.length} OCORRÊNCIAS</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detalhe */}
        <aside className="col-span-12 lg:col-span-7">
          {!familia ? (
            <div className="card-tonal p-12 shadow-ambient-sm text-center">
              <p className="text-sm text-on-surface-variant">
                Nenhuma família cadastrada para esta entidade.
              </p>
              <div className="mt-5">
                <Btn variant="primary" icon="add" onClick={() => setModalAberto(true)}>
                  Cadastrar a primeira
                </Btn>
              </div>
            </div>
          ) : (
            <div className="card-tonal shadow-ambient-sm overflow-hidden">
              <div className="bg-gradient-to-br from-primary to-primary-container text-white p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Chip tone="primarySoft" className="!bg-white/15 !text-white">
                      FAMÍLIA #{familia.id}
                    </Chip>
                    <h2 className="font-headline font-black text-2xl tracking-tighter mt-3">
                      {familia.nome}
                    </h2>
                    <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
                      <Icon name="location_on" className="text-[14px]" />
                      {familia.endereco || "Sem endereço"} · {familia.zona_nome ?? "sem zona"}
                    </p>
                    {familia.telefone && (
                      <p className="text-white/70 text-xs mt-1 flex items-center gap-1.5">
                        <Icon name="call" className="text-[14px]" /> {familia.telefone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditando(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-mono-tight hover:bg-white/20 transition-all"
                    >
                      <Icon name="edit" className="text-[16px]" /> Editar
                    </button>
                  {mapsUrl(familia.coordenadas) ? (
                    <a
                      href={mapsUrl(familia.coordenadas)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-mono-tight hover:bg-white/20 transition-all shrink-0"
                    >
                      <Icon name="map" className="text-[16px]" /> Localização
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/50 text-[11px] font-bold uppercase tracking-mono-tight shrink-0">
                      <Icon name="wrong_location" className="text-[16px]" /> Sem coordenada
                    </span>
                  )}
                  </div>
                </div>
              </div>

              <div className="p-7 space-y-6">
                {familia.zona == null && familia.coordenadas && (
                  <div className="card-recessed p-4 border-l-4 border-warning">
                    <MetaTag className="block mb-1">FORA DAS ZONAS CADASTRADAS</MetaTag>
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">
                      A coordenada desta família não está dentro de nenhum polígono de zona.
                      Confira o ponto ou amplie a área da zona correspondente.
                    </p>
                  </div>
                )}

                {/* Ocorrências */}
                <div>
                  <MetaTag className="block mb-3">
                    OCORRÊNCIAS DA FAMÍLIA ({familia.ocorrencias.length})
                  </MetaTag>
                  {familia.ocorrencias.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant italic">
                      Nenhuma ocorrência registrada.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {familia.ocorrencias.map((oc) => (
                        <div
                          key={oc.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
                        >
                          <Icon name="emergency" className="text-error text-[16px]" />
                          <span className="font-bold text-primary">#{oc.id}</span>
                          <span className="text-on-surface truncate flex-1">{oc.titulo}</span>
                          <Chip tone="neutral">{oc.status}</Chip>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cidadãos */}
                <div>
                  <MetaTag className="block mb-3">CIDADÃOS ({familia.cidadaos.length})</MetaTag>
                  <div className="space-y-2 mb-3">
                    {familia.cidadaos.length === 0 && (
                      <p className="text-[12px] text-on-surface-variant italic">
                        Nenhum cidadão cadastrado.
                      </p>
                    )}
                    {familia.cidadaos.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
                      >
                        <div className="w-8 h-8 rounded-md bg-primary-container/20 flex items-center justify-center">
                          <Icon name="person" className="text-primary text-[16px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-primary truncate">{m.nome}</p>
                          <p
                            className={`text-[10px] font-mono tracking-mono ${
                              m.cpf_formatado ? "text-slate-400" : "text-error font-bold"
                            }`}
                          >
                            {m.cpf_formatado || "CPF PENDENTE"}
                          </p>
                        </div>
                        <span className="text-on-surface-variant">
                          {m.idade != null ? `${m.idade} anos` : "idade —"}
                        </span>
                        <Chip tone={m.responsavel ? "secondary" : "neutral"}>{m.parentesco}</Chip>
                        <button
                          type="button"
                          onClick={() => setTransferindo(m)}
                          className="text-on-surface-variant hover:text-secondary"
                          title="Transferir para outra família ou separar numa nova"
                          aria-label={`Transferir ${m.nome}`}
                        >
                          <Icon name="swap_horiz" className="text-[16px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDesligando(m)}
                          className="text-on-surface-variant hover:text-error"
                          title="Desligar do cadastro (óbito, mudança…) — o registro é preservado"
                          aria-label={`Desligar ${m.nome}`}
                        >
                          <Icon name="person_off" className="text-[16px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Grid de 2 colunas: 5 campos em linha estouravam a
                      largura da coluna lateral. O botão vai em linha própria. */}
                  <div className="card-recessed p-4 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <MetaTag className="block mb-1.5">NOME *</MetaTag>
                        <input
                          value={novoCidadao.nome}
                          onChange={(e) => setNovoCidadao((v) => ({ ...v, nome: e.target.value }))}
                          placeholder="Nome completo"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">CPF *</MetaTag>
                        <input
                          value={novoCidadao.cpf}
                          onChange={(e) => setNovoCidadao((v) => ({ ...v, cpf: e.target.value }))}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">NASCIMENTO</MetaTag>
                        <input
                          type="date"
                          value={novoCidadao.nascimento}
                          onChange={(e) => setNovoCidadao((v) => ({ ...v, nascimento: e.target.value }))}
                          title="A idade é calculada automaticamente a partir da data"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">PARENTESCO</MetaTag>
                        <input
                          value={novoCidadao.parentesco}
                          onChange={(e) => setNovoCidadao((v) => ({ ...v, parentesco: e.target.value }))}
                          placeholder="Filho(a), Cônjuge…"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                    </div>
                    <Btn
                      variant="secondary"
                      icon="person_add"
                      onClick={vincularCidadao}
                      disabled={salvando}
                      className="w-full justify-center"
                    >
                      {salvando ? "Salvando…" : "Vincular cidadão"}
                    </Btn>
                  </div>
                </div>

                {/* Cidadãos desligados */}
                {familia.cidadaos_desligados.length > 0 && (
                  <div>
                    <MetaTag className="block mb-3">
                      DESLIGADOS ({familia.cidadaos_desligados.length})
                    </MetaTag>
                    <div className="space-y-2">
                      {familia.cidadaos_desligados.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px] opacity-70"
                        >
                          <div className="w-8 h-8 rounded-md bg-surface-container-high flex items-center justify-center">
                            <Icon name="person_off" className="text-on-surface-variant text-[16px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-primary truncate line-through decoration-1">
                              {m.nome}
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              {m.motivo_label}
                              {m.data_desligamento
                                ? ` · ${new Date(m.data_desligamento + "T00:00:00").toLocaleDateString("pt-BR")}`
                                : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => reativarCidadao(m.id)}
                            className="text-on-surface-variant hover:text-secondary"
                            title="Reativar — desfaz o desligamento"
                            aria-label={`Reativar ${m.nome}`}
                          >
                            <Icon name="undo" className="text-[16px]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Animais */}
                <div>
                  <MetaTag className="block mb-3">
                    ANIMAIS ({familia.total_animais})
                  </MetaTag>
                  <div className="space-y-2 mb-3">
                    {familia.animais.length === 0 && (
                      <p className="text-[12px] text-on-surface-variant italic">
                        Nenhum animal vinculado.
                      </p>
                    )}
                    {familia.animais.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
                      >
                        <div className="w-8 h-8 rounded-md bg-secondary/10 flex items-center justify-center">
                          <Icon name="pets" className="text-secondary text-[16px]" />
                        </div>
                        <span className="font-bold text-primary flex-1 truncate">
                          {a.nome || a.especie}
                        </span>
                        <Chip tone="secondary">{a.especie}</Chip>
                        <Chip tone="neutral">{a.porte_label}</Chip>
                        <button
                          type="button"
                          onClick={() => removerAnimal(a.id)}
                          className="text-on-surface-variant hover:text-error"
                          aria-label={`Remover ${a.nome || a.especie}`}
                        >
                          <Icon name="close" className="text-[16px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="card-recessed p-4 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <MetaTag className="block mb-1.5">NOME</MetaTag>
                        <input
                          value={novoAnimal.nome}
                          onChange={(e) => setNovoAnimal((v) => ({ ...v, nome: e.target.value }))}
                          placeholder="Opcional em animal de criação"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">ESPÉCIE *</MetaTag>
                        <input
                          value={novoAnimal.especie}
                          onChange={(e) => setNovoAnimal((v) => ({ ...v, especie: e.target.value }))}
                          placeholder="Cão, Gato, Ave…"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">PORTE</MetaTag>
                        <select
                          value={novoAnimal.porte}
                          onChange={(e) => setNovoAnimal((v) => ({ ...v, porte: e.target.value }))}
                          title="Usado para dimensionar abrigo e transporte na evacuação"
                          className="w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                        >
                          {PORTES.map((p) => (
                            <option key={p} value={p}>
                              {p === "medio" ? "Médio" : p.charAt(0).toUpperCase() + p.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Btn
                      variant="secondary"
                      icon="add"
                      onClick={vincularAnimal}
                      disabled={salvando}
                      className="w-full justify-center"
                    >
                      {salvando ? "Salvando…" : "Vincular animal"}
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <CreateFamilyModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCreated={(id) => {
          setSelectedId(id);
          setRecarga((n) => n + 1);
        }}
      />

      {/* `key` força remontagem ao trocar de família: assim o formulário nasce
          já com os dados certos, sem efeito de sincronização. */}
      {familia && (
        <EditFamilyModal
          key={`edit-${familia.id}-${editando}`}
          open={editando}
          familia={familia}
          onClose={() => setEditando(false)}
          onSaved={() => setRecarga((n) => n + 1)}
        />
      )}

      {transferindo && familia && (
        <TransferCidadaoModal
          key={`transf-${transferindo.id}`}
          open={transferindo !== null}
          cidadao={transferindo}
          familiaOrigemId={familia.id}
          origemCoordenadas={familia.coordenadas}
          onClose={() => setTransferindo(null)}
          onDone={(novaId) => {
            setSelectedId(novaId);
            setRecarga((n) => n + 1);
          }}
        />
      )}

      {desligando && familia && (
        <DesligarCidadaoModal
          key={`desl-${desligando.id}`}
          open={desligando !== null}
          cidadao={desligando}
          familiaId={familia.id}
          onClose={() => setDesligando(null)}
          onDone={() => setRecarga((n) => n + 1)}
        />
      )}
    </div>
  );
}