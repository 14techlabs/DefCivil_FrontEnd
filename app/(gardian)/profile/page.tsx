"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chip, Icon, KPI, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { api } from "@/app/services/Api";
import { getOccurrenceStatusMeta, type OccurrenceStatusKey } from "@/app/lib/occurrenceStatus";

interface ProfileOccurrenceHistory {
  id: number;
  tipo_acao: "criacao" | "edicao" | "exclusao";
  campos_alterados: string[];
  criado_em: string;
  usuario: number | null;
}

interface ProfileOccurrence {
  id: number;
  titulo: string;
  status: string;
  endereco?: string;
  zona: number | null;
  tecnico_responsavel: number | null;
  created_at: string;
  historico?: ProfileOccurrenceHistory[];
}

interface ProfileOccurrencesResponse {
  ocorrencias: ProfileOccurrence[];
}

const CARGO_LABEL: Record<number, string> = {
  1: "Coordenador",
  2: "Supervisor",
  3: "Técnico",
  4: "Agente de campo",
  5: "Voluntário",
};

const STATUS_CAMPO_LABEL: Record<string, string> = {
  em_campo: "Em campo",
  disponivel: "Disponível",
  offline: "Offline",
};

const ACTION_META = {
  criacao: { label: "Ocorrência criada", icon: "add_circle", tone: "secondary" as const },
  edicao: { label: "Ocorrência atualizada", icon: "edit", tone: "info" as const },
  exclusao: { label: "Ocorrência excluída", icon: "delete", tone: "error" as const },
};

const CAMPO_LABEL: Record<string, string> = {
  status: "situação",
  titulo: "título",
  descricao: "relato",
  endereco: "endereço",
  zona: "zona",
  zona_id: "zona",
  evento: "evento",
  evento_id: "evento",
  tecnico_responsavel: "responsável",
  tecnico_responsavel_id: "responsável",
};

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .toUpperCase()
    .replace(/\./g, "");
}

