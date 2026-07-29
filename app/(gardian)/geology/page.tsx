"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Btn, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { ADAPTABRASIL } from "@/app/data/adaptabrasil";
import { api } from "@/app/services/Api";

type GeoNode = {
  id: string;
  label: string;
  description?: string;
  value?: number;
  parent?: string;
  leaf?: boolean;
  composition?: { id: string; label: string; value: number }[];
  factors?: { label: string; weight: number }[];
};

// AdaptaBrasil gauge — 5-color gradient scale with needle at value (0..1)
function AdaptaGauge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const LEVELS = ADAPTABRASIL.LEVELS;
  const level = LEVELS.find(l => value >= l.range[0] && value <= l.range[1]) || LEVELS[0];
  const pct = value * 100;
  const heightCls = size === "lg" ? "h-4" : size === "sm" ? "h-2" : "h-3";
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-headline font-black text-5xl tracking-tighter" style={{ color: level.color }}>
          {value.toFixed(2).replace(".", ",")}
        </span>
        <span className="font-headline font-black text-xl tracking-tight" style={{ color: level.color }}>
          {level.label}
        </span>
        <span className="text-[15px] font-mono font-bold" style={{ color: level.color }}>
          ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="relative">
        <div className={`w-full ${heightCls} rounded-sm overflow-hidden flex`}>
          {LEVELS.map(l => (
            <div key={l.id} className="flex-1" style={{ background: l.color }} />
          ))}
        </div>
        {/* Needle */}
        <div className="absolute top-[-4px] bottom-[-4px] w-[3px] bg-primary" style={{ left: `${pct}%`, transform: "translateX(-1.5px)" }} />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono font-bold text-slate-400">0 · 0%</span>
          <span className="text-[10px] font-mono font-bold text-slate-400">1,00 · 100%</span>
        </div>
      </div>
    </div>
  );
}

