"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import {
  MOCK_DANOS_CATALOGO,
  MOCK_DANOS_REGISTROS,
  MOCK_OCORRENCIAS,
  MOCK_EVENTOS,
  formatBRL,
  type DanoCatalogoItem,
} from "@/app/data/mock";

interface DanoPorOcorrencia {
  ocorrencia_id: number;
  protocolo: string;
  titulo: string;
  status: string;
  categoria: string;
  created_at: string;
  custo_total: string | number;
  total_itens: number;
  danos: Array<{
    id: number;
    item_nome: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    valor_unitario_aplicado: string | number;
    valor_total: string | number;
  }>;
}

interface RelatorioOcorrenciasResponse {
  ocorrencias: DanoPorOcorrencia[];
  totais: {
    custo_total: string | number;
    total_itens: number;
    ocorrencias_com_dano: number;
  };
}

const KPI_VALUE_CLASS = "whitespace-nowrap text-[clamp(1.75rem,2.35vw,2.5rem)]";

export default function DamagesPage() {
  const { showToast } = useGardian();

  const [tab, setTab] = useState<"ocorrencias" | "eventos" | "catalogo">("ocorrencias");
  const [catalogo, setCatalogo] = useState<DanoCatalogoItem[]>(MOCK_DANOS_CATALOGO);
  const [detalheOc, setDetalheOc] = useState<number | null>(null);
  const [relatorioOcorrencias, setRelatorioOcorrencias] = useState<DanoPorOcorrencia[]>([]);
  const [totaisOcorrencias, setTotaisOcorrencias] = useState<RelatorioOcorrenciasResponse["totais"]>({
    custo_total: 0,
    total_itens: 0,
    ocorrencias_com_dano: 0,
  });
  const [carregandoOcorrencias, setCarregandoOcorrencias] = useState(true);

  useEffect(() => {
    let cancelado = false;
    api.get<RelatorioOcorrenciasResponse>("/danos/registros/por-ocorrencia/")
      .then((response) => {
        if (cancelado) return;
        setRelatorioOcorrencias(response.data.ocorrencias ?? []);
        setTotaisOcorrencias(response.data.totais);
      })
      .catch(() => {
        if (!cancelado) showToast("Não foi possível carregar o relatório de danos.", "error");
      })
      .finally(() => {
        if (!cancelado) setCarregandoOcorrencias(false);
      });
    return () => { cancelado = true; };
  }, [showToast]);

  // form da subtela de catálogo
  const [showForm, setShowForm] = useState(false);
  const [fNome, setFNome] = useState("");
  const [fCategoria, setFCategoria] = useState("Assistência humanitária");
  const [fUnidade, setFUnidade] = useState("un");
  const [fPreco, setFPreco] = useState("");

  const catalogoById = useMemo(
    () => new Map(catalogo.map((c) => [c.id, c])),
    [catalogo],
  );

  const custoRegistro = (itens: { catalogoId: number; quantidade: number }[]) =>
    itens.reduce((acc, it) => acc + (catalogoById.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade, 0);

  const custoTotal = Number(totaisOcorrencias.custo_total || 0);
  const totalItens = totaisOcorrencias.total_itens;

  // agregação por evento
  const porEvento = useMemo(() => {
    return MOCK_EVENTOS.map((ev) => {
      const ocs = MOCK_OCORRENCIAS.filter((o) => o.evento === ev.id).map((o) => o.id);
      const regs = MOCK_DANOS_REGISTROS.filter((r) => ocs.includes(r.ocorrenciaId));
      const itensAgg = new Map<number, number>();
      for (const r of regs) for (const it of r.itens) itensAgg.set(it.catalogoId, (itensAgg.get(it.catalogoId) ?? 0) + it.quantidade);
      const custo = regs.reduce((acc, r) => acc + custoRegistro(r.itens), 0);
      return { evento: ev, regs, itensAgg, custo };
    }).filter((e) => e.regs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo]);

  const adicionarItem = () => {
    const preco = parseFloat(fPreco.replace(",", "."));
    if (!fNome.trim() || isNaN(preco)) {
      showToast("Preencha nome e preço válidos.", "error");
      return;
    }
    setCatalogo((prev) => [
      ...prev,
      { id: Math.max(...prev.map((c) => c.id)) + 1, nome: fNome.trim(), categoria: fCategoria, unidade: fUnidade, precoUnitario: preco },
    ]);
    setFNome(""); setFPreco(""); setShowForm(false);
    showToast("Item adicionado à base de danos.");
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GERENCIAMENTO DE DANOS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{catalogo.length} ITENS NA BASE</MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Danos e Custos
          </h1>
          <Btn
            variant="primary"
            icon="summarize"
            onClick={() => showToast("Relatório de danos gerado (PDF simulado).")}
          >
            Emitir Relatório
          </Btn>
        </div>
      </header>

      {/* Indicadores gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI
          label="Valor Bruto Total"
          value={formatBRL(custoTotal)}
          valueClassName={KPI_VALUE_CLASS}
          icon="payments"
          tone="error"
          sub="Itens aplicados em ocorrências"
        />
        <KPI label="Itens Aplicados" value={totalItens} valueClassName={KPI_VALUE_CLASS} icon="inventory_2" tone="warning" sub={`Em ${totaisOcorrencias.ocorrencias_com_dano} ocorrências`} />
        <KPI label="Ocorrências c/ Danos" value={totaisOcorrencias.ocorrencias_com_dano} valueClassName={KPI_VALUE_CLASS} icon="emergency" tone="secondary" sub="Com catalogação concluída" />
        <KPI label="Base de Itens" value={catalogo.length} valueClassName={KPI_VALUE_CLASS} icon="database" tone="secondary" sub="Preços de referência" />
      </div>

      {/* Abas de visualização */}
      <div className="flex flex-wrap gap-2">
        <Tab active={tab === "ocorrencias"} onClick={() => setTab("ocorrencias")} icon="emergency">
          Por Ocorrência
        </Tab>
        <Tab active={tab === "eventos"} onClick={() => setTab("eventos")} icon="cyclone">
          Por Evento
        </Tab>
        <Tab active={tab === "catalogo"} onClick={() => setTab("catalogo")} icon="database">
          Base de Danos
        </Tab>
      </div>

      {/* ── Por ocorrência ── */}
      {tab === "ocorrencias" && (
        <div className="space-y-3">
          {carregandoOcorrencias && <p className="text-sm text-on-surface-variant">Carregando danos…</p>}
          {!carregandoOcorrencias && relatorioOcorrencias.length === 0 && (
            <p className="text-sm text-on-surface-variant">Nenhuma ocorrência com danos catalogados.</p>
          )}
          {relatorioOcorrencias.map((r) => {
            const custo = Number(r.custo_total || 0);
            const open = detalheOc === r.ocorrencia_id;
            return (
              <div key={r.ocorrencia_id} className="card-tonal shadow-ambient-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDetalheOc(open ? null : r.ocorrencia_id)}
                  className="w-full flex items-center gap-4 p-6 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center shrink-0">
                    <Icon name="emergency" filled className="text-error text-[20px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-primary truncate">
                      {r.protocolo} · {r.titulo}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {r.categoria} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-headline font-black text-xl text-primary tracking-tighter">{formatBRL(custo)}</p>
                    <MetaTag>{r.total_itens} ITENS</MetaTag>
                  </div>
                  <Icon name={open ? "expand_less" : "expand_more"} className="text-on-surface-variant text-[20px]" />
                </button>

                {open && (
                  <div className="px-6 pb-6 border-t border-outline-variant/20 pt-4">
                    <MetaTag className="block mb-3">ITENS CATALOGADOS NA OCORRÊNCIA</MetaTag>
                    <div className="space-y-2">
                      {r.danos.map((it) => {
                        return (
                          <div key={it.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                            <Icon name="inventory_2" className="text-secondary text-[16px]" />
                            <span className="font-bold text-primary flex-1">{it.item_nome}</span>
                            <span className="text-on-surface-variant">{it.quantidade} {it.unidade} × {formatBRL(Number(it.valor_unitario_aplicado))}</span>
                            <span className="font-black text-primary w-24 text-right">{formatBRL(Number(it.valor_total))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Por evento ── */}
      {tab === "eventos" && (
        <div className="space-y-5">
          {porEvento.length === 0 && (
            <p className="text-[12px] text-on-surface-variant italic">Nenhum evento com danos catalogados.</p>
          )}
          {porEvento.map(({ evento, regs, itensAgg, custo }) => (
            <div key={evento.id} className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline={`EVENTO #${evento.id} · ${regs.length} OCORRÊNCIAS COM DANOS`}
                title={evento.nome}
                action={
                  <div className="text-right">
                    <p className="font-headline font-black text-2xl text-primary tracking-tighter">{formatBRL(custo)}</p>
                    <MetaTag>VALOR BRUTO FINAL</MetaTag>
                  </div>
                }
              />
              <MetaTag className="block mb-3">LISTAGEM DE ITENS GASTADOS</MetaTag>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[...itensAgg.entries()].map(([catId, qtd]) => {
                  const c = catalogoById.get(catId);
                  if (!c) return null;
                  return (
                    <div key={catId} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                      <Icon name="inventory_2" className="text-secondary text-[16px]" />
                      <span className="font-bold text-primary flex-1 truncate">{c.nome}</span>
                      <Chip tone="neutral">{qtd} {c.unidade}</Chip>
                      <span className="font-black text-primary w-24 text-right shrink-0">{formatBRL(qtd * c.precoUnitario)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Base de danos (subtela) ── */}
      {tab === "catalogo" && (
        <div className="card-tonal p-7 shadow-ambient-sm">
          <SectionHeader
            overline="BASE DE DADOS DE DANOS"
            title="Itens e Preços de Referência"
            action={
              <Btn variant={showForm ? "ghost" : "primary"} icon={showForm ? "close" : "add"} onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Cancelar" : "Novo Item"}
              </Btn>
            }
          />

          {showForm && (
            <div className="card-recessed p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <MetaTag className="block mb-1.5">NOME DO ITEM</MetaTag>
                <input
                  value={fNome}
                  onChange={(e) => setFNome(e.target.value)}
                  placeholder="Ex.: Telha metálica 3m"
                  className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                />
              </div>
              <div>
                <MetaTag className="block mb-1.5">CATEGORIA</MetaTag>
                <select
                  value={fCategoria}
                  onChange={(e) => setFCategoria(e.target.value)}
                  className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                >
                  <option>Assistência humanitária</option>
                  <option>Material de contenção</option>
                  <option>Reconstrução</option>
                  <option>Maquinário</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MetaTag className="block mb-1.5">UNIDADE</MetaTag>
                  <input
                    value={fUnidade}
                    onChange={(e) => setFUnidade(e.target.value)}
                    className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                </div>
                <div>
                  <MetaTag className="block mb-1.5">PREÇO (R$)</MetaTag>
                  <input
                    value={fPreco}
                    onChange={(e) => setFPreco(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-white rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                </div>
              </div>
              <div className="md:col-span-4">
                <Btn variant="success" icon="check" onClick={adicionarItem}>Salvar Item</Btn>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-3 pr-4"><MetaTag>ITEM</MetaTag></th>
                  <th className="py-3 pr-4"><MetaTag>CATEGORIA</MetaTag></th>
                  <th className="py-3 pr-4"><MetaTag>UNIDADE</MetaTag></th>
                  <th className="py-3 text-right"><MetaTag>PREÇO UNITÁRIO</MetaTag></th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((c) => (
                  <tr key={c.id} className="border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors">
                    <td className="py-3.5 pr-4 text-[13px] font-bold text-primary">{c.nome}</td>
                    <td className="py-3.5 pr-4"><Chip tone="neutral">{c.categoria}</Chip></td>
                    <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{c.unidade}</td>
                    <td className="py-3.5 text-[13px] font-black text-primary text-right">{formatBRL(c.precoUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