export default function ProfilePage() {
  const { user } = useGardian();
  const [ocorrencias, setOcorrencias] = useState<ProfileOccurrence[]>([]);
  const [zonas, setZonas] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [tentativaCarga, setTentativaCarga] = useState(0);
  const [filtro, setFiltro] = useState<"todas" | OccurrenceStatusKey>("todas");
  const [limiteOcorrencias, setLimiteOcorrencias] = useState(5);
  const [limiteAcoes, setLimiteAcoes] = useState(5);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.allSettled([
      api.get<ProfileOccurrencesResponse>("/ocorrencias/", { params: { pagina: 1 } }),
      api.get<{ zonas: { id: number; nome: string }[] }>("/zonas/"),
    ]).then(([occResult, zoneResult]) => {
      if (cancelled) return;
      setOcorrencias(
        occResult.status === "fulfilled" ? occResult.value.data.ocorrencias ?? [] : [],
      );
      setErroCarga(occResult.status === "rejected");
      setZonas(
        new Map(
          zoneResult.status === "fulfilled"
            ? (zoneResult.value.data.zonas ?? []).map((zona) => [zona.id, zona.nome])
            : [],
        ),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tentativaCarga]);

  const minhas = useMemo(
    () => ocorrencias.filter((ocorrencia) => ocorrencia.tecnico_responsavel === user?.id),
    [ocorrencias, user?.id],
  );
  const agindo = minhas.filter((o) => getOccurrenceStatusMeta(o.status).key === "em_andamento");
  const concluidas = minhas.filter((o) => getOccurrenceStatusMeta(o.status).key === "concluida");
  const ocorrenciasCriadas30d = minhas.filter((ocorrencia) => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    return new Date(ocorrencia.created_at) >= limite;
  }).length;
  const minhasAcoes = minhas
    .flatMap((ocorrencia) =>
      (ocorrencia.historico ?? [])
        .filter((acao) => acao.usuario === user?.id)
        .map((acao) => ({ ...acao, ocorrencia })),
    )
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const nomeExibicao = user?.user_sys?.first_name || user?.user_sys?.username || "Usuário";
  const listaOcorrencias = minhas.filter((o) => filtro === "todas" || getOccurrenceStatusMeta(o.status).key === filtro)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const cargo = user?.cargo_label?.trim()
    || (user?.cargo != null ? CARGO_LABEL[user.cargo] ?? "Cargo não identificado" : "Cargo não informado");
  const matricula = user?.matricula?.trim() || "Não informada";
  const zonaBase = user?.zona_base == null ? "Não informada" : zonas.get(user.zona_base) ?? `Zona #${user.zona_base}`;
  const statusCampo = user?.status_campo_label?.trim()
    || (user?.status_campo ? STATUS_CAMPO_LABEL[user.status_campo] ?? "Status não identificado" : "Não informado");
  const iniciais = nomeExibicao
    .split(" ")
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const zonaNome = (zonaId: number | null) =>
    zonaId == null ? "Sem zona" : zonas.get(zonaId) ?? `Zona #${zonaId}`;

  if (loading) {
    return <DataLoading />;
  }

  if (erroCarga) {
    return (
      <div className="mx-auto max-w-[1600px] p-4 sm:p-8">
        <div className="card-tonal p-8 text-center shadow-ambient-sm" role="alert">
          <p className="text-sm font-semibold text-primary">Não foi possível carregar as ocorrências.</p>
          <p className="mt-2 text-sm text-on-surface-variant">Tente novamente para consultar os dados.</p>
          <button type="button" onClick={() => { setLoading(true); setTentativaCarga((valor) => valor + 1); }} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2">Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
      <header>
        <MetaTag className="text-secondary">DETALHES DA CONTA E ATIVIDADE</MetaTag>
        <h1 className="mt-2 font-headline text-3xl font-black tracking-tight text-primary sm:text-4xl">Meu perfil</h1>
      </header>

      <section aria-label="Informações do usuário" className="card-tonal overflow-hidden shadow-ambient-sm">
        <div className="flex items-center gap-4 border-b border-outline-variant/20 p-5 sm:px-7 sm:py-6">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">
            {iniciais}
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-headline text-xl font-bold tracking-tight text-primary sm:text-2xl">{nomeExibicao}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{cargo}</p>
          </div>
        </div>
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2 lg:gap-8">
          <div>
            <h3 className="mb-4 text-sm font-bold text-primary">Contato</h3>
            <dl className="space-y-4">
              <div className="flex items-start gap-3">
                <Icon name="call" className="mt-0.5 text-[20px] text-secondary" />
                <div className="min-w-0">
                  <dt className="text-xs text-on-surface-variant">Telefone</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-primary">{user?.telefone || "Não informado"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Icon name="mail" className="mt-0.5 text-[20px] text-secondary" />
                <div className="min-w-0">
                  <dt className="text-xs text-on-surface-variant">E-mail</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-primary">{user?.user_sys?.email || "Não informado"}</dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="border-t border-outline-variant/20 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h3 className="mb-4 text-sm font-bold text-primary">Informações funcionais</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-on-surface-variant">Matrícula</dt>
                <dd className="mt-1 break-words text-sm text-primary">{matricula}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Zona base</dt>
                <dd className="mt-1 break-words text-sm text-primary">{zonaBase}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Status de campo</dt>
                <dd className="mt-1 text-sm text-primary">{statusCampo}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Usuário de acesso</dt>
                <dd className="mt-1 break-words text-sm text-primary">{user?.user_sys?.username || "Não informado"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section aria-label="Resumo de atividade" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPI label="Em andamento" value={agindo.length} icon="engineering" tone={agindo.length > 0 ? "error" : "secondary"} sub="Ocorrências atribuídas" />
        <KPI label="Concluídas" value={concluidas.length} icon="task_alt" tone="secondary" sub="Ocorrências finalizadas" />
        <KPI label="Últimos 30 dias" value={ocorrenciasCriadas30d} icon="calendar_month" tone="secondary" sub="Ocorrências criadas no período" />
        <KPI label="Ações registradas" value={minhasAcoes.length} icon="history" tone="secondary" sub="Atividades no histórico" />
      </section>
      <section aria-label="Minhas ocorrências">
        <SectionHeader overline="ACOMPANHAMENTO" title="Minhas ocorrências" />
        <div className="card-tonal overflow-hidden shadow-ambient-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-outline-variant/20 bg-surface-container-low/40 px-5 py-3">
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <label htmlFor="profile-occurrence-status" className="sr-only">Situação da ocorrência</label>
              <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-secondary"><Icon name="filter_list" className="text-[20px]" /></span>
                <select
                  id="profile-occurrence-status"
                  value={filtro}
                  onChange={(event) => { setFiltro(event.target.value as "todas" | OccurrenceStatusKey); setLimiteOcorrencias(5); }}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-outline-variant/40 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-secondary/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                >
            {([
              { id: "todas", label: "Todas", total: minhas.length },
              { id: "alta_prioridade", label: "Alta prioridade", total: minhas.filter((o) => getOccurrenceStatusMeta(o.status).key === "alta_prioridade").length },
              { id: "em_andamento", label: "Em andamento", total: agindo.length },
              { id: "aguardando", label: "Aguardando", total: minhas.filter((o) => getOccurrenceStatusMeta(o.status).key === "aguardando").length },
              { id: "em_analise", label: "Em análise", total: minhas.filter((o) => getOccurrenceStatusMeta(o.status).key === "em_analise").length },
              { id: "concluida", label: "Concluídas", total: concluidas.length },
            ] as const).map((opcao) => (
              <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
            ))}
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-on-surface-variant"><Icon name="expand_more" className="text-[20px]" /></span>
              </div>
            </div>
            <p role="status" className="ml-auto text-right text-xs text-on-surface-variant">
              {listaOcorrencias.length} {listaOcorrencias.length === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}
            </p>
          </div>
          {listaOcorrencias.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-on-surface-variant">Nenhuma ocorrência encontrada.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/20">
              {listaOcorrencias.slice(0, limiteOcorrencias).map((o) => (
                <li key={o.id}>
                  <Link href={`/occurrences?id=${o.id}`} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold text-primary group-hover:text-secondary">
                        <span className="mr-2 font-mono text-xs font-medium text-on-surface-variant">#{o.id}</span>
                        {o.titulo}
                      </p>
                      <p className="mt-1 break-words text-xs text-on-surface-variant">
                        {zonaNome(o.zona)}{o.endereco ? ` · ${o.endereco}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Chip tone={getOccurrenceStatusMeta(o.status).tone}>{getOccurrenceStatusMeta(o.status).label}</Chip>
                        <time dateTime={o.created_at} className="text-xs text-on-surface-variant">Criada em {formatDate(o.created_at)}</time>
                      </div>
                    </div>
                    <Icon name="chevron_right" className="shrink-0 text-[20px] text-on-surface-variant" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {listaOcorrencias.length > 5 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 px-5 py-3">
              <p className="text-xs text-on-surface-variant">{Math.min(limiteOcorrencias, listaOcorrencias.length)} de {listaOcorrencias.length} ocorrências</p>
              <button type="button" onClick={() => setLimiteOcorrencias(limiteOcorrencias < listaOcorrencias.length ? limiteOcorrencias + 5 : 5)} className="rounded px-2 py-1 text-sm font-bold text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">
                {limiteOcorrencias < listaOcorrencias.length ? "Mostrar mais ocorrências" : "Mostrar menos"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Últimas ações">
        <SectionHeader overline="ATIVIDADE RECENTE" title="Últimas ações" />
        <div className="card-tonal overflow-hidden shadow-ambient-sm">
          {minhasAcoes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">Nenhuma ação registrada até o momento.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/20">
              {minhasAcoes.slice(0, limiteAcoes).map((a) => {
                const meta = ACTION_META[a.tipo_acao];
                const campos = [...new Set(a.campos_alterados.map((campo) => CAMPO_LABEL[campo] ?? campo.replaceAll("_", " ")))];
                return (
                  <li key={`${a.ocorrencia.id}-${a.id}`} className="flex items-start gap-3 px-5 py-4">
                    <Icon name={meta.icon} className={`mt-0.5 shrink-0 text-[20px] ${a.tipo_acao === "exclusao" ? "text-error" : "text-secondary"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-semibold text-primary">{meta.label}</p>
                        <time dateTime={a.criado_em} className="text-xs text-on-surface-variant">{formatDate(a.criado_em)}</time>
                      </div>
                      <Link href={`/occurrences?id=${a.ocorrencia.id}`} className="mt-1 block break-words rounded text-sm text-on-surface-variant hover:text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">
                        #{a.ocorrencia.id} · {a.ocorrencia.titulo}
                      </Link>
                      {a.tipo_acao === "edicao" && campos.length > 0 && (
                        <details className="mt-2 text-xs text-on-surface-variant">
                          <summary className="w-fit cursor-pointer rounded py-1 font-semibold text-secondary focus-visible:ring-2 focus-visible:ring-secondary">Ver alterações</summary>
                          <p className="mt-1 leading-relaxed">Campos alterados: {campos.join(", ")}.</p>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {minhasAcoes.length > 5 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 px-5 py-3">
              <p className="text-xs text-on-surface-variant">{Math.min(limiteAcoes, minhasAcoes.length)} de {minhasAcoes.length} ações</p>
              <button type="button" onClick={() => setLimiteAcoes(limiteAcoes < minhasAcoes.length ? limiteAcoes + 5 : 5)} className="rounded px-2 py-1 text-sm font-bold text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary">
                {limiteAcoes < minhasAcoes.length ? "Mostrar mais ações" : "Mostrar menos"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
