"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { api } from "@/app/services/Api";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

const CATEGORIA_LABEL: Record<string, string> = {
  desabamento: "Desabamento",
  deslizamento: "Deslizamento",
  queda_de_barreira: "Queda de Barreira",
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

type Hierarquia = "coordenador" | "supervisor" | "tecnico";
type StatusCampo = "em_campo" | "disponivel" | "offline";
const OCORRENCIAS_POR_MEMBRO = 3;

interface EquipeTecnico {
  id: number;
  nome: string;
  cargo: string;
  hierarquia: Hierarquia;
  identificador: string;
  zonaBase: number | null;
  zonaBaseNome: string | null;
  statusCampo: StatusCampo;
  atendimentos30d: number;
  telefone: string;
}

interface EquipeTecnicoApi {
  id: number;
  nome: string;
  cargo: number | null;
  cargo_label: string;
  hierarquia: Hierarquia;
  matricula: string;
  telefone: string;
  status_campo: StatusCampo;
  status_campo_label: string;
  zona_base: number | null;
  zona_base_nome: string | null;
  atendimentos_30d: number;
}

interface EquipeKpis {
  efetivo: number;
  em_campo: number;
  atendimentos_30d: number;
  zonas_cobertas: number;
}

interface EquipePanoramaApi {
  tecnicos: EquipeTecnicoApi[];
  kpis: EquipeKpis;
}

interface EquipeOcorrencia {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  zona: number | null;
  tecnico_responsavel: number | null;
  created_at: string;
}

interface EquipeZona {
  id: number;
  nome: string;
}

async function carregarOcorrenciasEquipe(): Promise<EquipeOcorrencia[]> {
  const ocorrencias: EquipeOcorrencia[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const { data } = await api.get<EquipeOcorrencia[] | {
      ocorrencias: EquipeOcorrencia[];
      paginacao?: { total_paginas: number };
    }>("/ocorrencias/", { params: { pagina, quantidade_por_pagina: 50 } });
    ocorrencias.push(...(Array.isArray(data) ? data : data.ocorrencias));
    totalPaginas = Array.isArray(data) ? 1 : data.paginacao?.total_paginas ?? 1;
    pagina += 1;
  } while (pagina <= totalPaginas);
  return ocorrencias;
}

function hierarquiaCargo(cargo: number | null): Hierarquia {
  if (cargo === 1) return "coordenador";
  if (cargo === 2) return "supervisor";
  return "tecnico";
}

function unwrapList<T>(value: T[] | Record<string, T[]>, key: string): T[] {
  return Array.isArray(value) ? value : value[key] ?? [];
}

const HIERARQUIA_META: Record<string, { label: string; icon: string; nivel: number }> = {
  coordenador: { label: "Coordenação", icon: "military_tech", nivel: 3 },
  supervisor: { label: "Supervisão", icon: "supervisor_account", nivel: 2 },
  tecnico: { label: "Técnicos de Campo", icon: "engineering", nivel: 1 },
};

// Fallback enquanto os dados da sessão ainda estão carregando.
const HIERARQUIA_SESSAO_MOCK: Hierarquia = "coordenador";

export default function TeamPage() {
  const { showToast, user } = useGardian();

  const [filtroZona, setFiltroZona] = useState<number | "todas">("todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [periodo, setPeriodo] = useState("30d");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [emitindoRelatorio, setEmitindoRelatorio] = useState(false);
  const [relCampos, setRelCampos] = useState<Record<string, boolean>>({
    atendimentos: true,
    ocorrencias: true,
    zonas: true,
  });
  const [tecnicos, setTecnicos] = useState<EquipeTecnico[]>([]);
  const [kpis, setKpis] = useState<EquipeKpis>({
    efetivo: 0,
    em_campo: 0,
    atendimentos_30d: 0,
    zonas_cobertas: 0,
  });
  const [ocorrencias, setOcorrencias] = useState<EquipeOcorrencia[]>([]);
  const [paginasPorMembro, setPaginasPorMembro] = useState<Record<number, number>>({});
  const [erroOcorrencias, setErroOcorrencias] = useState(false);
  const [zonas, setZonas] = useState<EquipeZona[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const hierarquiaSessao = user ? hierarquiaCargo(user.cargo) : HIERARQUIA_SESSAO_MOCK;
  const temAcesso = HIERARQUIA_META[hierarquiaSessao].nivel >= 2;

  useEffect(() => {
    if (!user) return;
    if (user.cargo !== 1 && user.cargo !== 2) return;
    let cancelado = false;
    const carregarEquipe = async () => {
      try {
        const [panoramaResult, ocorrenciasResult, zonasResult] = await Promise.allSettled([
          api.get<EquipePanoramaApi>("/equipe/panorama/"),
          carregarOcorrenciasEquipe(),
          api.get<EquipeZona[] | { zonas: EquipeZona[] }>("/zonas/", { params: { lookup: "1" } }),
        ]);
        if (cancelado) return;

        const ocorrenciasReais = ocorrenciasResult.status === "fulfilled"
          ? ocorrenciasResult.value
          : null;
        setErroOcorrencias(ocorrenciasResult.status === "rejected");
        if (ocorrenciasReais) setOcorrencias(ocorrenciasReais);

        if (zonasResult.status === "fulfilled") {
          setZonas(unwrapList(zonasResult.value.data, "zonas"));
        }

        if (panoramaResult.status === "fulfilled") {
          setKpis(panoramaResult.value.data.kpis);
          setTecnicos(panoramaResult.value.data.tecnicos.map((tecnico) => ({
            id: tecnico.id,
            nome: tecnico.nome,
            cargo: tecnico.cargo_label,
            hierarquia: tecnico.hierarquia,
            identificador: tecnico.matricula || "Matrícula não informada",
            zonaBase: tecnico.zona_base,
            zonaBaseNome: tecnico.zona_base_nome,
            statusCampo: tecnico.status_campo,
            atendimentos30d: tecnico.atendimentos_30d,
            telefone: tecnico.telefone,
          })));
        } else {
          showToast("Não foi possível carregar o panorama da equipe.", "error");
        }
      } finally {
        if (!cancelado) setCarregandoDados(false);
      }
    };

    void carregarEquipe();
    return () => { cancelado = true; };
  }, [showToast, user]);

  // panorama de atendimentos (ocorrências com técnico responsável)
  const atendimentos = useMemo(() => {
    return ocorrencias.filter((o) => o.tecnico_responsavel != null).filter((o) => {
      if (filtroZona !== "todas" && o.zona !== filtroZona) return false;
      if (filtroCategoria !== "todas" && o.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [ocorrencias, filtroZona, filtroCategoria]);

  const porHierarquia = useMemo(() => {
    const grupos: Record<Hierarquia, EquipeTecnico[]> = { coordenador: [], supervisor: [], tecnico: [] };
    for (const t of tecnicos) grupos[t.hierarquia].push(t);
    return grupos;
  }, [tecnicos]);

  const zonaLookup = useMemo(() => new Map(zonas.map((zona) => [zona.id, zona.nome])), [zonas]);
  const tecnicoLookup = useMemo(() => new Map(tecnicos.map((tecnico) => [tecnico.id, tecnico])), [tecnicos]);
  const nomeZona = (zonaId: number | null) =>
    zonaId == null ? "Sem zona de referência" : zonaLookup.get(zonaId) ?? `Zona ${zonaId}`;

  const emitirRelatorio = async () => {
    const secoes = Object.entries(relCampos)
      .filter(([, selecionado]) => selecionado)
      .map(([secao]) => secao);

    if (secoes.length === 0) {
      showToast("Selecione ao menos uma informação para o relatório.", "error");
      return;
    }
    if (periodo === "custom" && (!dataInicial || !dataFinal)) {
      showToast("Informe as datas inicial e final.", "error");
      return;
    }
    if (periodo === "custom" && dataInicial > dataFinal) {
      showToast("A data inicial não pode ser posterior à data final.", "error");
      return;
    }

    setEmitindoRelatorio(true);
    try {
      const response = await api.get<Blob>("/equipe/relatorio/", {
        params: {
          periodo,
          secoes: secoes.join(","),
          ...(periodo === "custom" ? { de: dataInicial, ate: dataFinal } : {}),
        },
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] as string | undefined;
      const nomeArquivo = disposition?.match(/filename="?([^";]+)"?/i)?.[1]
        ?? `relatorio_equipe_${periodo}.csv`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Relatório da equipe baixado com sucesso.");
    } catch {
      showToast("Não foi possível emitir o relatório da equipe.", "error");
    } finally {
      setEmitindoRelatorio(false);
    }
  };

  if (user && !temAcesso) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-error-container flex items-center justify-center mb-5">
          <Icon name="lock" filled className="text-error text-[28px]" />
        </div>
        <h1 className="font-headline font-black text-2xl text-primary tracking-tighter">Acesso restrito por hierarquia</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          O panorama de equipe está disponível apenas para supervisores e coordenadores. Fale com sua coordenação para solicitar acesso.
        </p>
      </div>
    );
  }

  if (carregandoDados) {
    return <DataLoading />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ACESSO POR HIERARQUIA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>SESSÃO: {HIERARQUIA_META[hierarquiaSessao].label.toUpperCase()}</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Panorama da Equipe
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <KPI label="Efetivo Total" value={kpis.efetivo} icon="groups" tone="secondary" sub="Coordenação, supervisão e campo" />
        <KPI label="Coordenação" value={porHierarquia.coordenador.length} icon="military_tech" tone="secondary" sub="Integrantes cadastrados" />
        <KPI label="Equipe Técnica" value={porHierarquia.supervisor.length + porHierarquia.tecnico.length} icon="engineering" tone="secondary" sub="Supervisão e técnicos" />
      </div>

      {/* Hierarquia */}
      <section>
        <SectionHeader overline="ORGANIZAÇÃO" title="Estrutura por Hierarquia" />
        <div className="space-y-5">
          {(["coordenador", "supervisor", "tecnico"] as const).map((h) => (
            <div key={h} className="card-tonal p-6 shadow-ambient-sm">
              <div className="flex items-center gap-2 mb-4">
                <Icon name={HIERARQUIA_META[h].icon} filled className="text-secondary text-[20px]" />
                <MetaTag className="text-secondary">{HIERARQUIA_META[h].label.toUpperCase()}</MetaTag>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {porHierarquia[h].map((t) => {
                  const atuando = ocorrencias.filter(
                    (o) => o.tecnico_responsavel === t.id && ["em_andamento", "alta_prioridade"].includes(getOccurrenceStatusMeta(o.status).key),
                  );
                  const ultimaPagina = Math.max(0, Math.ceil(atuando.length / OCORRENCIAS_POR_MEMBRO) - 1);
                  const pagina = Math.min(paginasPorMembro[t.id] ?? 0, ultimaPagina);
                  const inicio = pagina * OCORRENCIAS_POR_MEMBRO;
                  return (
                    <div key={t.id} className="card-recessed p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-black text-primary">
                            {t.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-primary truncate">{t.nome}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-mono-tight">{t.cargo}</p>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-outline-variant/30 pt-2 space-y-1.5">
                        <MetaTag>ATUAÇÃO ATUAL {atuando.length > 0 && `· ${atuando.length}`}</MetaTag>
                        {erroOcorrencias ? (
                          <p className="text-xs text-error" role="alert">Não foi possível consultar as ocorrências.</p>
                        ) : atuando.length === 0 ? (
                          <p className="text-xs text-on-surface-variant">Sem ocorrência em andamento vinculada.</p>
                        ) : atuando.slice(inicio, inicio + OCORRENCIAS_POR_MEMBRO).map((o) => (
                          <Link key={o.id} href={`/occurrences?id=${o.id}`} aria-label={`Ver ocorrência ${o.id}: ${o.titulo}`} className="flex items-center gap-2 rounded-md bg-surface-container-low px-2.5 py-2 motion-safe:animate-[fadeIn_220ms_ease-out] transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-xs font-bold leading-snug text-primary"><span className="text-secondary">{o.id}</span> · {o.titulo}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug">
                                <span className="break-words text-on-surface-variant">{nomeZona(o.zona)}</span>
                                <span className={getOccurrenceStatusMeta(o.status).key === "alta_prioridade" ? "font-semibold text-error" : "font-medium text-on-surface-variant"}>· {getOccurrenceStatusMeta(o.status).label}</span>
                              </div>
                            </div>
                            <Icon name="chevron_right" className="shrink-0 text-[18px] text-secondary" />
                          </Link>
                        ))}
                        {!erroOcorrencias && atuando.length > OCORRENCIAS_POR_MEMBRO && (
                          <nav aria-label={`Ocorrências de ${t.nome}`} className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-[11px] text-on-surface-variant" aria-live="polite" aria-atomic="true">
                              {inicio + 1}–{Math.min(inicio + OCORRENCIAS_POR_MEMBRO, atuando.length)} de {atuando.length}
                            </span>
                            <label className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                              Página
                              <input
                                key={pagina}
                                type="number"
                                min={1}
                                max={ultimaPagina + 1}
                                step={1}
                                required
                                defaultValue={pagina + 1}
                                aria-label={`Página de ocorrências de ${t.nome}`}
                                title="Digite a página e pressione Enter"
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  const campo = event.currentTarget;
                                  if (!campo.reportValidity()) return;
                                  const destino = campo.valueAsNumber;
                                  if (!Number.isInteger(destino) || destino < 1 || destino > ultimaPagina + 1) return;
                                  setPaginasPorMembro((atual) => ({ ...atual, [t.id]: destino - 1 }));
                                  campo.value = String(destino);
                                }}
                                onBlur={(event) => { event.currentTarget.value = String(pagina + 1); }}
                                className="w-12 rounded-md border border-outline-variant/40 bg-surface-container-low px-1 py-1 text-center text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                              />
                              de {ultimaPagina + 1}
                            </label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={pagina === 0}
                                aria-label={`Ocorrências anteriores de ${t.nome}`}
                                onClick={() => setPaginasPorMembro((atual) => ({ ...atual, [t.id]: pagina - 1 }))}
                                className="rounded-md px-2 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Anterior
                              </button>
                              <button
                                type="button"
                                disabled={pagina === ultimaPagina}
                                aria-label={`Próximas ocorrências de ${t.nome}`}
                                onClick={() => setPaginasPorMembro((atual) => ({ ...atual, [t.id]: pagina + 1 }))}
                                className="rounded-md px-2 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Próxima
                              </button>
                            </div>
                          </nav>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Panorama de atendimentos com filtros */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader overline="PANORAMA" title="Atendimentos da Equipe" />

        <div className="flex flex-wrap gap-3 mb-6">
          <div>
            <MetaTag className="block mb-1.5">ZONA</MetaTag>
            <div className="relative">
              <select
                value={String(filtroZona)}
                onChange={(e) => setFiltroZona(e.target.value === "todas" ? "todas" : Number(e.target.value))}
                className="appearance-none bg-surface-container-low rounded-lg pl-4 pr-12 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
              >
                <option value="todas">Todas</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>{z.nome}</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-primary" />
            </div>
          </div>
          <div>
            <MetaTag className="block mb-1.5">TIPO DE OCORRÊNCIA</MetaTag>
            <div className="relative">
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="appearance-none bg-surface-container-low rounded-lg pl-4 pr-12 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
              >
                <option value="todas">Todos</option>
                {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-primary" />
            </div>
          </div>
        </div>

        {erroOcorrencias ? (
          <p className="text-sm text-error" role="alert">Não foi possível carregar os atendimentos. Atualize a página para tentar novamente.</p>
        ) : atendimentos.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant italic">Nenhum atendimento com os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-3 pr-4"><MetaTag>OCORRÊNCIA</MetaTag></th>
                  <th className="py-3 pr-4"><MetaTag>TÉCNICO</MetaTag></th>
                  <th className="py-3 pr-4"><MetaTag>ZONA</MetaTag></th>
                  <th className="py-3 pr-4"><MetaTag>TIPO</MetaTag></th>
                  <th className="py-3"><MetaTag>STATUS</MetaTag></th>
                </tr>
              </thead>
              <tbody>
                {atendimentos.map((o) => {
                  const tec = o.tecnico_responsavel != null ? tecnicoLookup.get(o.tecnico_responsavel) : undefined;
                  return (
                    <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 pr-4">
                        <Link href={`/occurrences?id=${o.id}`} className="text-[13px] font-bold text-primary hover:text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">#{o.id} · {o.titulo}</Link>
                      </td>
                      <td className="py-3.5 pr-4 text-[12px] text-on-surface">{tec?.nome ?? "—"}</td>
                      <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{nomeZona(o.zona)}</td>
                      <td className="py-3.5 pr-4"><Chip tone="neutral">{CATEGORIA_LABEL[o.categoria] ?? o.categoria}</Chip></td>
                      <td className="py-3.5">
                        <Chip tone={getOccurrenceStatusMeta(o.status).tone}>
                          {getOccurrenceStatusMeta(o.status).label}
                        </Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Emissão de relatórios */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader overline="EXPORTAÇÃO" title="Emitir Relatório da Equipe" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="flex flex-wrap gap-6">
            <div>
              <MetaTag className="block mb-2">PERÍODO</MetaTag>
              <div className="flex gap-2">
                {[
                  { id: "7d", label: "7 dias" },
                  { id: "30d", label: "30 dias" },
                  { id: "90d", label: "90 dias" },
                  { id: "custom", label: "Personalizado" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriodo(p.id)}
                    className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                      periodo === p.id ? "bg-primary text-white shadow-ambient-sm" : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {periodo === "custom" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <label>
                    <MetaTag className="block mb-1.5">DATA INICIAL</MetaTag>
                    <input
                      type="date"
                      value={dataInicial}
                      onChange={(e) => setDataInicial(e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </label>
                  <label>
                    <MetaTag className="block mb-1.5">DATA FINAL</MetaTag>
                    <input
                      type="date"
                      value={dataFinal}
                      onChange={(e) => setDataFinal(e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
            <div>
              <MetaTag className="block mb-2">INFORMAÇÕES INCLUÍDAS</MetaTag>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "atendimentos", label: "Atendimentos" },
                  { id: "ocorrencias", label: "Ocorrências" },
                  { id: "zonas", label: "Zonas" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setRelCampos((v) => ({ ...v, [c.id]: !v[c.id] }))}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                      relCampos[c.id] ? "bg-secondary/10 text-secondary ring-1 ring-secondary/40" : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    <Icon name={relCampos[c.id] ? "check_box" : "check_box_outline_blank"} className="text-[16px]" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Btn
            variant="primary"
            icon={emitindoRelatorio ? "progress_activity" : "download"}
            disabled={emitindoRelatorio}
            onClick={emitirRelatorio}
          >
            {emitindoRelatorio ? "Gerando..." : "Emitir Relatório"}
          </Btn>
        </div>
      </section>
    </div>
  );
}
