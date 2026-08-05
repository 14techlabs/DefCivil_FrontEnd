"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
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
  municipio?: string;
  composition?: { id: string; label: string; value: number }[];
  factors?: { id?: string; label: string; value?: number | null }[];
};

/** Ficha geológica cadastrada em campo (GET/PUT geologia/zona/<id>/cadastro/). */
type CadastroZona = {
  id?: number;
  zona?: number;
  litologia: string;
  tipo_solo: string;
  declividade: string;
  suscetibilidade: "alta" | "media" | "baixa";
  observacoes: string;
};

type ZonaResumo = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  area: unknown | null;
  cadastro: CadastroZona | null;
};

type ArvoreResposta = {
  municipio?: string;
  indicador?: number;
  ano?: number;
  root?: string;
  geo: Record<string, GeoNode>;
  zona?: ZonaResumo;
};

const VAZIO: Record<string, GeoNode> = {};

const FICHA_VAZIA: CadastroZona = {
  litologia: "",
  tipo_solo: "",
  declividade: "",
  suscetibilidade: "media",
  observacoes: "",
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
          <span className="text-[10px] font-mono font-bold text-slate-400">0</span>
          <span className="text-[10px] font-mono font-bold text-slate-400">1,00</span>
        </div>
      </div>
    </div>
  );
}

// Mini inline gauge for composition rows
function MiniGauge({ value }: { value: number }) {
  const LEVELS = ADAPTABRASIL.LEVELS;
  const pct = value * 100;
  return (
    <div className="relative flex-1 max-w-[180px]">
      <div className="w-full h-2 rounded-sm overflow-hidden flex">
        {LEVELS.map(l => <div key={l.id} className="flex-1" style={{ background: l.color }} />)}
      </div>
      <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-primary" style={{ left: `${pct}%`, transform: "translateX(-1px)" }} />
    </div>
  );
}

