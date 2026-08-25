"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Chip, Icon, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { api } from "@/app/services/Api";
import {
  MOCK_OCORRENCIAS,
  MOCK_HIST_PREVISOES_TEMPO,
  MOCK_HIST_PREVISOES_IA,
  MOCK_HIST_ACOES_EQUIPE,
  tecnicoNome,
  zonaNome,
} from "@/app/data/mock";
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

interface HistoryOccurrence {
  id: number;
  titulo: string;
  endereco?: string;
  categoria: string;
  zona: number | null;
  tecnico_responsavel: number | null;
  autor?: number | null;
  created_at: string;
  status: string;
  historico?: Array<{
    id: number;
    tipo_acao: "criacao" | "edicao" | "exclusao";
    campos_alterados?: string[];
    criado_em: string;
    usuario: number | null;
  }>;
}

interface HistoryUser {
  id: number;
  nome_anonimo: string | null;
  user_sys: { first_name: string; username: string } | null;
}

interface WeatherHistoryApi {
  id: number;
  clima_dia: Record<string, unknown>;
  precipitacao: number;
  created_at: string;
}

interface WeatherHistoryItem {
  data: string;
  orgao: string;
  previstoMm: number;
  realMm: number;
  desvio: number;
}

interface AlertApi {
  id: number;
  titulo: string;
  resumo: string;
  confianca: number;
  aprovado: boolean | null;
  status?: string;
  created_at?: string;
  zona?: number | null;
}

interface AiHistoryItem {
  id: number;
  titulo: string;
  data: string;
  zonaNome: string;
  confianca: number;
  status: "aprovado" | "descartado" | "pendente";
  desfecho: string;
}

interface TeamActionItem {
  id: string | number;
  tecnico: number;
  acao: string;
  local: string;
  zona: number | null;
  ocorrenciaId: number | null;
  quando: string;
}

const CAMPO_LABEL: Record<string, string> = {
  titulo: "título",
  categoria: "categoria",
  status: "status",
  descricao: "relato",
  coordenadas: "localização",
  endereco: "endereço",
  zona: "zona",
  evento: "evento",
  familia: "família",
  tecnico_responsavel: "responsável",
  nivel_perigo_tecnico: "nível de perigo",
  analise_tecnico: "análise técnica",
  valido_tecnico: "validação técnica",
};

function unwrapList<T>(value: T[] | Record<string, T[]>, key: string): T[] {
  if (Array.isArray(value)) return value;
  return value[key] ?? [];
}

