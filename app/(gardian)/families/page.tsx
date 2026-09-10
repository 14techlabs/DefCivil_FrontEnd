"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import Link from "next/link";
import { api } from "@/app/services/Api";
import { CreateFamilyModal } from "@/app/components/CreateFamilyModal";
import {
  DesligarCidadaoModal,
  EditFamilyModal,
  TransferCidadaoModal,
} from "@/app/components/FamilyModals";
import { PaginationControls, type PaginationInfo } from "@/app/components/PaginationControls";

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
  paginacao: PaginationInfo;
};

type TotaisFamilias = Pick<
  ListaResposta,
  "total_familias" | "total_pessoas" | "total_animais" | "total_em_risco"
>;

type ZonaResumo = { id: number; nome: string };

const PORTES: Animal["porte"][] = ["pequeno", "medio", "grande"];

function formatarCpf(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function dataLocalIso(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mapsUrl(c: Familia["coordenadas"]) {
  if (!c) return null;
  return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
}

export default function FamiliesPage() {
  const { showToast } = useGardian();
  const dataMaximaNascimento = dataLocalIso(new Date());

  const [dados, setDados] = useState<ListaResposta | null>(null);
  const [totaisGlobais, setTotaisGlobais] = useState<TotaisFamilias | null>(null);
  const [zonas, setZonas] = useState<ZonaResumo[]>([]);
  const [carregandoTotaisInicial, setCarregandoTotaisInicial] = useState(true);
  const [carregandoZonasInicial, setCarregandoZonasInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [busca, setBusca] = useState("");
  const [filtroZona, setFiltroZona] = useState<number | "todas" | "sem_zona">("todas");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [quantidadePorPagina, setQuantidadePorPagina] = useState<10 | 25 | 50>(10);

  const [novoCidadao, setNovoCidadao] = useState({ nome: "", cpf: "", nascimento: "", parentesco: "" });
  const [erroNovoCidadao, setErroNovoCidadao] = useState("");
  const [campoErroNovoCidadao, setCampoErroNovoCidadao] = useState<"nome" | "cpf" | null>(null);
  const [novoAnimal, setNovoAnimal] = useState({ nome: "", especie: "", porte: "medio" });
  const [erroNovoAnimal, setErroNovoAnimal] = useState("");
  const [animalRemovendoId, setAnimalRemovendoId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [transferindo, setTransferindo] = useState<Cidadao | null>(null);
  const [desligando, setDesligando] = useState<Cidadao | null>(null);
  const [showFamilyDetails, setShowFamilyDetails] = useState(false);

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
      if (typeof doCampo === "string") return doCampo;
      if (typeof data?.error === "string") return data.error;
      return padrao;
    },
    [],
  );

  /* ── carrega famílias ── */
  useEffect(() => {
    let cancelado = false;
    const timer = window.setTimeout(() => {
      const params: Record<string, string | number> = {
        pagina,
        quantidade_por_pagina: quantidadePorPagina,
      };
      if (busca.trim()) params.busca = busca.trim();
      if (filtroZona !== "todas") params.zona = filtroZona;
      api
        .get<ListaResposta>("/familias/", { params })
        .then((res) => {
          if (cancelado) return;
          setDados(res.data);
          setSelectedId((current) =>
            current != null && (res.data.familias ?? []).some((familia) => familia.id === current)
              ? current
              : res.data.familias?.[0]?.id ?? null,
          );
          setErro(null);
        })
        .catch((e: unknown) => {
          if (cancelado) return;
          const status = (e as { response?: { status?: number } })?.response?.status;
          if (status === 404 && pagina > 1) {
            setPagina((current) => Math.max(1, current - 1));
            return;
          }
          setDados(null);
          setErro(msgErro(e, "Não foi possível carregar as famílias."));
        });
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [busca, filtroZona, pagina, quantidadePorPagina, recarga, msgErro]);

  /* Totais gerais, independentes da busca, da zona e da paginação */
  useEffect(() => {
    let cancelado = false;
    api
      .get<ListaResposta>("/familias/", {
        params: { pagina: 1, quantidade_por_pagina: 10 },
      })
      .then((res) => {
        if (cancelado) return;
        setTotaisGlobais({
          total_familias: res.data.total_familias,
          total_pessoas: res.data.total_pessoas,
          total_animais: res.data.total_animais,
          total_em_risco: res.data.total_em_risco,
        });
      })
      .catch(() => {
        if (!cancelado) setTotaisGlobais(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoTotaisInicial(false);
      });
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  /* ── zonas para o filtro ── */
  useEffect(() => {
    let cancelado = false;
    api
      .get<{ zonas: ZonaResumo[] }>("/zonas/", { params: { lookup: "1" } })
      .then((res) => {
        if (!cancelado) setZonas(res.data.zonas ?? []);
      })
      .catch(() => {
        if (!cancelado) setZonas([]);
      })
      .finally(() => {
        if (!cancelado) setCarregandoZonasInicial(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const familias = useMemo(() => dados?.familias ?? [], [dados]);

  const filtradas = familias;

  const familia = useMemo(
    () => familias.find((f) => f.id === selectedId) ?? filtradas[0] ?? familias[0] ?? null,
    [familias, filtradas, selectedId],
  );


  /* ── ações ── */
  const vincularCidadao = async () => {
    if (!familia) return;
    if (!novoCidadao.nome.trim()) {
      setErroNovoCidadao("Informe o nome do cidadão.");
      setCampoErroNovoCidadao("nome");
      return;
    }
    const cpfDigitos = novoCidadao.cpf.replace(/\D/g, "");
    if (cpfDigitos.length !== 11) {
      return;
    }
    setSalvando(true);
    setErroNovoCidadao("");
    setCampoErroNovoCidadao(null);
    try {
      await api.post(`/familias/${familia.id}/cidadaos/`, {
        nome: novoCidadao.nome.trim(),
        cpf: novoCidadao.cpf.trim() || null,
        data_nascimento: novoCidadao.nascimento || null,
        parentesco: novoCidadao.parentesco.trim(),
      });
      setNovoCidadao({ nome: "", cpf: "", nascimento: "", parentesco: "" });
      setErroNovoCidadao("");
      setCampoErroNovoCidadao(null);
      setRecarga((n) => n + 1);
      showToast("Cidadão vinculado.");
    } catch (e) {
      setErroNovoCidadao(campoOuErro(e, "cpf", "Não foi possível vincular o cidadão."));
      setCampoErroNovoCidadao("cpf");
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
      setErroNovoAnimal("Informe a espécie do animal.");
      return;
    }
    setSalvando(true);
    setErroNovoAnimal("");
    try {
      await api.post(`/familias/${familia.id}/animais/`, {
        nome: novoAnimal.nome.trim(),
        especie: novoAnimal.especie.trim(),
        porte: novoAnimal.porte,
      });
      setNovoAnimal({ nome: "", especie: "", porte: "medio" });
      setErroNovoAnimal("");
      setRecarga((n) => n + 1);
      showToast("Animal vinculado.");
    } catch (e) {
      setErroNovoAnimal(campoOuErro(e, "especie", "Não foi possível vincular o animal."));
    } finally {
      setSalvando(false);
    }
  };

  const removerAnimal = async (id: number) => {
    if (!familia || animalRemovendoId !== null) return;
    setAnimalRemovendoId(id);
    try {
      await api.delete(`/familias/${familia.id}/animais/${id}/`);
      setDados((atual) => atual ? {
        ...atual,
        total_animais: Math.max(0, atual.total_animais - 1),
        familias: atual.familias.map((item) =>
          item.id === familia.id
            ? {
                ...item,
                animais: item.animais.filter((animal) => animal.id !== id),
                total_animais: Math.max(0, item.total_animais - 1),
              }
            : item,
        ),
      } : atual);
      setTotaisGlobais((atual) => atual ? {
        ...atual,
        total_animais: Math.max(0, atual.total_animais - 1),
      } : atual);
      setRecarga((n) => n + 1);
    } catch (e) {
      showToast(msgErro(e, "Não foi possível remover o animal."), "error");
    } finally {
      setAnimalRemovendoId(null);
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

  if (!dados || carregandoTotaisInicial || carregandoZonasInicial) {
    return <DataLoading />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">POPULAÇÃO CADASTRADA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{totaisGlobais?.total_familias ?? dados.total_familias} FAMÍLIAS</MetaTag>
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
          value={totaisGlobais?.total_familias ?? dados.total_familias}
          icon="family_restroom"
          tone="secondary"
          sub={`${totaisGlobais?.total_pessoas ?? dados.total_pessoas} cidadãos cadastrados`}
        />
        <KPI
          label="Em Área de Risco"
          value={totaisGlobais?.total_em_risco ?? dados.total_em_risco}
          icon="warning"
          tone={(totaisGlobais?.total_em_risco ?? dados.total_em_risco) > 0 ? "error" : "secondary"}
          sub="Prioridade em eventos"
        />
        <KPI
          label="Pessoas"
          value={totaisGlobais?.total_pessoas ?? dados.total_pessoas}
          icon="groups"
          tone="secondary"
          sub="Cidadãos cadastrados"
        />
        <KPI
          label="Animais"
          value={totaisGlobais?.total_animais ?? dados.total_animais}
          icon="pets"
          tone="secondary"
          sub="Vinculados às famílias"
        />
      </div>

      <section className="rounded-xl border border-outline-variant/25 bg-surface p-4 shadow-ambient-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar famílias</span>
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[21px] text-on-surface-variant" />
            <input
              value={busca}
              onChange={(e) => { setPagina(1); setBusca(e.target.value); }}
              placeholder="Buscar por família, endereço, morador ou CPF…"
              className="h-11 w-full rounded-lg border border-outline-variant/25 bg-surface-container-low pl-12 pr-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-secondary"
            />
          </label>

          <label className="relative h-11 w-full shrink-0 sm:w-56">
            <span className="sr-only">Filtrar famílias por zona</span>
            <Icon name="location_on" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
            <select
              value={filtroZona}
              onChange={(event) => {
                const value = event.target.value;
                setFiltroZona(value === "todas" || value === "sem_zona" ? value : Number(value));
                setPagina(1);
              }}
              className="h-full w-full appearance-none rounded-lg border border-outline-variant/25 bg-white py-0 pl-10 pr-10 text-xs font-bold text-primary outline-none transition-all hover:border-secondary/40 focus:ring-2 focus:ring-secondary/30"
            >
              <option value="todas">Todas as zonas</option>
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>{zona.nome}</option>
              ))}
              <option value="sem_zona">Sem zona</option>
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
          </label>

          <label className="flex h-11 w-full shrink-0 items-center gap-2 rounded-lg border border-outline-variant/25 bg-white pl-3 text-on-surface-variant transition-all hover:border-secondary/40 focus-within:ring-2 focus-within:ring-secondary/30 sm:w-auto">
            <span className="whitespace-nowrap text-[10px] font-semibold">Itens por página:</span>
            <span className="relative h-full">
              <select
                value={quantidadePorPagina}
                onChange={(event) => {
                  setQuantidadePorPagina(Number(event.target.value) as 10 | 25 | 50);
                  setPagina(1);
                }}
                className="h-full min-w-[66px] appearance-none rounded-r-lg border-none bg-transparent pl-2 pr-9 text-xs font-bold text-primary outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant" />
            </span>
          </label>
        </div>

      </section>

      <div>
        <h2 className="font-headline text-2xl font-black tracking-tight text-primary">
          Lista de Famílias
        </h2>
        <p className="text-[11px] text-on-surface-variant">
          {dados.paginacao.total_objetos} família{dados.paginacao.total_objetos !== 1 ? "s" : ""} encontrada{dados.paginacao.total_objetos !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Lista */}
        <div className="col-span-12 space-y-4">
          {filtradas.length === 0 && (
            <div className="space-y-5">
              <p className="py-12 text-center text-[12px] italic text-on-surface-variant">
                Nenhuma família encontrada nesta página.
              </p>
              <PaginationControls pagination={dados.paginacao} onPageChange={setPagina} onPageSizeChange={(pageSize) => { setQuantidadePorPagina(pageSize); setPagina(1); }} showPageSize={false} />
            </div>
          )}
          {filtradas.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-outline-variant/25 bg-surface shadow-ambient-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left">
                  <thead className="bg-surface-container-low">
                    <tr className="border-b border-outline-variant/25">
                      <th className="px-4 py-3"><MetaTag>FAMÍLIA</MetaTag></th>
                      <th className="px-4 py-3"><MetaTag>ENDEREÇO</MetaTag></th>
                      <th className="px-4 py-3"><MetaTag>ZONA</MetaTag></th>
                      <th className="px-4 py-3"><MetaTag>PESSOAS</MetaTag></th>
                      <th className="px-4 py-3"><MetaTag>ANIMAIS</MetaTag></th>
                      <th className="px-4 py-3"><MetaTag>RISCO</MetaTag></th>
                      <th className="px-4 py-3 text-left"><MetaTag>AÇÕES</MetaTag></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((f) => (
                      <tr key={f.id} className="border-b border-outline-variant/15 transition-colors last:border-0 hover:bg-surface-container-low">
                        <td className="px-4 py-4"><p className="text-[13px] font-bold text-primary">#{f.id} · {f.nome}</p><p className="mt-1 text-[10px] text-on-surface-variant">{f.telefone || "Sem telefone"}</p></td>
                        <td className="max-w-[280px] px-4 py-4 text-[11px] text-on-surface-variant"><p className="truncate">{f.endereco || "Sem endereço"}</p></td>
                        <td className="px-4 py-4 text-[11px] font-medium text-on-surface-variant">{f.zona_nome ?? "Sem zona"}</td>
                        <td className="px-4 py-4 text-[12px] font-bold text-primary">{f.total_cidadaos}</td>
                        <td className="px-4 py-4 text-[12px] font-bold text-primary">{f.total_animais}</td>
                        <td className="px-4 py-4">{f.area_de_risco ? <Chip tone="error">Área de risco</Chip> : <Chip tone="secondary">Regular</Chip>}</td>
                        <td className="px-4 py-4 text-left"><Btn variant="secondary" icon="visibility" onClick={() => { setSelectedId(f.id); setShowFamilyDetails(true); }}>Visualizar</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-outline-variant/20 p-3">
                <PaginationControls pagination={dados.paginacao} onPageChange={setPagina} onPageSizeChange={(pageSize) => { setQuantidadePorPagina(pageSize); setPagina(1); }} showPageSize={false} />
              </div>
            </div>
          )}
        </div>

        {/* Detalhe */}
        {showFamilyDetails && <button type="button" className="fixed inset-0 z-[60] cursor-default bg-slate-950/55 backdrop-blur-sm" onClick={() => setShowFamilyDetails(false)} aria-label="Fechar detalhes da família" />}
        <aside className={showFamilyDetails ? "col-span-12" : "hidden"}>
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
            <div className="card-tonal fixed left-1/2 top-1/2 z-[70] max-h-[92vh] w-[min(700px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-ambient-sm">
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
                    <button type="button" onClick={() => setShowFamilyDetails(false)} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-mono-tight text-white transition-all hover:bg-white/20"><Icon name="close" className="text-[16px]" /> Fechar</button>
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
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <MetaTag>
                      OCORRÊNCIAS DA FAMÍLIA ({familia.ocorrencias.length})
                    </MetaTag>
                    {familia.ocorrencias.length > 0 && (
                      <Link
                        href={`/occurrences?familia=${familia.id}&familia_nome=${encodeURIComponent(familia.nome)}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-mono-tight text-secondary hover:underline"
                      >
                        Abrir em Ocorrências
                        <Icon name="arrow_forward" className="text-[14px]" />
                      </Link>
                    )}
                  </div>
                  {familia.ocorrencias.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant italic">
                      Nenhuma ocorrência registrada.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {familia.ocorrencias.map((oc) => (
                        <Link
                          key={oc.id}
                          href={`/occurrences?id=${oc.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-secondary/8 text-[12px] transition-colors"
                        >
                          <Icon name="emergency" className="text-error text-[16px] shrink-0" />
                          <span className="font-bold text-primary shrink-0">#{oc.id}</span>
                          <span className="text-on-surface truncate flex-1 min-w-0">{oc.titulo}</span>
                          <Chip tone="neutral">{oc.status}</Chip>
                          <Icon
                            name="chevron_right"
                            className="text-on-surface-variant text-[16px] shrink-0"
                          />
                        </Link>
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
                            className={`text-[10px] font-mono tracking-mono ${m.cpf_formatado ? "text-slate-400" : "text-error font-bold"
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
                          onChange={(e) => {
                            setNovoCidadao((v) => ({ ...v, nome: e.target.value }));
                            setErroNovoCidadao("");
                            setCampoErroNovoCidadao(null);
                          }}
                          placeholder="Nome completo"
                          aria-invalid={campoErroNovoCidadao === "nome"}
                          className={`w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 ${campoErroNovoCidadao === "nome" ? "ring-1 ring-error focus:ring-error" : "focus:ring-secondary"}`}
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">CPF *</MetaTag>
                        <input
                          value={novoCidadao.cpf}
                          onChange={(e) => {
                            setNovoCidadao((v) => ({ ...v, cpf: formatarCpf(e.target.value) }));
                            setErroNovoCidadao("");
                            setCampoErroNovoCidadao(null);
                          }}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          maxLength={14}
                          aria-invalid={campoErroNovoCidadao === "cpf"}
                          className={`w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 ${campoErroNovoCidadao === "cpf" ? "ring-1 ring-error focus:ring-error" : "focus:ring-secondary"}`}
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">NASCIMENTO</MetaTag>
                        <input
                          type="date"
                          value={novoCidadao.nascimento}
                          min="1900-01-01"
                          max={dataMaximaNascimento}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && (value < "1900-01-01" || value > dataMaximaNascimento)) return;
                            setNovoCidadao((v) => ({ ...v, nascimento: value }));
                          }}
                          title="A idade é calculada automaticamente a partir da data"
                          className="w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-secondary"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">PARENTESCO</MetaTag>
                        <input
                          value={novoCidadao.parentesco}
                          onChange={(e) => setNovoCidadao((v) => ({ ...v, parentesco: e.target.value }))}
                          placeholder="Filho(a), Cônjuge…"
                          className="w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-secondary"
                        />
                      </div>
                    </div>
                    {erroNovoCidadao && (
                      <div role="alert" className="flex items-center gap-2 rounded-lg bg-error-container px-3 py-2.5 text-[11px] font-medium text-on-error-container">
                        <Icon name="error" filled className="shrink-0 text-[16px] text-error" />
                        <p>{erroNovoCidadao}</p>
                      </div>
                    )}
                    <Btn
                      variant="secondary"
                      icon="person_add"
                      onClick={vincularCidadao}
                      disabled={
                        salvando
                        || !novoCidadao.nome.trim()
                        || novoCidadao.cpf.replace(/\D/g, "").length !== 11
                      }
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
                          disabled={animalRemovendoId !== null}
                          className="text-on-surface-variant hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Remover ${a.nome || a.especie}`}
                        >
                          <Icon name={animalRemovendoId === a.id ? "progress_activity" : "close"} className={`text-[16px] ${animalRemovendoId === a.id ? "animate-spin" : ""}`} />
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
                          className="w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-secondary"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">ESPÉCIE *</MetaTag>
                        <input
                          value={novoAnimal.especie}
                          onChange={(e) => {
                            setNovoAnimal((v) => ({ ...v, especie: e.target.value }));
                            setErroNovoAnimal("");
                          }}
                          placeholder="Cão, Gato, Ave…"
                          aria-invalid={Boolean(erroNovoAnimal)}
                          className={`w-full min-w-0 rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 ${erroNovoAnimal ? "ring-1 ring-error focus:ring-error" : "focus:ring-secondary"}`}
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">PORTE</MetaTag>
                        <div className="relative">
                          <select
                            value={novoAnimal.porte}
                            onChange={(e) => setNovoAnimal((v) => ({ ...v, porte: e.target.value }))}
                            title="Usado para dimensionar abrigo e transporte na evacuação"
                            className="w-full min-w-0 appearance-none rounded-lg bg-white py-2.5 pl-3.5 pr-10 text-xs font-medium outline-none focus:ring-2 focus:ring-secondary"
                          >
                            {PORTES.map((p) => (
                              <option key={p} value={p}>
                                {p === "medio" ? "Médio" : p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                          <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant" />
                        </div>
                      </div>
                    </div>
                    {erroNovoAnimal && (
                      <div role="alert" className="flex items-center gap-2 rounded-lg bg-error-container px-3 py-2.5 text-[11px] font-medium text-on-error-container">
                        <Icon name="error" filled className="shrink-0 text-[16px] text-error" />
                        <p>{erroNovoAnimal}</p>
                      </div>
                    )}
                    <Btn
                      variant="secondary"
                      icon="add"
                      onClick={vincularAnimal}
                      disabled={salvando || !novoAnimal.especie.trim()}
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