// Mini inline gauge for composition rows — mostra a % do valor ao lado da barra
function MiniGauge({ value }: { value: number }) {
  const LEVELS = ADAPTABRASIL.LEVELS;
  const v = value ?? 0;
  const pct = v * 100;
  const level = LEVELS.find(l => v >= l.range[0] && v <= l.range[1]) || LEVELS[0];
  return (
    <div className="flex items-center gap-2 flex-1 max-w-[240px]">
      <div className="relative flex-1 max-w-[180px]">
        <div className="w-full h-2 rounded-sm overflow-hidden flex">
          {LEVELS.map(l => <div key={l.id} className="flex-1" style={{ background: l.color }} />)}
        </div>
        <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-primary" style={{ left: `${pct}%`, transform: "translateX(-1px)" }} />
      </div>
      <span className="text-[11px] font-mono font-bold w-10 text-right flex-shrink-0" style={{ color: level.color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

type ImpactType = (typeof ADAPTABRASIL.TYPES)[number];

// Card genérico de estado (sem dados / carregando / erro) — mantém a
// identidade visual do tipo selecionado.
function EstadoCard({
  type,
  titulo,
  texto,
  children,
}: {
  type: ImpactType;
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card-tonal p-12 shadow-ambient-sm text-center">
      <div
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: type.color + "1A" }}>
        <Icon name={type.icon} filled className="text-[32px]" style={{ color: type.color }} />
      </div>
      <h3 className="font-headline font-black text-2xl text-primary tracking-tight">{titulo}</h3>
      <p className="text-sm text-on-surface-variant mt-2 max-w-lg mx-auto">{texto}</p>
      {children}
    </div>
  );
}

function LevelLegend() {
  const LEVELS = ADAPTABRASIL.LEVELS;
  return (
    <div className="card-tonal p-5 shadow-ambient-sm">
      <MetaTag className="block mb-3">ESCALA ADAPTABRASIL · IPCC</MetaTag>
      <div className="space-y-2">
        {LEVELS.map(l => (
          <div key={l.id} className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[12px] font-bold text-primary flex-1">{l.label}</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">{l.rangeLabel}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <span className="w-4 h-4 rounded-sm bg-slate-200 flex-shrink-0" />
          <span className="text-[12px] font-bold text-slate-400 flex-1">Dado indisponível</span>
        </div>
      </div>
    </div>
  );
}

export default function GeologyPage() {
  const { alertMode } = useGardian();
  const TYPES = ADAPTABRASIL.TYPES;

  const [selectedType, setSelectedType] = useState("geohidrologicos");
  const selectedTypeData = TYPES.find((t) => t.id === selectedType) ?? TYPES[0];
  const indicadorId = selectedTypeData.indicador;
  // Cada indicador do AdaptaBrasil tem seu próprio ano-base (geo-hidrológico
  // é 2015, hídricos 2020, rodoviária 2021...). Por isso o ano vai junto.
  const anoBase = selectedTypeData.ano;
  // Alguns setores do AdaptaBrasil não são medidos por município (portos e
  // trechos de rodovia/ferrovia). Num painel municipal, eles não se aplicam.
  const porMunicipio = selectedTypeData.resolucao === "municipio";

  // Árvore do indicador do tipo selecionado. O setor geo-hidrológico tem o mock
  // estático como reserva; os demais dependem exclusivamente do backend.
  const [GEO, setGEO] = useState<Record<string, GeoNode>>(
    ADAPTABRASIL.GEO as Record<string, GeoNode>
  );
  const [path, setPath] = useState<string[]>(["root"]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0); // usado pelo botão "Tentar de novo"

  useEffect(() => {
    // Tipo ainda sem indicador mapeado: a UI mostra o aviso, sem chamar a API.
    if (indicadorId == null || !porMunicipio) {
      setErro(null);
      setLoading(false);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setErro(null);

    api
      .get<{ geo: Record<string, GeoNode>; root?: string }>(
        `geologia/arvore/?indicador=${indicadorId}&ano=${anoBase}`
      )
      .then((res) => {
        if (cancelado) return;
        if (res.data?.geo && Object.keys(res.data.geo).length > 0) {
          setGEO(res.data.geo);
          setPath([res.data.root ?? "root"]); // volta ao topo com os dados reais
        } else {
          setErro("O AdaptaBrasil não retornou dados para este indicador.");
        }
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Não foi possível carregar os dados deste indicador.";
        if (selectedType === "geohidrologicos") {
          // Só este setor tem mock de reserva — mantém a tela utilizável.
          setGEO(ADAPTABRASIL.GEO as Record<string, GeoNode>);
          setPath(["root"]);
        } else {
          setErro(msg);
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [indicadorId, anoBase, porMunicipio, selectedType, tentativa]);

  const currentId = path[path.length - 1];
  const current: GeoNode | undefined = GEO[currentId] ?? GEO.root;

  const drillInto = (id: string) => {
    if (GEO[id] && !GEO[id].leaf) setPath([...path, id]);
  };
  const goBack = (idx: number) => {
    setPath(path.slice(0, idx + 1));
  };

  const breadcrumb = useMemo(() => {
    return path.map((id) => ({ id, label: GEO[id]?.label || id }));
  }, [path, GEO]);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ADAPTABRASIL · MCTI</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>BASE CONCEITUAL CONFORME DEFINIÇÕES DO IPCC</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>DEFESA CIVIL</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">Risco Climático</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">{`Indicadores de impacto integrados por tipo de situação · ${selectedTypeData.label} · Escala de 0,00 a 1,00`}</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" icon="tune">Opções</Btn>
          </div>
        </div>
      </header>

      {/* Type selector — 7 impact types */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MetaTag className="text-secondary">TIPOS DE IMPACTO</MetaTag>
          <span className="text-[10px] text-on-surface-variant">Selecione para explorar indicadores</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {TYPES.map(t => {
            const active = selectedType === t.id;
            return (
              <button key={t.id} onClick={() => { setSelectedType(t.id); setPath(["root"]); }}
                className={`p-5 rounded-xl text-left transition-all relative overflow-hidden ${
                  active ? "shadow-ambient -translate-y-0.5" : "shadow-ambient-sm hover:-translate-y-0.5"
                }`}
                style={{
                  background: active ? t.color : "#fff",
                  color: active ? "#fff" : undefined,
                }}>
                {t.focus && !active && (
                  <span className="absolute top-2 right-2 text-[8px] font-mono font-black uppercase tracking-mono text-white px-1.5 py-0.5 rounded" style={{ background: t.color }}>FOCO</span>
                )}
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: active ? "rgba(255,255,255,0.18)" : t.color + "1A" }}>
                  <Icon name={t.icon} filled className="text-[22px]" style={{ color: active ? "#fff" : t.color }} />
                </div>
                <p className={`text-[12px] font-headline font-black leading-tight tracking-tight ${active ? "text-white" : "text-primary"}`}>{t.label}</p>
                <p className={`text-[10px] mt-1 ${active ? "text-white/70" : "text-on-surface-variant"}`}>
                  {t.subcategories.length} indicadores
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Área principal: aviso / carregando / erro / árvore de drill-down */}
      {!porMunicipio ? (
        <EstadoCard
          type={selectedTypeData}
          titulo={selectedTypeData.label}
          texto={`O AdaptaBrasil publica este setor por ${
            selectedTypeData.resolucao === "porto"
              ? "porto (21 portos no Brasil)"
              : selectedTypeData.resolucao === "trechorodovia"
              ? "trecho de rodovia (7.304 trechos)"
              : "trecho de ferrovia (2.741 trechos)"
          }, e não por município. Por isso não há um índice municipal para exibir neste painel.`}
        />
      ) : indicadorId == null ? (
        <EstadoCard
          type={selectedTypeData}
          titulo={selectedTypeData.label}
          texto={`Este setor ainda não está associado a um indicador do AdaptaBrasil. Descubra o id em GET /geologia/indicadores/ e preencha o campo "indicador" deste tipo em app/data/adaptabrasil.ts.`}
        />
      ) : loading ? (
        <EstadoCard
          type={selectedTypeData}
          titulo={`Carregando ${selectedTypeData.label}…`}
          texto="Consultando o AdaptaBrasil e montando a árvore de indicadores."
        />
      ) : erro || !current ? (
        <EstadoCard
          type={selectedTypeData}
          titulo={selectedTypeData.label}
          texto={erro ?? "Sem dados para exibir."}>
          <button
            onClick={() => setTentativa((n) => n + 1)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-white text-[12px] font-bold hover:opacity-90">
            <Icon name="refresh" className="text-[16px]" /> Tentar de novo
          </button>
        </EstadoCard>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Left column — drill-down indicator detail */}
          <div className="col-span-12 lg:col-span-7 space-y-5">
            {/* Breadcrumb drill-down path */}
            <div className="card-tonal p-5 shadow-ambient-sm">
              <MetaTag className="block mb-3">NAVEGAÇÃO</MetaTag>
              <div className="space-y-2">
                {/* Voltar um nível — só aparece quando já se desceu na árvore */}
                {path.length > 1 && (
                  <button
                    onClick={() => goBack(path.length - 2)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-secondary w-full text-left hover:opacity-90 transition-opacity">
                    <Icon name="arrow_back" className="text-white text-[18px]" />
                    <span className="text-[12px] font-bold text-white">
                      Voltar para {GEO[path[path.length - 2]]?.label ?? "o nível anterior"}
                    </span>
                  </button>
                )}
                {/* Trilha real da árvore: cada item volta para aquele nível */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-container-low">
                  <Icon name={selectedTypeData.icon} className="text-on-surface-variant text-[16px]" />
                  <span className="text-[12px] font-bold text-primary">{selectedTypeData.label}</span>
                </div>
                {breadcrumb.map((b, i) => {
                  const atual = i === breadcrumb.length - 1;
                  return (
                    <button
                      key={b.id}
                      onClick={() => goBack(i)}
                      disabled={atual}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md w-full text-left ${
                        atual
                          ? "bg-secondary/20 cursor-default"
                          : "bg-secondary/10 hover:bg-secondary/15"
                      }`}
                      style={{ marginLeft: `${i * 10}px` }}>
                      <Icon
                        name={atual ? "my_location" : "arrow_back"}
                        className="text-secondary text-[16px]"
                      />
                      <span className="text-[12px] font-bold text-secondary">{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current indicator */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: selectedTypeData.color + "1A" }}>
                  <Icon name={selectedTypeData.icon} filled className="text-[24px]" style={{ color: selectedTypeData.color }} />
                </div>
                <div className="flex-1">
                  <MetaTag className="block mb-1">
                    {(current.parent ? GEO[current.parent]?.label ?? selectedTypeData.label : selectedTypeData.label).toUpperCase()}
                  </MetaTag>
                  <h2 className="font-headline font-black text-2xl text-primary tracking-tight leading-tight">{current.label}</h2>
                </div>
              </div>

              <AdaptaGauge value={current.value ?? 0} size="lg" />

              <p className="text-[13px] text-on-surface-variant leading-relaxed mt-5">{current.description}</p>

              <button className="text-[12px] font-bold text-secondary mt-3 hover:underline">Mais sobre esse dado →</button>
            </div>

            {/* Composition */}
            {current.composition && current.composition.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">Composição</h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2">
                  {current.composition.map(c => {
                    const hasDrill = GEO[c.id] && !GEO[c.id].leaf;
                    return (
                      <button key={c.id} onClick={() => drillInto(c.id)}
                        disabled={!hasDrill}
                        className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-all ${
                          hasDrill ? "bg-surface-container-low hover:bg-secondary/8 cursor-pointer" : "bg-surface-container-low opacity-75 cursor-default"
                        }`}>
                        <Icon name="arrow_forward" className="text-secondary text-[14px]" />
                        <span className="text-[13px] font-bold text-secondary flex-1">{c.label}</span>
                        <MiniGauge value={c.value} />
                        {hasDrill && <Icon name="chevron_right" className="text-on-surface-variant text-[18px]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fatores influenciadores */}
            {current.factors && current.factors.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">Fatores Influenciadores</h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {current.factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-surface-container-low">
                      <Icon name="expand_more" className="text-secondary text-[16px]" />
                      <span className="text-[12px] text-secondary flex-1 leading-snug">{f.label}</span>
                      <div className="w-24 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500" style={{ width: `${Math.min(100, f.weight * 4)}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-primary w-12 text-right">{f.weight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Map + Legend */}
          <div className="col-span-12 lg:col-span-5 space-y-5">
            <div className="card-tonal p-2 shadow-ambient-sm relative">
              {alertMode && (
                <div className="absolute top-6 left-6 z-20">
                  <div className="bg-error text-white px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-mono-tight flex items-center gap-2 shadow-ambient">
                    <Icon name="warning" filled className="text-[16px]" /> NÍVEL CRÍTICO DETECTADO
                  </div>
                </div>
              )}
              <MapPlaceholder variant="topo" height={420} />
            </div>

            <LevelLegend />

            {/* Quick zone ranking by current indicator */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader overline="RANKING · PRESENTE" title="Zonas por Índice" />
              <div className="space-y-2">
                {[
                  { zone: "Morro da Esperança", val: 0.89 },
                  { zone: "Porto Seguro - Bahia - Zona Sul", val: 0.82 },
                  { zone: "Vila Esperança - Setor B", val: 0.74 },
                  { zone: "Vale das Acácias", val: 0.51 },
                  { zone: "Zona Rural Norte", val: 0.28 },
                  { zone: "Centro Industrial", val: 0.12 },
                ].map((r, i) => {
                  const lvl = ADAPTABRASIL.LEVELS.find((l) => r.val >= l.range[0] && r.val <= l.range[1]);
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-surface-container-low">
                      <span className="text-[10px] font-mono font-black text-slate-400 w-5">{String(i+1).padStart(2,"0")}</span>
                      <span className="text-[12px] font-bold text-primary flex-1 truncate">{r.zone}</span>
                      <MiniGauge value={r.val} />
                      <span className="text-[11px] font-headline font-black w-12 text-right" style={{ color: lvl?.color ?? "#5b6370" }}>
                        {r.val.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}