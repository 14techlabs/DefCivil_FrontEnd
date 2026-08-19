"use client";

import { useEffect, useMemo, useState } from "react";
import { Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

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

const CARGO_LABEL: Record<number, string> = {
  1: "Coordenador",
  2: "Supervisor",
  3: "Técnico",
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.allSettled([
      api.get<{ ocorrencias: ProfileOccurrence[] }>("/ocorrencias/"),
      api.get<{ zonas: { id: number; nome: string }[] }>("/zonas/"),
    ]).then(([occResult, zoneResult]) => {
      if (cancelled) return;
      setOcorrencias(
        occResult.status === "fulfilled" ? occResult.value.data.ocorrencias ?? [] : [],
      );
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
  }, [user]);

  const minhas = useMemo(
    () => ocorrencias.filter((ocorrencia) => ocorrencia.tecnico_responsavel === user?.id),
    [ocorrencias, user?.id],
  );
  const agindo = minhas.filter((o) => o.status === "em_andamento" || o.status === "alta_prioridade");
  const agiu = minhas
    .filter((o) => o.status === "concluida" || o.status === "aguardando" || o.status === "em_analise")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const atendimentos30d = minhas.filter((ocorrencia) => {
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
  const cargo = user?.cargo != null ? CARGO_LABEL[user.cargo] ?? "Técnico" : "Técnico";
  const iniciais = nomeExibicao
    .split(" ")
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const zonaNome = (zonaId: number | null) =>
    zonaId == null ? "Sem zona" : zonas.get(zonaId) ?? `Zona #${zonaId}`;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">MEU PERFIL · TÉCNICO</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          {nomeExibicao}
        </h1>
      </header>

      {/* Cartão do técnico + KPIs */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-4 card-tonal p-7 shadow-ambient-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <span className="text-white font-black text-xl tracking-tight">
                {iniciais}
              </span>
            </div>
            <div>
              <p className="font-headline font-black text-lg text-primary tracking-tight">{nomeExibicao}</p>
              <p className="text-[11px] text-on-surface-variant uppercase font-bold tracking-mono-tight">{cargo}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: "badge", l: "Matrícula", v: "Não informada" },
              { icon: "hub", l: "Zona base", v: "Não informada" },
              { icon: "call", l: "Telefone", v: user?.telefone || "Não informado" },
              { icon: "mail", l: "E-mail", v: user?.user_sys?.email || "Não informado" },
              { icon: "badge", l: "Perfil", v: cargo },
            ].map((it, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
                <Icon name={it.icon} className="text-secondary text-[18px]" />
                <div>
                  <MetaTag className="block">{it.l.toUpperCase()}</MetaTag>
                  <p className="text-[13px] font-bold text-primary">{it.v}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low">
              <StatusDot tone="secondary" live={false} />
              <p className="text-[12px] font-black uppercase tracking-mono-tight text-primary">
                Status de campo não informado
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-5 content-start">
          <KPI label="Agindo Agora" value={agindo.length} icon="engineering" tone={agindo.length > 0 ? "error" : "secondary"} sub="Ocorrências em andamento" />
          <KPI label="Já Atuadas" value={agiu.length} icon="task_alt" tone="secondary" sub="Concluídas ou em observação" />
          <KPI label="Atendimentos (30d)" value={atendimentos30d} icon="calendar_month" tone="secondary" sub="Ocorrências atribuídas no período" />
          <KPI label="Ações em Campo" value={minhasAcoes.length} icon="footprint" tone="secondary" sub="Registradas no histórico" />
        </div>
      </div>

      {/* Agindo agora */}
      <section>
        <SectionHeader
          overline="EM ANDAMENTO"
          title="Ocorrências em que estou agindo"
          action={agindo.length > 0 ? <Chip tone="error" icon="podcasts">{agindo.length} ATIVA(S)</Chip> : undefined}
        />
        {loading ? (
          <p className="text-[12px] text-on-surface-variant italic">Carregando ocorrências…</p>
        ) : agindo.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant italic">Nenhuma ocorrência ativa no momento.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agindo.map((o) => (
              <div key={o.id} className="card-tonal p-6 shadow-ambient-sm relative overflow-hidden">
                <span className={`absolute top-0 left-0 bottom-0 w-1 ${getOccurrenceStatusMeta(o.status).accentClass}`} />
                <div className="pl-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">#{o.id}</span>
                    <Chip tone={getOccurrenceStatusMeta(o.status).tone}>{getOccurrenceStatusMeta(o.status).label}</Chip>
                  </div>
                  <h3 className="font-headline font-bold text-[15px] text-primary">{o.titulo}</h3>
                  <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                    <Icon name="location_on" className="text-[14px]" /> {o.endereco}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    {zonaNome(o.zona)} · {formatDate(o.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Já atuadas */}
      <section>
        <SectionHeader
          overline="HISTÓRICO PESSOAL"
          title="Ocorrências em que agi"
          action={agiu.length > 0 ? <Chip tone="secondary">{agiu.length} REGISTRO(S)</Chip> : undefined}
        />
        <div className="card-tonal overflow-hidden shadow-ambient-sm">
          {loading ? (
            <p className="p-8 text-center text-sm text-on-surface-variant">Carregando ocorrências…</p>
          ) : agiu.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Icon name="task_alt" className="mb-3 text-[38px] text-on-surface-variant/50" />
              <p className="text-sm font-medium text-on-surface-variant">
                Nenhuma ocorrência anterior encontrada.
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/60">
                <th className="w-[48%] px-6 py-4"><MetaTag>OCORRÊNCIA</MetaTag></th>
                <th className="w-[18%] py-4 pr-5"><MetaTag>ZONA</MetaTag></th>
                <th className="w-[18%] py-4 pr-5"><MetaTag>REGISTRADA EM</MetaTag></th>
                <th className="w-[16%] py-4 pr-6"><MetaTag>SITUAÇÃO</MetaTag></th>
              </tr>
            </thead>
            <tbody>
              {agiu.map((o) => (
                <tr key={o.id} className="border-b border-outline-variant/15 transition-colors last:border-0 hover:bg-surface-container-low">
                  <td className="px-6 py-4">
                    <a href={`/occurrences?id=${o.id}`} className="group block">
                      <span className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-mono text-slate-400">
                        OCORRÊNCIA #{o.id}
                      </span>
                      <span className="block truncate text-[13px] font-bold text-primary transition-colors group-hover:text-secondary">
                        {o.titulo}
                      </span>
                      {o.endereco && (
                        <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-on-surface-variant">
                          <Icon name="home_pin" className="shrink-0 text-[13px]" /> {o.endereco}
                        </span>
                      )}
                    </a>
                  </td>
                  <td className="py-4 pr-5 text-[12px] font-medium text-on-surface-variant">
                    <span className="flex items-center gap-1.5"><Icon name="location_on" className="text-[14px]" />{zonaNome(o.zona)}</span>
                  </td>
                  <td className="py-4 pr-5 text-[11px] font-mono font-bold text-slate-500">{formatDate(o.created_at)}</td>
                  <td className="py-4 pr-6">
                    <Chip tone={getOccurrenceStatusMeta(o.status).tone}>
                      {getOccurrenceStatusMeta(o.status).label}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
      </section>

      {/* Ações em campo */}
      <section>
        <SectionHeader overline="REGISTRO DE CAMPO" title="Minhas últimas ações" />
        <div className="card-tonal p-4 shadow-ambient-sm sm:p-6">
          <div className="space-y-3">
            {minhasAcoes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Icon name="history" className="mb-3 text-[36px] text-on-surface-variant/60" />
                <p className="text-sm font-medium text-on-surface-variant">
                  Nenhuma ação registrada até o momento.
                </p>
              </div>
            )}
            {minhasAcoes.map((a) => {
              const meta = ACTION_META[a.tipo_acao];
              const campos = [...new Set(a.campos_alterados.map((campo) => CAMPO_LABEL[campo] ?? campo.replaceAll("_", " ")))];
              return (
                <article
                  key={`${a.ocorrencia.id}-${a.id}`}
                  className="group rounded-xl border border-outline-variant/20 bg-white p-4 transition-all hover:border-secondary/30 hover:shadow-ambient-sm sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      a.tipo_acao === "exclusao"
                        ? "bg-error-container text-error"
                        : a.tipo_acao === "edicao"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-secondary/10 text-secondary"
                    }`}>
                      <Icon name={meta.icon} filled className="text-[20px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Chip tone={meta.tone}>{meta.label.toUpperCase()}</Chip>
                        <MetaTag>{formatDate(a.criado_em)}</MetaTag>
                      </div>

                      <a
                        href={`/occurrences?id=${a.ocorrencia.id}`}
                        className="mt-3 block font-headline text-[15px] font-black text-primary transition-colors hover:text-secondary"
                      >
                        #{a.ocorrencia.id} · {a.ocorrencia.titulo}
                      </a>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
                        {a.ocorrencia.endereco && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="home_pin" className="text-[14px]" />
                            {a.ocorrencia.endereco}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Icon name="location_on" className="text-[14px]" />
                          {zonaNome(a.ocorrencia.zona)}
                        </span>
                      </div>

                      {a.tipo_acao === "edicao" && campos.length > 0 && (
                        <p className="mt-3 border-t border-outline-variant/15 pt-3 text-[11px] text-on-surface-variant">
                          <strong className="text-primary">Informações alteradas:</strong> {campos.join(", ")}.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
