"use client";

import { useMemo } from "react";
import { Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_TECNICOS,
  MOCK_OCORRENCIAS,
  MOCK_HIST_ACOES_EQUIPE,
  STATUS_OCORRENCIA_LABEL,
  zonaNome,
} from "@/app/data/mock";

// simulação: técnico logado (mock enquanto não integrado)
const TECNICO_LOGADO_ID = 103;

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .toUpperCase()
    .replace(/\./g, "");
}

export default function ProfilePage() {
  const { user } = useGardian();

  const tecnico = MOCK_TECNICOS.find((t) => t.id === TECNICO_LOGADO_ID) ?? MOCK_TECNICOS[0];

  const minhas = useMemo(
    () => MOCK_OCORRENCIAS.filter((o) => o.tecnico_responsavel === tecnico.id),
    [tecnico.id],
  );
  const agindo = minhas.filter((o) => o.status === "em_andamento" || o.status === "alta_prioridade");
  const agiu = minhas.filter((o) => o.status === "concluido" || o.status === "aguardando" || o.status === "em_analise");

  const minhasAcoes = MOCK_HIST_ACOES_EQUIPE.filter((a) => a.tecnico === tecnico.id);

  const nomeExibicao = user?.user_sys?.username ?? tecnico.nome;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">MEU PERFIL · TÉCNICO</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>MATRÍCULA {tecnico.matricula}</MetaTag>
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
                {tecnico.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </span>
            </div>
            <div>
              <p className="font-headline font-black text-lg text-primary tracking-tight">{tecnico.nome}</p>
              <p className="text-[11px] text-on-surface-variant uppercase font-bold tracking-mono-tight">{tecnico.cargo}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: "badge", l: "Matrícula", v: tecnico.matricula },
              { icon: "hub", l: "Zona base", v: zonaNome(tecnico.zonaBase) },
              { icon: "call", l: "Telefone", v: tecnico.telefone },
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
              <StatusDot tone={tecnico.statusCampo === "em_campo" ? "error" : "secondary"} />
              <p className="text-[12px] font-black uppercase tracking-mono-tight text-primary">
                {tecnico.statusCampo === "em_campo" ? "Em campo" : tecnico.statusCampo === "disponivel" ? "Disponível" : "Offline"}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-5 content-start">
          <KPI label="Agindo Agora" value={agindo.length} icon="engineering" tone={agindo.length > 0 ? "error" : "secondary"} sub="Ocorrências em andamento" />
          <KPI label="Já Atuadas" value={agiu.length} icon="task_alt" tone="secondary" sub="Concluídas ou em observação" />
          <KPI label="Atendimentos (30d)" value={tecnico.atendimentos30d} icon="calendar_month" tone="secondary" sub="Registros no período" />
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
        {agindo.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant italic">Nenhuma ocorrência ativa no momento.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agindo.map((o) => (
              <div key={o.id} className="card-tonal p-6 shadow-ambient-sm relative overflow-hidden">
                <span className="absolute top-0 left-0 bottom-0 w-1 bg-error" />
                <div className="pl-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">#{o.id}</span>
                    <Chip tone="error">{STATUS_OCORRENCIA_LABEL[o.status]}</Chip>
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
        <SectionHeader overline="HISTÓRICO PESSOAL" title="Ocorrências em que agi" />
        <div className="card-tonal shadow-ambient-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-3.5 px-6"><MetaTag>OCORRÊNCIA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>ZONA</MetaTag></th>
                <th className="py-3.5 pr-4"><MetaTag>DATA</MetaTag></th>
                <th className="py-3.5 pr-6"><MetaTag>STATUS</MetaTag></th>
              </tr>
            </thead>
            <tbody>
              {agiu.map((o) => (
                <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                  <td className="py-3.5 px-6">
                    <p className="text-[13px] font-bold text-primary">#{o.id} · {o.titulo}</p>
                    <p className="text-[11px] text-on-surface-variant">{o.endereco}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{zonaNome(o.zona)}</td>
                  <td className="py-3.5 pr-4 text-[11px] font-mono font-bold text-slate-400">{formatDate(o.created_at)}</td>
                  <td className="py-3.5 pr-6">
                    <Chip tone={o.status === "concluido" ? "secondary" : "warning"}>
                      {STATUS_OCORRENCIA_LABEL[o.status]}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ações em campo */}
      <section>
        <SectionHeader overline="REGISTRO DE CAMPO" title="Minhas últimas ações" />
        <div className="relative pl-6 card-tonal p-7 shadow-ambient-sm">
          <span className="absolute left-[31px] top-9 bottom-9 w-px bg-outline-variant/50" />
          <div className="space-y-5">
            {minhasAcoes.map((a) => (
              <div key={a.id} className="relative pl-2">
                <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-secondary border-2 border-white shadow" />
                <MetaTag className="text-secondary">{a.quando}</MetaTag>
                <p className="text-[13px] font-bold text-primary mt-0.5">{a.acao}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {a.local} · {zonaNome(a.zona)}
                  {a.ocorrenciaId ? ` · Ocorrência #${a.ocorrenciaId}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
