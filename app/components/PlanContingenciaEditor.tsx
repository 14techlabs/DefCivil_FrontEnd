"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Btn, Chip, Icon, MetaTag, SectionHeader } from "./Primitives";
import { ModalShell } from "./Modals";

export interface PlanconZona {
  id: number;
  nome: string;
  status: "critico" | "atencao" | "estavel";
}

export interface PlanconEvento {
  id: number;
  nome: string;
  status: string | null;
}

export interface PlanconPontoApoio {
  id: number;
  nome: string;
  endereco?: string;
}

export interface PlanconEquipe {
  efetivo: number;
  em_campo: number;
}

interface PlanconDraft {
  titulo: string;
  versao: string;
  status: "rascunho" | "em_revisao";
  inicioVigencia: string;
  fimVigencia: string;
  objetivo: string;
  abrangencia: string;
  baseLegal: string;
  caracterizacao: string;
  cenarios: string;
  criteriosAtivacao: string;
  autoridadeAtivacao: string;
  niveisResposta: string;
  estruturaComando: string;
  atribuicoes: string;
  monitoramentoAlerta: string;
  evacuacaoSocorro: string;
  abrigamentoAssistencia: string;
  recursos: string;
  comunicacao: string;
  desmobilizacao: string;
  revisao: string;
  simulados: string;
  elaborador: string;
  aprovador: string;
}

type SectionId =
  | "identificacao"
  | "caracterizacao"
  | "cenarios"
  | "ativacao"
  | "comando"
  | "procedimentos"
  | "recursos"
  | "comunicacao"
  | "revisao"
  | "anexos";

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "identificacao", label: "Identificação", icon: "description" },
  { id: "caracterizacao", label: "Caracterização", icon: "location_city" },
  { id: "cenarios", label: "Cenários de risco", icon: "warning" },
  { id: "ativacao", label: "Critérios de ativação", icon: "notifications_active" },
  { id: "comando", label: "Comando e atribuições", icon: "account_tree" },
  { id: "procedimentos", label: "Procedimentos", icon: "checklist" },
  { id: "recursos", label: "Recursos e abrigos", icon: "inventory_2" },
  { id: "comunicacao", label: "Comunicação", icon: "campaign" },
  { id: "revisao", label: "Revisão e simulados", icon: "event_repeat" },
  { id: "anexos", label: "Anexos", icon: "attach_file" },
];

function defaultDraft(entidadeNome: string, responsavel: string, contato: string): PlanconDraft {
  return {
    titulo: `Plano de Contingência de Proteção e Defesa Civil de ${entidadeNome}`,
    versao: "1.0",
    status: "rascunho",
    inicioVigencia: "",
    fimVigencia: "",
    objetivo: "Orientar as ações de preparação e resposta aos cenários de risco do município, definindo responsabilidades, recursos e fluxos de acionamento.",
    abrangencia: `Território do município de ${entidadeNome}, incluindo áreas urbanas e rurais cadastradas.`,
    baseLegal: "Lei Federal nº 12.608/2012 e demais normas aplicáveis à Proteção e Defesa Civil.",
    caracterizacao: "",
    cenarios: "",
    criteriosAtivacao: "",
    autoridadeAtivacao: responsavel,
    niveisResposta: "Observação, Atenção, Alerta e Emergência.",
    estruturaComando: "",
    atribuicoes: "",
    monitoramentoAlerta: "",
    evacuacaoSocorro: "",
    abrigamentoAssistencia: "",
    recursos: "",
    comunicacao: contato,
    desmobilizacao: "",
    revisao: "Revisão anual e sempre que houver alteração relevante nos cenários, recursos ou responsáveis.",
    simulados: "",
    elaborador: responsavel,
    aprovador: "",
  };
}