/** Valor numérico exato, colorido pela faixa da escala AdaptaBrasil. */
function ValorExato({ value, className = "" }: { value?: number | null; className?: string }) {
  if (value == null) {
    return (
      <span className={`text-[11px] font-headline font-black text-slate-400 ${className}`}>
        —
      </span>
    );
  }
  const nivel = ADAPTABRASIL.LEVELS.find((l) => value >= l.range[0] && value <= l.range[1]);
  return (
    <span
      className={`text-[11px] font-headline font-black tabular-nums ${className}`}
      style={{ color: nivel?.color ?? "#5b6370" }}
      title={nivel?.label}
    >
      {value.toFixed(2).replace(".", ",")}
    </span>
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
  const TYPES = ADAPTABRASIL.TYPES;
  const { showToast, alertMode } = useGardian();

  // ── seleção de setor ──
  const [selectedType, setSelectedType] = useState("geohidrologicos");
  const selectedTypeData = TYPES.find((t) => t.id === selectedType) ?? TYPES[0];
  const indicadorId = selectedTypeData.indicador;
  // Cada indicador do AdaptaBrasil tem seu próprio ano-base (geo-hidrológico é
  // 2015, hídricos 2020, rodoviária 2021...), por isso o ano acompanha o setor.
  const anoBase = selectedTypeData.ano;
  // Portos e trechos de rodovia/ferrovia não são medidos por município — num
  // painel municipal esses setores não se aplicam.
  const porMunicipio = selectedTypeData.resolucao === "municipio";

  // ── seleção de zona (opcional) ──
  const [zonas, setZonas] = useState<ZonaResumo[]>([]);
  const [zonaSel, setZonaSel] = useState<number | null>(null);

  // ── árvore vinda da API ──
  // O resultado é guardado junto com a "chave" da consulta que o produziu
  // (indicador|ano|zona|tentativa). Assim `loading` e `erro` são DERIVADOS da
  // comparação entre a chave atual e a carregada — não precisamos chamar
  // setState de forma síncrona dentro do efeito, só dentro do .then/.catch.
  const [resultado, setResultado] = useState<
    { chave: string; geo: Record<string, GeoNode>; municipio: string | null } | null
  >(null);
  const [falha, setFalha] = useState<
    { chave: string; msg: string; campoFaltante?: string } | null
  >(null);
  const [path, setPath] = useState<string[]>(["root"]);
  const [tentativa, setTentativa] = useState(0);

  // ── cadastro geológico por zona ──
  const [editZona, setEditZona] = useState<number | null>(null);
  const [form, setForm] = useState<CadastroZona>(FICHA_VAZIA);
  const [salvando, setSalvando] = useState(false);

  const msgErro = useCallback((e: unknown, padrao: string) => {
    return (
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? padrao
    );
  }, []);

  const campoErro = useCallback((e: unknown) => {
    return (e as { response?: { data?: { campo_faltante?: string } } })?.response?.data
      ?.campo_faltante;
  }, []);

  /* ── carrega as zonas da entidade (com a ficha de cada uma) ── */
  const [recarregarZonas, setRecarregarZonas] = useState(0);

  useEffect(() => {
    // A listagem de zonas é acessória: se falhar, a árvore do município
    // continua utilizável, então não derruba a tela.
    let cancelado = false;
    api
      .get<{ zonas: ZonaResumo[] }>("/geologia/zonas/")
      .then((res) => {
        if (!cancelado) setZonas(res.data.zonas ?? []);
      })
      .catch(() => {
        if (!cancelado) setZonas([]);
      });
    return () => {
      cancelado = true;
    };
  }, [recarregarZonas]);

  /* ── carrega a árvore de indicadores ── */
  const aplicavel = indicadorId != null && porMunicipio;
  const chave = `${indicadorId}|${anoBase}|${zonaSel ?? ""}|${tentativa}`;

  const carregado = resultado?.chave === chave;
  const falhou = falha?.chave === chave;

  // derivados — sem setState síncrono no efeito
  const GEO = carregado ? resultado.geo : VAZIO;
  const municipio = carregado ? resultado.municipio : null;
  const loading = aplicavel && !carregado && !falhou;
  const erro = falhou ? falha.msg : null;
  // Quando falta cadastro na entidade, a API diz QUAL campo — o aviso então
  // orienta a resolver, em vez de só informar que deu erro.
  const campoFaltante = falhou ? falha.campoFaltante : undefined;

  useEffect(() => {
    if (!aplicavel || carregado || falhou) return;

    let cancelado = false;
    const params = new URLSearchParams({
      indicador: String(indicadorId),
      ano: String(anoBase),
    });
    if (zonaSel != null) params.set("zona", String(zonaSel));

    api
      .get<ArvoreResposta>(`/geologia/arvore/?${params.toString()}`)
      .then((res) => {
        if (cancelado) return;
        const geo = res.data?.geo;
        if (geo && Object.keys(geo).length > 0) {
          setResultado({ chave, geo, municipio: res.data.municipio ?? null });
          setPath([res.data.root ?? "root"]);
        } else {
          setFalha({ chave, msg: "O AdaptaBrasil não retornou dados para este indicador." });
        }
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setFalha({
          chave,
          msg: msgErro(e, "Não foi possível carregar os dados deste indicador."),
          campoFaltante: campoErro(e),
        });
      });

    return () => {
      cancelado = true;
    };
  }, [aplicavel, carregado, falhou, chave, indicadorId, anoBase, zonaSel, msgErro, campoErro]);

  /* ── navegação no drill-down ── */
  const currentId = path[path.length - 1];
  const current = GEO[currentId] ?? GEO.root;

  const drillInto = (id: string) => {
    if (GEO[id] && !GEO[id].leaf) setPath([...path, id]);
  };
  const goBack = (idx: number) => setPath(path.slice(0, idx + 1));

  const breadcrumb = useMemo(
    () => path.map((id) => ({ id, label: GEO[id]?.label || id })),
    [path, GEO],
  );

  /* ── cadastro geológico ── */
  const abrirForm = (zonaId: number) => {
    const z = zonas.find((x) => x.id === zonaId);
    setEditZona(zonaId);
    setForm(z?.cadastro ? { ...z.cadastro } : { ...FICHA_VAZIA });
  };

  const salvarGeologia = async () => {
    if (editZona == null) return;
    if (!form.litologia.trim() || !form.tipo_solo.trim()) {
      showToast("Preencha ao menos litologia e tipo de solo.", "error");
      return;
    }
    setSalvando(true);
    try {
      await api.put(`/geologia/zona/${editZona}/cadastro/`, {
        litologia: form.litologia.trim(),
        tipo_solo: form.tipo_solo.trim(),
        declividade: form.declividade.trim(),
        suscetibilidade: form.suscetibilidade,
        observacoes: form.observacoes.trim(),
      });
      setRecarregarZonas((n) => n + 1);
      showToast("Geologia da zona salva.");
      setEditZona(null);
    } catch (e) {
      showToast(msgErro(e, "Não foi possível salvar a geologia da zona."), "error");
    } finally {
      setSalvando(false);
    }
  };

  const cadastradas = zonas.filter((z) => z.cadastro).length;

  /* ── ranking: zonas ordenadas pela suscetibilidade cadastrada ── */
  const PESO_SUSC: Record<string, number> = { alta: 0.85, media: 0.5, baixa: 0.2 };
  const ranking = useMemo(() => {
    return zonas
      .filter((z) => z.cadastro)
      .map((z) => ({
        id: z.id,
        nome: z.nome,
        val: PESO_SUSC[z.cadastro!.suscetibilidade] ?? 0.5,
        susc: z.cadastro!.suscetibilidade,
      }))
      .sort((a, b) => b.val - a.val);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonas]);

  const zonaSelData = zonas.find((z) => z.id === zonaSel) ?? null;

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
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Risco Climático
            </h1>
            {municipio && (
              <p className="text-sm text-on-surface-variant mt-2">
                Município: <span className="font-bold text-primary">{municipio}</span>
                {selectedTypeData.ano ? ` · ano-base ${selectedTypeData.ano}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-3 items-end">
            {/* Filtro por zona */}
            <div>
              <MetaTag className="block mb-1.5">RECORTE TERRITORIAL</MetaTag>
              <select
                value={zonaSel ?? ""}
                onChange={(e) => setZonaSel(e.target.value ? Number(e.target.value) : null)}
                className="bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none min-w-[220px]"
              >
                <option value="">Entidade inteira (município)</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nome}
                  </option>
                ))}
              </select>
            </div>
            <Btn variant="primary" icon="tune">
              Opções
            </Btn>
          </div>
        </div>

        {zonaSelData && (
          <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-secondary/8">
            <Icon name="info" className="text-secondary text-[18px] mt-0.5" />
            <p className="text-[12px] text-secondary leading-relaxed">
              Exibindo o recorte da zona <strong>{zonaSelData.nome}</strong>. Os índices do
              AdaptaBrasil são medidos <strong>por município</strong>, então os valores são os
              mesmos da entidade — o que muda é a geometria destacada no mapa e a ficha
              geológica cadastrada para esta zona.
            </p>
          </div>
        )}
      </header>

      {/* Seletor de tipo de impacto */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MetaTag className="text-secondary">TIPOS DE IMPACTO</MetaTag>
          <span className="text-[10px] text-on-surface-variant">
            Selecione para explorar indicadores
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {TYPES.map((t) => {
            const active = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedType(t.id);
                  setPath(["root"]);
                }}
                className={`p-5 rounded-xl text-left transition-all relative overflow-hidden ${
                  active ? "shadow-ambient -translate-y-0.5" : "shadow-ambient-sm hover:-translate-y-0.5"
                }`}
                style={{ background: active ? t.color : "#fff", color: active ? "#fff" : undefined }}
              >
                {t.focus && !active && (
                  <span
                    className="absolute top-2 right-2 text-[8px] font-mono font-black uppercase tracking-mono text-white px-1.5 py-0.5 rounded"
                    style={{ background: t.color }}
                  >
                    FOCO
                  </span>
                )}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: active ? "rgba(255,255,255,0.18)" : t.color + "1A" }}
                >
                  <Icon
                    name={t.icon}
                    filled
                    className="text-[22px]"
                    style={{ color: active ? "#fff" : t.color }}
                  />
                </div>
                <p
                  className={`text-[12px] font-headline font-black leading-tight tracking-tight ${
                    active ? "text-white" : "text-primary"
                  }`}
                >
                  {t.label}
                </p>
                <p className={`text-[10px] mt-1 ${active ? "text-white/70" : "text-on-surface-variant"}`}>
                  {t.subcategories.length} indicadores
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Setor sem recorte municipal */}
      {!porMunicipio ? (
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: selectedTypeData.color + "1A" }}
          >
            <Icon
              name={selectedTypeData.icon}
              filled
              className="text-[32px]"
              style={{ color: selectedTypeData.color }}
            />
          </div>
          <h3 className="font-headline font-black text-2xl text-primary tracking-tight">
            {selectedTypeData.label}
          </h3>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
            Este setor do AdaptaBrasil é medido por {selectedTypeData.resolucao}, não por
            município — por isso não se aplica a um painel municipal.
          </p>
        </div>
      ) : loading ? (
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <Icon name="progress_activity" className="text-secondary text-[32px] animate-spin" />
          <p className="text-sm text-on-surface-variant mt-3">
            Consultando o AdaptaBrasil…
          </p>
        </div>
      ) : erro ? (
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-error/10">
            <Icon name="cloud_off" filled className="text-[32px] text-error" />
          </div>
          <h3 className="font-headline font-black text-xl text-primary tracking-tight">
            Dados indisponíveis
          </h3>
          <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">{erro}</p>
          {campoFaltante === "geocod_ibge" && (
            <p className="text-[12px] text-on-surface-variant mt-3 max-w-md mx-auto">
              Cadastre o <strong>código IBGE</strong> do município nos dados da entidade. O
              identificador do AdaptaBrasil passa a ser descoberto automaticamente na
              primeira consulta.
            </p>
          )}
          <div className="mt-5">
            <Btn variant="secondary" icon="refresh" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Btn>
          </div>
        </div>
      ) : !current ? (
        <div className="card-tonal p-12 shadow-ambient-sm text-center">
          <p className="text-sm text-on-surface-variant">
            Nenhum indicador retornado para este setor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Coluna esquerda — drill-down */}
          <div className="col-span-12 lg:col-span-7 space-y-5">
            <div className="card-tonal p-5 shadow-ambient-sm">
              <MetaTag className="block mb-3">NAVEGAÇÃO</MetaTag>
              <div className="space-y-2">
                {breadcrumb.map((b, i) => {
                  const ultimo = i === breadcrumb.length - 1;
                  return (
                    <button
                      key={b.id}
                      onClick={() => goBack(i)}
                      disabled={ultimo}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md w-full text-left ${
                        ultimo
                          ? "bg-surface-container-low cursor-default"
                          : "bg-secondary/10 hover:bg-secondary/15"
                      }`}
                    >
                      <Icon
                        name={ultimo ? "radio_button_checked" : "chevron_left"}
                        className={`text-[16px] ${ultimo ? "text-on-surface-variant" : "text-secondary"}`}
                      />
                      <span
                        className={`text-[12px] font-bold ${ultimo ? "text-primary" : "text-secondary"}`}
                      >
                        {b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Indicador atual */}
            <div className="card-tonal p-7 shadow-ambient-sm">
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: selectedTypeData.color + "1A" }}
                >
                  <Icon
                    name={selectedTypeData.icon}
                    filled
                    className="text-[24px]"
                    style={{ color: selectedTypeData.color }}
                  />
                </div>
                <div className="flex-1">
                  <MetaTag className="block mb-1">
                    {current.parent ? (GEO[current.parent]?.label ?? current.parent).toUpperCase() : selectedTypeData.label.toUpperCase()}
                  </MetaTag>
                  <h2 className="font-headline font-black text-2xl text-primary tracking-tight leading-tight">
                    {current.label}
                  </h2>
                </div>
              </div>

              <AdaptaGauge value={current.value ?? 0} size="lg" />

              {current.description && (
                <p className="text-[13px] text-on-surface-variant leading-relaxed mt-5">
                  {current.description}
                </p>
              )}
            </div>

            {/* Composição */}
            {current.composition && current.composition.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">
                    Composição
                  </h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2">
                  {current.composition.map((c) => {
                    const hasDrill = GEO[c.id] && !GEO[c.id].leaf;
                    return (
                      <button
                        key={c.id}
                        onClick={() => drillInto(c.id)}
                        disabled={!hasDrill}
                        className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-all ${
                          hasDrill
                            ? "bg-surface-container-low hover:bg-secondary/8 cursor-pointer"
                            : "bg-surface-container-low opacity-75 cursor-default"
                        }`}
                      >
                        <Icon name="arrow_forward" className="text-secondary text-[14px]" />
                        <span className="text-[13px] font-bold text-secondary flex-1">{c.label}</span>
                        <MiniGauge value={c.value} />
                        <ValorExato value={c.value} className="w-11 text-right" />
                        {hasDrill && (
                          <Icon name="chevron_right" className="text-on-surface-variant text-[18px]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fatores */}
            {current.factors && current.factors.length > 0 && (
              <div className="card-tonal p-7 shadow-ambient-sm">
                <div className="flex items-center gap-2 mb-5">
                  <h3 className="font-headline font-black text-lg text-primary tracking-tight">
                    Fatores Influenciadores
                  </h3>
                  <Icon name="help" className="text-on-surface-variant text-[16px]" />
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {current.factors.map((f, i) => (
                    <div
                      key={f.id ?? i}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-surface-container-low"
                    >
                      <Icon name="expand_more" className="text-secondary text-[16px]" />
                      <span className="text-[12px] text-secondary flex-1 leading-snug">{f.label}</span>
                      {f.value != null ? (
                        <MiniGauge value={f.value} />
                      ) : (
                        <div className="flex-1 max-w-[180px]" />
                      )}
                      <ValorExato value={f.value} className="w-11 text-right" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita — mapa, legenda, ranking */}
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

            <div className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline="RANKING · SUSCETIBILIDADE CADASTRADA"
                title="Zonas por Suscetibilidade"
              />
              {ranking.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant">
                  Nenhuma zona com geologia cadastrada ainda. Preencha as fichas abaixo para
                  montar o ranking.
                </p>
              ) : (
                <div className="space-y-2">
                  {ranking.map((r, i) => {
                    const lvl = ADAPTABRASIL.LEVELS.find(
                      (l) => r.val >= l.range[0] && r.val <= l.range[1],
                    );
                    return (
                      <button
                        key={r.id}
                        onClick={() => setZonaSel(r.id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-md bg-surface-container-low hover:bg-secondary/8 text-left"
                      >
                        <span className="text-[10px] font-mono font-black text-slate-400 w-5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[12px] font-bold text-primary flex-1 truncate">
                          {r.nome}
                        </span>
                        <MiniGauge value={r.val} />
                        <span
                          className="text-[11px] font-headline font-black w-16 text-right uppercase"
                          style={{ color: lvl?.color ?? "#5b6370" }}
                        >
                          {r.susc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Geologia por Zona (cadastro em campo) ── */}
      <section className="card-tonal p-7 shadow-ambient-sm">
        <SectionHeader
          overline="CADASTRO TERRITORIAL"
          title="Geologia por Zona"
          action={
            <Chip tone="primarySoft" icon="database">
              {cadastradas}/{zonas.length} ZONAS CADASTRADAS
            </Chip>
          }
        />
        <p className="text-[12px] text-on-surface-variant -mt-3 mb-6 max-w-3xl">
          Registre a caracterização geológica de cada zona. Diferente dos índices do
          AdaptaBrasil (que são municipais), estes dados são levantados em campo pela equipe
          técnica e alimentam a análise de suscetibilidade usada pela IA.
        </p>

        {zonas.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant">
            Nenhuma zona cadastrada para esta entidade.
          </p>
        ) : (
          <div className="space-y-3">
            {zonas.map((z) => {
              const g = z.cadastro;
              const editando = editZona === z.id;
              return (
                <div key={z.id} className="card-recessed p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-headline font-bold text-[16px] text-primary tracking-tight">
                          {z.nome}
                        </h3>
                        {g ? (
                          <Chip
                            tone={
                              g.suscetibilidade === "alta"
                                ? "error"
                                : g.suscetibilidade === "media"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            SUSCETIBILIDADE {g.suscetibilidade.toUpperCase()}
                          </Chip>
                        ) : (
                          <Chip tone="neutral">SEM CADASTRO</Chip>
                        )}
                      </div>
                      {g && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 mt-3">
                          <div>
                            <MetaTag className="block">LITOLOGIA</MetaTag>
                            <p className="text-[12px] font-bold text-primary">{g.litologia}</p>
                          </div>
                          <div>
                            <MetaTag className="block">TIPO DE SOLO</MetaTag>
                            <p className="text-[12px] font-bold text-primary">{g.tipo_solo}</p>
                          </div>
                          <div>
                            <MetaTag className="block">DECLIVIDADE</MetaTag>
                            <p className="text-[12px] font-bold text-primary">
                              {g.declividade || "—"}
                            </p>
                          </div>
                          {g.observacoes && (
                            <p className="md:col-span-3 text-[11px] text-on-surface-variant leading-relaxed mt-1">
                              {g.observacoes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Btn
                      variant={editando ? "ghost" : "secondary"}
                      icon={editando ? "close" : g ? "edit" : "add"}
                      onClick={() => (editando ? setEditZona(null) : abrirForm(z.id))}
                    >
                      {editando ? "Cancelar" : g ? "Editar" : "Inserir geologia"}
                    </Btn>
                  </div>

                  {editando && (
                    <div className="mt-5 pt-5 border-t border-outline-variant/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <MetaTag className="block mb-1.5">LITOLOGIA</MetaTag>
                        <input
                          value={form.litologia}
                          onChange={(e) => setForm((f) => ({ ...f, litologia: e.target.value }))}
                          placeholder="Ex.: Grupo Barreiras — arenitos argilosos"
                          className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">TIPO DE SOLO</MetaTag>
                        <input
                          value={form.tipo_solo}
                          onChange={(e) => setForm((f) => ({ ...f, tipo_solo: e.target.value }))}
                          placeholder="Ex.: Latossolo Amarelo distrófico"
                          className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">DECLIVIDADE</MetaTag>
                        <input
                          value={form.declividade}
                          onChange={(e) => setForm((f) => ({ ...f, declividade: e.target.value }))}
                          placeholder="Ex.: 30–50%"
                          className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                        />
                      </div>
                      <div>
                        <MetaTag className="block mb-1.5">SUSCETIBILIDADE</MetaTag>
                        <select
                          value={form.suscetibilidade}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              suscetibilidade: e.target.value as CadastroZona["suscetibilidade"],
                            }))
                          }
                          className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Média</option>
                          <option value="baixa">Baixa</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <MetaTag className="block mb-1.5">OBSERVAÇÕES</MetaTag>
                        <textarea
                          value={form.observacoes}
                          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                          rows={2}
                          placeholder="Notas de campo, estruturas observadas, obras de contenção…"
                          className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Btn
                          variant="success"
                          icon="check"
                          onClick={salvarGeologia}
                          disabled={salvando}
                        >
                          {salvando ? "Salvando…" : "Salvar geologia"}
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}