function numeroMeteorologico(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buscarCampoNumerico(
  value: unknown,
  nomes: Set<string>,
  profundidade = 0,
): number | null {
  if (!value || typeof value !== "object" || profundidade > 3) return null;
  for (const [chave, conteudo] of Object.entries(value)) {
    const normalizada = chave.toLocaleLowerCase("pt-BR").replaceAll("-", "_");
    if (nomes.has(normalizada)) {
      const numero = numeroMeteorologico(conteudo);
      if (numero !== null) return numero;
    }
  }
  for (const conteudo of Object.values(value)) {
    const encontrado = buscarCampoNumerico(conteudo, nomes, profundidade + 1);
    if (encontrado !== null) return encontrado;
  }
  return null;
}

function textoMeteorologico(value: Record<string, unknown>, nomes: string[]): string | null {
  for (const nome of nomes) {
    const conteudo = value[nome];
    if (typeof conteudo === "string" && conteudo.trim()) return conteudo.trim();
  }
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .toUpperCase()
    .replace(/\./g, "");
}

export default function HistoryPage() {
  const { user } = useGardian();
  const [tab, setTab] = useState<"ocorrencias" | "tempo" | "ia" | "equipe">("ocorrencias");
  const [ocorrencias, setOcorrencias] = useState<HistoryOccurrence[]>(
    MOCK_OCORRENCIAS as HistoryOccurrence[],
  );
  const [zonaLookup, setZonaLookup] = useState<Map<number, string>>(new Map());
  const [usuarioLookup, setUsuarioLookup] = useState<Map<number, string>>(new Map());
  const [previsoesTempo, setPrevisoesTempo] = useState<WeatherHistoryItem[]>(
    MOCK_HIST_PREVISOES_TEMPO,
  );
  const [previsoesIa, setPrevisoesIa] = useState<AiHistoryItem[]>(
    MOCK_HIST_PREVISOES_IA.map((item) => ({ ...item, zonaNome: zonaNome(item.zona) })),
  );
  const [acoesEquipe, setAcoesEquipe] = useState<TeamActionItem[]>(MOCK_HIST_ACOES_EQUIPE);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [carregandoMeteorologia, setCarregandoMeteorologia] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      try {
        const [ocorrenciasResult, zonasResult, usuariosResult, alertasResult] = await Promise.allSettled([
          api.get<HistoryOccurrence[] | { ocorrencias: HistoryOccurrence[] }>("/ocorrencias/"),
          api.get<Array<{ id: number; nome: string }> | { zonas: Array<{ id: number; nome: string }> }>("/zonas/"),
          api.get<HistoryUser[] | { usuarios: HistoryUser[] }>("/usuarios/"),
          api.get<AlertApi[] | { alertas: AlertApi[] }>("/alertas/"),
        ]);
        if (cancelado) return;

        let ocorrenciasReais: HistoryOccurrence[] | null = null;
        let zonasReais = new Map<number, string>();
        if (ocorrenciasResult.status === "fulfilled") {
          ocorrenciasReais = unwrapList(ocorrenciasResult.value.data, "ocorrencias");
          setOcorrencias(ocorrenciasReais);
        }

        if (zonasResult.status === "fulfilled") {
          const zonas = unwrapList(zonasResult.value.data, "zonas");
          zonasReais = new Map(zonas.map((zona) => [zona.id, zona.nome]));
          setZonaLookup(zonasReais);
        }

        if (usuariosResult.status === "fulfilled") {
          const usuarios = unwrapList(usuariosResult.value.data, "usuarios");
          setUsuarioLookup(new Map(usuarios.map((usuario) => [
            usuario.id,
            usuario.user_sys?.first_name?.trim() ||
              usuario.nome_anonimo?.trim() ||
              usuario.user_sys?.username ||
              `Usuário #${usuario.id}`,
          ])));
        }

        if (alertasResult.status === "fulfilled") {
          const alertas = unwrapList(alertasResult.value.data, "alertas");
          setPrevisoesIa(alertas.map((alerta) => {
          const statusNormalizado = alerta.status?.trim().toLocaleLowerCase("pt-BR");
          const status: AiHistoryItem["status"] = statusNormalizado === "aprovado"
            ? "aprovado"
            : statusNormalizado === "descartado"
              ? "descartado"
              : alerta.aprovado === true
                ? "aprovado"
                : alerta.aprovado === false
                  ? "descartado"
                  : "pendente";
          return {
            id: alerta.id,
            titulo: alerta.titulo,
            data: alerta.created_at ? formatDate(alerta.created_at) : "DATA NÃO INFORMADA",
            zonaNome: alerta.zona != null
              ? zonasReais.get(alerta.zona) ?? `Zona #${alerta.zona}`
              : "Abrangência da entidade",
            confianca: Number(alerta.confianca || 0),
            status,
            desfecho: alerta.resumo || "Sem resumo informado.",
          };
          }));
        }

        if (ocorrenciasReais) {
          const acoes = ocorrenciasReais.flatMap((ocorrencia) =>
          (ocorrencia.historico ?? []).map((registro) => {
            const campos = (registro.campos_alterados ?? [])
              .map((campo) => CAMPO_LABEL[campo] ?? campo.replaceAll("_", " "));
            const acao = registro.tipo_acao === "criacao"
              ? "Ocorrência registrada no sistema"
              : registro.tipo_acao === "exclusao"
                ? "Ocorrência removida do sistema"
                : campos.length > 0
                  ? `Ocorrência atualizada: ${campos.join(", ")}`
                  : "Ocorrência atualizada";
            return {
              id: `${ocorrencia.id}-${registro.id}`,
              tecnico: registro.usuario ?? ocorrencia.tecnico_responsavel ?? ocorrencia.autor ?? 0,
              acao,
              local: ocorrencia.endereco || ocorrencia.titulo,
              zona: ocorrencia.zona,
              ocorrenciaId: ocorrencia.id,
              quando: formatDate(registro.criado_em),
              timestamp: new Date(registro.criado_em).getTime(),
            };
          }),
          ).sort((a, b) => b.timestamp - a.timestamp);
          if (acoes.length > 0) {
            setAcoesEquipe(acoes.map((acao) => ({
            id: acao.id,
            tecnico: acao.tecnico,
            acao: acao.acao,
            local: acao.local,
            zona: acao.zona,
            ocorrenciaId: acao.ocorrenciaId,
            quando: acao.quando,
            })));
          }
        }
      } finally {
        if (!cancelado) setCarregandoBase(false);
      }
    };

    void carregar();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.entidade == null) {
      const timer = window.setTimeout(() => setCarregandoMeteorologia(false), 0);
      return () => window.clearTimeout(timer);
    }
    let cancelado = false;
    api.get<WeatherHistoryApi[]>(`/metereologia/${user.entidade}/historico/`)
      .then((response) => {
        if (cancelado) return;
        const nomesPrevisao = new Set([
          "precipitacao_prevista",
          "previsao_precipitacao",
          "precipitation_sum",
          "rain_sum",
          "precipitacao",
          "chuva",
        ]);
        const itens = (response.data ?? []).flatMap<WeatherHistoryItem>((registro) => {
          const previsto = buscarCampoNumerico(registro.clima_dia, nomesPrevisao);
          const real = numeroMeteorologico(registro.precipitacao);
          if (previsto === null || real === null) return [];
          return [{
            data: new Date(registro.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            orgao: textoMeteorologico(registro.clima_dia, ["orgao", "fonte", "source", "modelo"]) ?? "METEO",
            previstoMm: previsto,
            realMm: real,
            desvio: real - previsto,
          }];
        });
        if (itens.length > 0) setPrevisoesTempo(itens);
      })
      .catch(() => {
        // Sem série utilizável no back: preserva o comparativo mockado.
      })
      .finally(() => {
        if (!cancelado) setCarregandoMeteorologia(false);
      });
    return () => { cancelado = true; };
  }, [user]);

  const maxMm = useMemo(
    () => Math.max(1, ...previsoesTempo.map((p) => Math.max(p.previstoMm, p.realMm))),
    [previsoesTempo],
  );

  const nomeZona = (zonaId: number | null) =>
    zonaId == null ? "Sem zona definida" : zonaLookup.get(zonaId) ?? zonaNome(zonaId);

  const nomeTecnico = (usuarioId: number) =>
    usuarioLookup.get(usuarioId) ?? (usuarioId ? tecnicoNome(usuarioId) : "Sistema");

  if (carregandoBase || carregandoMeteorologia) {
    return <DataLoading description="Preparando o histórico do sistema..." />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">REGISTROS DO SISTEMA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>DADOS RETROATIVOS</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Histórico
        </h1>
      </header>

      <div className="flex flex-wrap gap-2">
        <Tab active={tab === "ocorrencias"} onClick={() => setTab("ocorrencias")} icon="emergency">
          Todas as Ocorrências
        </Tab>
        <Tab active={tab === "tempo"} onClick={() => setTab("tempo")} icon="cloudy_snowing">
          Previsões de Tempo
        </Tab>
        <Tab active={tab === "ia"} onClick={() => setTab("ia")} icon="psychology">
          Previsões da IA
        </Tab>
        <Tab active={tab === "equipe"} onClick={() => setTab("equipe")} icon="footprint">
          Ações da Equipe
        </Tab>
      </div>

      {/* ── Todas as ocorrências ── */}
      {tab === "ocorrencias" && (
        <div className="card-tonal shadow-ambient-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-3.5 px-6"><MetaTag>OCORRÊNCIA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>CATEGORIA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>ZONA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>TÉCNICO</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>DATA</MetaTag></th>
                <th className="py-3.5 pr-6"><MetaTag>STATUS</MetaTag></th>
              </tr>
            </thead>
            <tbody>
              {[...ocorrencias]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((o) => (
                  <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                    <td className="py-3.5 px-6">
                      <p className="text-[13px] font-bold text-primary">#{o.id} · {o.titulo}</p>
                      <p className="text-[11px] text-on-surface-variant">{o.endereco}</p>
                    </td>
                    <td className="py-3.5 pr-4"><Chip tone="neutral">{CATEGORIA_LABEL[o.categoria] ?? o.categoria}</Chip></td>
                    <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{nomeZona(o.zona)}</td>
                    <td className="py-3.5 pr-4 text-[12px] text-on-surface">{o.tecnico_responsavel ? nomeTecnico(o.tecnico_responsavel) : "—"}</td>
                    <td className="py-3.5 pr-4 text-[11px] font-mono font-bold text-slate-400">{formatDate(o.created_at)}</td>
                    <td className="py-3.5 pr-6">
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

      {/* ── Previsões de tempo: previsto vs real ── */}
      {tab === "tempo" && (
        <div className="card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="COMPARATIVO"
            title="Previsto × Real (mm/24h)"
            action={
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                  <span className="w-3 h-3 rounded-sm bg-slate-300" /> Previsto
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
                  <span className="w-3 h-3 rounded-sm bg-secondary" /> Real
                </span>
              </div>
            }
          />
          <div className="space-y-5">
            {previsoesTempo.map((p, i) => {
              const desvioAlto = Math.abs(p.desvio) >= 10;
              return (
                <div key={i} className="grid grid-cols-[64px_1fr_auto] gap-4 items-center">
                  <div>
                    <p className="text-[13px] font-black text-primary">{p.data}</p>
                    <MetaTag>{p.orgao}</MetaTag>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-slate-300" style={{ width: `${(p.previstoMm / maxMm) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 w-16 text-right">{p.previstoMm.toFixed(1)}mm</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${desvioAlto ? "bg-error" : "bg-secondary"}`}
                          style={{ width: `${(p.realMm / maxMm) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-primary w-16 text-right">{p.realMm.toFixed(1)}mm</span>
                    </div>
                  </div>
                  <Chip tone={desvioAlto ? "error" : Math.abs(p.desvio) >= 5 ? "warning" : "secondary"}>
                    {p.desvio > 0 ? "+" : ""}{p.desvio.toFixed(1)}mm
                  </Chip>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-6 flex items-center gap-1.5">
            <Icon name="info" className="text-[14px]" />
            Desvios acima de 10mm ficam destacados e realimentam a calibração dos modelos.
          </p>
        </div>
      )}

      {/* ── Previsões da IA (incluindo descartadas) ── */}
      {tab === "ia" && (
        <div className="space-y-3">
          {previsoesIa.map((p) => (
            <div key={p.id} className={`card-tonal p-6 shadow-ambient-sm relative overflow-hidden ${p.status === "descartado" ? "opacity-70" : ""}`}>
              <span
                className={`absolute top-0 left-0 bottom-0 w-1 ${
                  p.status === "aprovado" ? "bg-secondary" : p.status === "descartado" ? "bg-slate-300" : "bg-orange-500"
                }`}
              />
              <div className="pl-3 flex items-center gap-5 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">PREV-{p.id}</span>
                    <MetaTag>{p.data}</MetaTag>
                  </div>
                  <p className="text-[14px] font-bold text-primary">{p.titulo}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{p.zonaNome}</p>
                </div>
                <div className="w-40">
                  <div className="flex items-center justify-between mb-1">
                    <MetaTag>CONFIANÇA</MetaTag>
                    <span className="text-[12px] font-black text-primary">{p.confianca.toFixed(1).replace(".", ",")}%</span>
                  </div>
                  <Bar value={p.confianca} tone={p.confianca >= 85 ? "error" : p.confianca >= 60 ? "warning" : "secondary"} />
                </div>
                <Chip tone={p.status === "aprovado" ? "secondary" : p.status === "descartado" ? "neutral" : "warning"}>
                  {p.status.toUpperCase()}
                </Chip>
                <p className="w-full lg:w-auto lg:max-w-[320px] text-[11px] text-on-surface-variant leading-relaxed">{p.desfecho}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Ações da equipe ── */}
      {tab === "equipe" && (
        <div className="card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="ONDE CADA TÉCNICO ESTEVE E O QUE FEZ" title="Ações em Campo" />
          <div className="relative pl-6">
            <span className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/50" />
            <div className="space-y-6">
              {acoesEquipe.map((a) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white shadow" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-black text-primary">{nomeTecnico(a.tecnico)}</span>
                    <MetaTag className="text-secondary">{a.quando}</MetaTag>
                    {a.ocorrenciaId && <Chip tone="neutral">#{a.ocorrenciaId}</Chip>}
                  </div>
                  <p className="text-[13px] text-on-surface mt-1">{a.acao}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1.5">
                    <Icon name="location_on" className="text-[13px]" /> {a.local} · {nomeZona(a.zona)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