function Field({ label, value, onChange, rows = 4, type = "textarea" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  type?: "text" | "date" | "textarea";
}) {
  const className = "w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary";
  return (
    <label className="block">
      <MetaTag className="mb-1.5 block">{label.toUpperCase()}</MetaTag>
      {type === "textarea" ? (
        <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} resize-y`} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={className} />
      )}
    </label>
  );
}

export function PlanContingenciaEditor({
  entidadeId,
  entidadeNome,
  responsavel,
  contato,
  zonas,
  eventos,
  familiasEmRisco,
  totalPessoas,
  pontos,
  equipe,
  onToast,
}: {
  entidadeId: number;
  entidadeNome: string;
  responsavel: string;
  contato: string;
  zonas: PlanconZona[];
  eventos: PlanconEvento[];
  familiasEmRisco: number;
  totalPessoas: number;
  pontos: PlanconPontoApoio[];
  equipe: PlanconEquipe | null;
  onToast: (message: string, tone?: "error" | "secondary") => void;
}) {
  const storageKey = `gardian:plancon:${entidadeId}`;
  const [section, setSection] = useState<SectionId>("identificacao");
  const [draft, setDraft] = useState(() => defaultDraft(entidadeNome, responsavel, contato));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      try {
        setDraft((current) => ({ ...current, ...JSON.parse(saved) as Partial<PlanconDraft> }));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const update = <K extends keyof PlanconDraft>(key: K, value: PlanconDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveLocal = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    onToast("Rascunho salvo neste navegador.");
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(event.target.files ?? []).map((file) => file.name);
    setAttachments((current) => [...new Set([...current, ...names])]);
    event.target.value = "";
  };

  const zonasPrioritarias = zonas.filter((zona) => zona.status !== "estavel");
  const sectionTitle = SECTIONS.find((item) => item.id === section)?.label ?? "Plano";
  const contextualData = useMemo(() => [
    { label: "Zonas prioritárias", value: zonasPrioritarias.length, detail: zonasPrioritarias.map((zona) => zona.nome).join(", ") || "Nenhuma" },
    { label: "Eventos em curso", value: eventos.length, detail: eventos.map((evento) => evento.nome).join(", ") || "Nenhum" },
    { label: "Famílias em risco", value: familiasEmRisco, detail: `${totalPessoas} pessoas cadastradas` },
    { label: "Pontos de apoio", value: pontos.length, detail: pontos.map((ponto) => ponto.nome).join(", ") || "Nenhum" },
    { label: "Equipe", value: equipe?.efetivo ?? 0, detail: equipe ? `${equipe.em_campo} integrante(s) em campo` : "Panorama indisponível" },
  ], [equipe, eventos, familiasEmRisco, pontos, totalPessoas, zonasPrioritarias]);

  return (
    <>
      <section className="card-tonal overflow-hidden shadow-ambient-sm">
        <div className="bg-primary px-7 py-6 text-white flex items-start justify-between gap-5 flex-wrap">
          <div>
            <MetaTag className="text-secondary-fixed-dim">DOCUMENTO MUNICIPAL</MetaTag>
            <h2 className="mt-1 font-headline text-3xl font-black tracking-tighter">{draft.titulo}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-white/70">
              <Chip tone="warning">{draft.status === "rascunho" ? "Rascunho local" : "Em revisão"}</Chip>
              <span>Versão {draft.versao}</span>
              <span>·</span>
              <span>{draft.inicioVigencia && draft.fimVigencia ? `${draft.inicioVigencia} a ${draft.fimVigencia}` : "Vigência não definida"}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn variant="ghostDark" icon="visibility" onClick={() => setPreviewOpen(true)}>Visualizar</Btn>
            <Btn variant="success" icon="save" onClick={saveLocal}>Salvar rascunho</Btn>
          </div>
        </div>

        <div className="grid grid-cols-12 min-h-[620px]">
          <nav className="col-span-12 lg:col-span-3 xl:col-span-2 border-r border-outline-variant/25 bg-surface-container-low p-3" aria-label="Seções do plano">
            <MetaTag className="block px-3 py-3">CONTEÚDO DO DOCUMENTO</MetaTag>
            {SECTIONS.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`w-full flex items-center gap-2 rounded-lg px-3 py-3 text-left text-[11px] font-bold transition-colors ${section === item.id ? "bg-secondary/12 text-secondary" : "text-on-surface-variant hover:bg-surface-container"}`}>
                <span className="w-5 text-[10px] font-mono">{String(index + 1).padStart(2, "0")}</span>
                <Icon name={item.icon} className="text-[16px]" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="col-span-12 lg:col-span-6 xl:col-span-7 p-7">
            <SectionHeader overline={`EDIÇÃO · ${sectionTitle.toUpperCase()}`} title={sectionTitle} />
            <div className="space-y-5">
              {section === "identificacao" && <><Field label="Título" value={draft.titulo} onChange={(value) => update("titulo", value)} type="text" /><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Field label="Versão" value={draft.versao} onChange={(value) => update("versao", value)} type="text" /><label><MetaTag className="mb-1.5 block">STATUS</MetaTag><select value={draft.status} onChange={(event) => update("status", event.target.value as PlanconDraft["status"])} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-secondary"><option value="rascunho">Rascunho</option><option value="em_revisao">Em revisão</option></select></label><Field label="Início da vigência" value={draft.inicioVigencia} onChange={(value) => update("inicioVigencia", value)} type="date" /><Field label="Fim da vigência" value={draft.fimVigencia} onChange={(value) => update("fimVigencia", value)} type="date" /></div><Field label="Objetivo" value={draft.objetivo} onChange={(value) => update("objetivo", value)} /><Field label="Abrangência" value={draft.abrangencia} onChange={(value) => update("abrangencia", value)} /><Field label="Base legal e normativa" value={draft.baseLegal} onChange={(value) => update("baseLegal", value)} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Responsável pela elaboração" value={draft.elaborador} onChange={(value) => update("elaborador", value)} type="text" /><Field label="Autoridade aprovadora" value={draft.aprovador} onChange={(value) => update("aprovador", value)} type="text" /></div></>}
              {section === "caracterizacao" && <><Field label="Caracterização do município" value={draft.caracterizacao} onChange={(value) => update("caracterizacao", value)} rows={10} /><div><MetaTag className="mb-1.5 block">POPULAÇÃO E ÁREAS VULNERÁVEIS</MetaTag><div className="rounded-lg bg-surface-container-low px-4 py-3 text-sm font-medium text-primary">{familiasEmRisco} família(s) em área de risco entre {totalPessoas} pessoa(s) cadastrada(s).</div></div></>}
              {section === "cenarios" && <><Field label="Descrição dos cenários de risco" value={draft.cenarios} onChange={(value) => update("cenarios", value)} rows={14} /><p className="text-[11px] text-on-surface-variant">Use as zonas e os eventos exibidos ao lado como referência para caracterizar cada cenário.</p></>}
              {section === "ativacao" && <><Field label="Autoridade competente para ativação" value={draft.autoridadeAtivacao} onChange={(value) => update("autoridadeAtivacao", value)} type="text" /><Field label="Critérios e gatilhos de ativação" value={draft.criteriosAtivacao} onChange={(value) => update("criteriosAtivacao", value)} rows={10} /><Field label="Níveis de resposta" value={draft.niveisResposta} onChange={(value) => update("niveisResposta", value)} /></>}
              {section === "comando" && <><Field label="Estrutura de comando" value={draft.estruturaComando} onChange={(value) => update("estruturaComando", value)} rows={8} /><Field label="Órgãos, funções e atribuições" value={draft.atribuicoes} onChange={(value) => update("atribuicoes", value)} rows={10} /></>}
              {section === "procedimentos" && <><Field label="Monitoramento, alerta e alarme" value={draft.monitoramentoAlerta} onChange={(value) => update("monitoramentoAlerta", value)} rows={7} /><Field label="Evacuação, busca e socorro" value={draft.evacuacaoSocorro} onChange={(value) => update("evacuacaoSocorro", value)} rows={7} /><Field label="Abrigamento e assistência" value={draft.abrigamentoAssistencia} onChange={(value) => update("abrigamentoAssistencia", value)} rows={7} /><Field label="Desmobilização e retorno à normalidade" value={draft.desmobilizacao} onChange={(value) => update("desmobilizacao", value)} rows={7} /></>}
              {section === "recursos" && <><Field label="Recursos humanos, veículos e equipamentos" value={draft.recursos} onChange={(value) => update("recursos", value)} rows={10} /><div><MetaTag className="mb-2 block">PONTOS DE APOIO CADASTRADOS</MetaTag><div className="space-y-2">{pontos.map((ponto) => <div key={ponto.id} className="card-recessed p-3"><p className="text-[12px] font-bold text-primary">{ponto.nome}</p><p className="text-[10px] text-on-surface-variant">{ponto.endereco || "Endereço não informado"}</p></div>)}</div></div></>}
              {section === "comunicacao" && <Field label="Plano de comunicação, alerta e informação pública" value={draft.comunicacao} onChange={(value) => update("comunicacao", value)} rows={14} />}
              {section === "revisao" && <><Field label="Periodicidade e responsáveis pela revisão" value={draft.revisao} onChange={(value) => update("revisao", value)} rows={7} /><Field label="Capacitações e exercícios simulados" value={draft.simulados} onChange={(value) => update("simulados", value)} rows={9} /></>}
              {section === "anexos" && <><label className="block rounded-xl border border-dashed border-outline-variant p-8 text-center cursor-pointer hover:bg-surface-container-low"><Icon name="upload_file" className="text-secondary text-[28px]" /><p className="mt-2 text-sm font-bold text-primary">Adicionar mapas e documentos</p><p className="text-[11px] text-on-surface-variant">Os arquivos permanecem somente nesta sessão enquanto não houver armazenamento no back.</p><input type="file" multiple onChange={addFiles} className="sr-only" /></label>{attachments.map((name) => <div key={name} className="card-recessed flex items-center gap-3 p-3"><Icon name="description" className="text-secondary" /><span className="text-[12px] font-bold text-primary">{name}</span></div>)}</>}
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-3 border-l border-outline-variant/25 bg-surface-container-low p-5">
            <MetaTag className="block mb-3">DADOS DISPONÍVEIS NO SISTEMA</MetaTag>
            <div className="space-y-2">
              {contextualData.map((item) => <div key={item.label} className="card-recessed p-3"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-primary">{item.label}</p><span className="font-headline font-black text-lg text-secondary">{item.value}</span></div><p className="mt-1 text-[10px] leading-relaxed text-on-surface-variant">{item.detail}</p></div>)}
            </div>
            <div className="mt-4 rounded-lg bg-secondary/10 p-3 text-[10px] leading-relaxed text-secondary">Esses dados auxiliam a elaboração, mas só passam a integrar o documento quando descritos e validados pelo responsável.</div>
          </aside>
        </div>
      </section>

      <ModalShell open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="max-w-5xl">
        <article className="max-h-[85vh] overflow-y-auto bg-white p-10 text-slate-900">
          <div className="border-b border-slate-300 pb-6 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em]">{entidadeNome}</p><h2 className="mt-4 text-3xl font-black">{draft.titulo}</h2><p className="mt-2 text-sm">Versão {draft.versao} · {draft.inicioVigencia || "—"} a {draft.fimVigencia || "—"}</p></div>
          {[ ["1. Objetivo", draft.objetivo], ["2. Abrangência", draft.abrangencia], ["3. Base legal", draft.baseLegal], ["4. Caracterização municipal", draft.caracterizacao], ["5. Cenários de risco", draft.cenarios], ["6. Critérios de ativação", `${draft.autoridadeAtivacao}\n${draft.criteriosAtivacao}\n${draft.niveisResposta}`], ["7. Comando e atribuições", `${draft.estruturaComando}\n${draft.atribuicoes}`], ["8. Procedimentos operacionais", `${draft.monitoramentoAlerta}\n${draft.evacuacaoSocorro}\n${draft.abrigamentoAssistencia}`], ["9. Recursos", draft.recursos], ["10. Comunicação", draft.comunicacao], ["11. Desmobilização", draft.desmobilizacao], ["12. Revisão e simulados", `${draft.revisao}\n${draft.simulados}`] ].map(([title, content]) => <section key={title} className="mt-7"><h3 className="text-lg font-black">{title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7">{content || "Não preenchido."}</p></section>)}
          <div className="mt-10 border-t border-slate-300 pt-6 text-sm"><p><strong>Elaboração:</strong> {draft.elaborador || "Não informado"}</p><p className="mt-2"><strong>Aprovação:</strong> {draft.aprovador || "Não informado"}</p></div>
        </article>
      </ModalShell>
    </>
  );
}
