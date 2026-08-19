"use client";

import { useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, StatusDot } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_TECNICOS,
  MOCK_OCORRENCIAS,
  MOCK_ZONAS,
  zonaNome,
} from "@/app/data/mock";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";

const CATEGORIA_LABEL: Record<string, string> = {
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

const HIERARQUIA_META: Record<string, { label: string; icon: string; nivel: number }> = {
  coordenador: { label: "Coordenação", icon: "military_tech", nivel: 3 },
  supervisor: { label: "Supervisão", icon: "supervisor_account", nivel: 2 },
  tecnico: { label: "Técnicos de Campo", icon: "engineering", nivel: 1 },
};

const CAMPO_META: Record<string, { label: string; tone: "error" | "warning" | "secondary" | "neutral" }> = {
  em_campo: { label: "Em campo", tone: "error" },
  disponivel: { label: "Disponível", tone: "secondary" },
  offline: { label: "Offline", tone: "neutral" },
};

// simulação de sessão: hierarquia do usuário logado (mock)
const HIERARQUIA_SESSAO: "coordenador" | "supervisor" | "tecnico" = "coordenador";

export default function TeamPage() {
  const { showToast } = useGardian();

  const [filtroZona, setFiltroZona] = useState<number | "todas">("todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [periodo, setPeriodo] = useState("30d");
  const [relCampos, setRelCampos] = useState<Record<string, boolean>>({
    atendimentos: true,
    ocorrencias: true,
    zonas: true,
    tempos: false,
  });

  const temAcesso = HIERARQUIA_META[HIERARQUIA_SESSAO].nivel >= 2;

  // panorama de atendimentos (ocorrências com técnico responsável)
  const atendimentos = useMemo(() => {
    return MOCK_OCORRENCIAS.filter((o) => o.tecnico_responsavel != null).filter((o) => {
      if (filtroZona !== "todas" && o.zona !== filtroZona) return false;
      if (filtroCategoria !== "todas" && o.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [filtroZona, filtroCategoria]);

  const emCampo = MOCK_TECNICOS.filter((t) => t.statusCampo === "em_campo").length;
  const totalAtendimentos30d = MOCK_TECNICOS.reduce((a, t) => a + t.atendimentos30d, 0);

  const porHierarquia = useMemo(() => {
    const grupos: Record<string, typeof MOCK_TECNICOS> = { coordenador: [], supervisor: [], tecnico: [] };
    for (const t of MOCK_TECNICOS) grupos[t.hierarquia].push(t);
    return grupos;
  }, []);

  if (!temAcesso) {
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

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ACESSO POR HIERARQUIA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>SESSÃO: {HIERARQUIA_META[HIERARQUIA_SESSAO].label.toUpperCase()}</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Panorama da Equipe
        </h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI label="Efetivo Total" value={MOCK_TECNICOS.length} icon="groups" tone="secondary" sub="Coordenação, supervisão e campo" />
        <KPI label="Em Campo Agora" value={emCampo} icon="engineering" tone={emCampo > 0 ? "warning" : "secondary"} sub="Atuando em ocorrências" />
        <KPI label="Atendimentos (30d)" value={totalAtendimentos30d} icon="task_alt" tone="secondary" sub="Toda a equipe" />
        <KPI label="Zonas Cobertas" value={new Set(MOCK_TECNICOS.map((t) => t.zonaBase)).size} icon="hub" tone="secondary" sub="Com técnico de referência" />
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
                  const campo = CAMPO_META[t.statusCampo];
                  const atuando = MOCK_OCORRENCIAS.filter(
                    (o) => o.tecnico_responsavel === t.id && (o.status === "em_andamento" || o.status === "alta_prioridade"),
                  );
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
                        <Chip tone={campo.tone}>{campo.label}</Chip>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-[10px] font-mono font-bold uppercase tracking-mono text-slate-400">
                        <span>{t.matricula}</span>
                        <span>{zonaNome(t.zonaBase)}</span>
                        <span>{t.atendimentos30d} ATEND./30D</span>
                      </div>
                      {atuando.length > 0 && (
                        <p className="text-[11px] text-error font-bold mt-2 flex items-center gap-1.5">
                          <StatusDot tone="error" /> Atuando em #{atuando.map((o) => o.id).join(", #")}
                        </p>
                      )}
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
            <select
              value={String(filtroZona)}
              onChange={(e) => setFiltroZona(e.target.value === "todas" ? "todas" : Number(e.target.value))}
              className="bg-surface-container-low rounded-lg px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
            >
              <option value="todas">Todas</option>
              {MOCK_ZONAS.map((z) => (
                <option key={z.id} value={z.id}>{z.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <MetaTag className="block mb-1.5">TIPO DE OCORRÊNCIA</MetaTag>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-surface-container-low rounded-lg px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-secondary outline-none"
            >
              <option value="todas">Todos</option>
              {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {atendimentos.length === 0 ? (
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
                  const tec = MOCK_TECNICOS.find((t) => t.id === o.tecnico_responsavel);
                  return (
                    <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 pr-4">
                        <p className="text-[13px] font-bold text-primary">#{o.id} · {o.titulo}</p>
                      </td>
                      <td className="py-3.5 pr-4 text-[12px] text-on-surface">{tec?.nome ?? "—"}</td>
                      <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{zonaNome(o.zona)}</td>
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
            </div>
            <div>
              <MetaTag className="block mb-2">INFORMAÇÕES INCLUÍDAS</MetaTag>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "atendimentos", label: "Atendimentos" },
                  { id: "ocorrencias", label: "Ocorrências" },
                  { id: "zonas", label: "Zonas" },
                  { id: "tempos", label: "Tempos de resposta" },
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
            icon="download"
            onClick={() =>
              showToast(
                `Relatório (${periodo}) emitido com ${Object.values(relCampos).filter(Boolean).length} seções.`,
              )
            }
          >
            Emitir Relatório
          </Btn>
        </div>
      </section>
    </div>
  );
}
