"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
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

function formatarCategoria(categoria: string): string {
  return categoria
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((palavra) =>
      palavra[0].toLocaleUpperCase("pt-BR") + palavra.slice(1).toLocaleLowerCase("pt-BR"),
    )
    .join(" ");
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarDataRelatorio(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "Data não informada" : data.toLocaleDateString("pt-BR");
}

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

  const emitirRelatorio = () => {
    if (carregandoOcorrencias) {
      showToast("Aguarde o carregamento dos dados de danos.", "error");
      return;
    }
    if (relatorioOcorrencias.length === 0) {
      showToast("Não há danos catalogados para emitir o relatório.", "error");
      return;
    }

    const janela = window.open("", "_blank");
    if (!janela) {
      showToast("Permita pop-ups para abrir o relatório de danos.", "error");
      return;
    }
    janela.opener = null;

    const agora = new Date();
    const codigo = `DAN-${String(agora.getDate()).padStart(2, "0")}${String(agora.getMonth() + 1).padStart(2, "0")}${agora.getFullYear()}-${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
    const logoUrl = new URL("/logo/logo_branco_sem_fundo.svg", window.location.origin).href;
    const maiorOcorrencia = [...relatorioOcorrencias].sort(
      (a, b) => Number(b.custo_total || 0) - Number(a.custo_total || 0),
    )[0];
    const categorias = new Map<string, { quantidade: number; valor: number }>();
    for (const ocorrencia of relatorioOcorrencias) {
      for (const dano of ocorrencia.danos) {
        const categoria = formatarCategoria(dano.categoria || "Não classificada");
        const atual = categorias.get(categoria) ?? { quantidade: 0, valor: 0 };
        atual.quantidade += Number(dano.quantidade || 0);
        atual.valor += Number(dano.valor_total || 0);
        categorias.set(categoria, atual);
      }
    }
    const categoriasOrdenadas = [...categorias.entries()].sort((a, b) => b[1].valor - a[1].valor);
    const maiorCategoria = categoriasOrdenadas[0];
    const percentualMaiorCategoria = custoTotal > 0 && maiorCategoria
      ? Math.round((maiorCategoria[1].valor / custoTotal) * 100)
      : 0;

    const resumoCategorias = categoriasOrdenadas.map(([nome, dados]) => {
      const percentual = custoTotal > 0 ? Math.max(2, (dados.valor / custoTotal) * 100) : 0;
      return `
        <div class="category-row">
          <div class="category-head"><strong>${escaparHtml(nome)}</strong><span>${escaparHtml(formatBRL(dados.valor))}</span></div>
          <div class="bar"><span style="width:${percentual.toFixed(1)}%"></span></div>
          <small>${dados.quantidade.toLocaleString("pt-BR")} itens aplicados</small>
        </div>`;
    }).join("");

    const blocosOcorrencias = relatorioOcorrencias.map((ocorrencia, indice) => {
      const itens = ocorrencia.danos.map((dano) => `
        <tr>
          <td><strong>${escaparHtml(dano.item_nome)}</strong><br><small>${escaparHtml(formatarCategoria(dano.categoria))}</small></td>
          <td class="center">${Number(dano.quantidade).toLocaleString("pt-BR")} ${escaparHtml(dano.unidade)}</td>
          <td class="money">${escaparHtml(formatBRL(Number(dano.valor_unitario_aplicado)))}</td>
          <td class="money strong">${escaparHtml(formatBRL(Number(dano.valor_total)))}</td>
        </tr>`).join("");
      return `
        <section class="occurrence">
          <div class="occurrence-head">
            <div><span class="sequence">${String(indice + 1).padStart(2, "0")}</span></div>
            <div class="occurrence-title">
              <small>OCORRÊNCIA ${escaparHtml(ocorrencia.protocolo)}</small>
              <h3>${escaparHtml(ocorrencia.titulo)}</h3>
              <p>${escaparHtml(formatarCategoria(ocorrencia.categoria))} · Registrada em ${escaparHtml(formatarDataRelatorio(ocorrencia.created_at))} · ${escaparHtml(getOccurrenceStatusMeta(ocorrencia.status).label)}</p>
            </div>
            <div class="occurrence-total"><small>SUBTOTAL</small><strong>${escaparHtml(formatBRL(Number(ocorrencia.custo_total || 0)))}</strong><span>${ocorrencia.total_itens} itens</span></div>
          </div>
          <table>
            <thead><tr><th>Item catalogado</th><th class="center">Quantidade</th><th class="money">Valor unitário</th><th class="money">Valor total</th></tr></thead>
            <tbody>${itens}</tbody>
          </table>
        </section>`;
    }).join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Danos - ${escaparHtml(codigo)}</title>
<style>
  :root{--navy:#0d1b2e;--navy2:#17324d;--teal:#007d73;--mint:#dff4ef;--red:#ba1a1a;--ink:#17212b;--muted:#607080;--line:#dce4e8;--paper:#fff;--wash:#f3f7f8}
  *{box-sizing:border-box} body{margin:0;background:#dfe7ea;color:var(--ink);font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:12px;padding:12px;background:rgba(13,27,46,.94)}
  .toolbar button{border:0;border-radius:8px;padding:11px 18px;font-weight:700;cursor:pointer}.print{background:#17a99a;color:#fff}.close{background:#fff;color:var(--navy)}
  .report{width:210mm;min-height:297mm;margin:24px auto;background:var(--paper);box-shadow:0 18px 60px rgba(13,27,46,.18)}
  .hero{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:18mm 16mm 14mm}
  .hero:after{content:"";position:absolute;width:100mm;height:100mm;border:22mm solid rgba(23,169,154,.12);border-radius:50%;right:-42mm;top:-53mm}
  .brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:20mm}.brand-logo{display:block;width:42mm;height:auto;max-height:18mm;object-fit:contain;object-position:left center}.doc-code{font-size:9px;color:#b8cad4;text-align:right;line-height:1.6}
  .eyebrow{color:#64d8ca;font-size:9px;font-weight:800;letter-spacing:.2em}.hero h1{font-size:34px;line-height:1.05;margin:8px 0 10px;letter-spacing:-1.2px}.hero p{max-width:135mm;margin:0;color:#c7d6df;font-size:12px;line-height:1.6}
  main{padding:12mm 16mm 16mm}.section-label{display:flex;align-items:center;gap:8px;color:var(--teal);font-size:9px;font-weight:800;letter-spacing:.16em;margin-bottom:6px}.section-label:before{content:"";width:18px;height:3px;background:var(--teal);border-radius:3px}h2{font-size:21px;margin:0 0 14px;color:var(--navy);letter-spacing:-.4px}
  .metrics{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:9px;margin-top:-22mm;position:relative;z-index:2;margin-bottom:13mm}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(13,27,46,.08)}.metric.primary{background:var(--teal);border-color:var(--teal);color:#fff}.metric small{display:block;font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--muted);margin-bottom:7px}.metric.primary small{color:#c9fff6}.metric strong{display:block;font-size:20px;letter-spacing:-.5px}.metric span{display:block;font-size:9px;color:var(--muted);margin-top:5px}.metric.primary span{color:#d8fff9}
  .executive{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-bottom:13mm}.insight{background:var(--wash);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:15px}.insight p{font-size:11px;line-height:1.65;margin:0;color:#42515e}.insight strong{color:var(--navy)}.categories{border:1px solid var(--line);border-radius:10px;padding:13px}.category-row+.category-row{margin-top:10px}.category-head{display:flex;justify-content:space-between;font-size:9px}.category-row small{font-size:8px;color:var(--muted)}.bar{height:5px;background:#e8eff1;border-radius:5px;margin:5px 0 4px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,var(--teal),#40bcae);border-radius:5px}
  .occurrence{border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:0 0 10mm;break-inside:avoid}.occurrence-head{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px;background:var(--wash)}.sequence{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--navy);color:#fff;font-size:10px;font-weight:800}.occurrence-title small,.occurrence-total small{font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--teal)}.occurrence-title h3{font-size:13px;margin:3px 0;color:var(--navy)}.occurrence-title p{font-size:9px;color:var(--muted);margin:0}.occurrence-total{text-align:right}.occurrence-total strong{display:block;color:var(--red);font-size:14px;margin:3px 0}.occurrence-total span{font-size:8px;color:var(--muted)}
  table{width:100%;border-collapse:collapse;font-size:9px}th{padding:8px 10px;background:#fff;color:var(--muted);font-size:7px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--line)}td{padding:9px 10px;border-bottom:1px solid #edf1f3}tbody tr:last-child td{border-bottom:0}td small{color:var(--muted)}.center{text-align:center}.money{text-align:right;white-space:nowrap}.strong{font-weight:800;color:var(--navy)}
  .method{margin-top:12mm;padding-top:6mm;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr auto;gap:20px;font-size:8px;color:var(--muted);line-height:1.6}.method strong{color:var(--navy)}
  footer{display:flex;justify-content:space-between;padding:5mm 16mm;border-top:1px solid var(--line);font-size:8px;color:var(--muted)}
  @page{size:A4;margin:8mm}@media print{body{background:#fff}.no-print{display:none!important}.report{width:auto;min-height:auto;margin:0;box-shadow:none}.hero{padding-top:12mm}.metrics{margin-top:-18mm}.occurrence{break-inside:avoid;page-break-inside:avoid}footer{position:running(footer)}}
</style></head><body>
<div class="toolbar no-print"><button class="print" onclick="window.print()">Salvar ou imprimir PDF</button><button class="close" onclick="window.close()">Fechar</button></div>
<article class="report">
  <header class="hero"><div class="brand"><img class="brand-logo" src="${escaparHtml(logoUrl)}" alt="Gardian"><div class="doc-code">${escaparHtml(codigo)}<br>Emitido em ${escaparHtml(agora.toLocaleString("pt-BR"))}</div></div><span class="eyebrow">DOCUMENTO OPERACIONAL</span><h1>Relatório consolidado<br>de danos e custos</h1><p>Panorama financeiro e quantitativo dos danos catalogados nas ocorrências registradas no sistema.</p></header>
  <main>
    <div class="metrics"><div class="metric primary"><small>VALOR BRUTO CONSOLIDADO</small><strong>${escaparHtml(formatBRL(custoTotal))}</strong><span>Estimativa baseada nos valores aplicados</span></div><div class="metric"><small>ITENS APLICADOS</small><strong>${totalItens.toLocaleString("pt-BR")}</strong><span>Em todas as categorias</span></div><div class="metric"><small>OCORRÊNCIAS</small><strong>${totaisOcorrencias.ocorrencias_com_dano.toLocaleString("pt-BR")}</strong><span>Com danos catalogados</span></div></div>
    <div class="section-label">SÍNTESE</div><h2>Resumo executivo</h2>
    <div class="executive"><div class="insight"><p>O levantamento consolida <strong>${totalItens.toLocaleString("pt-BR")} itens</strong> em <strong>${totaisOcorrencias.ocorrencias_com_dano.toLocaleString("pt-BR")} ocorrências</strong>. A ocorrência de maior impacto financeiro é <strong>${escaparHtml(maiorOcorrencia.protocolo)} - ${escaparHtml(maiorOcorrencia.titulo)}</strong>, estimada em <strong>${escaparHtml(formatBRL(Number(maiorOcorrencia.custo_total || 0)))}</strong>. ${maiorCategoria ? `A categoria <strong>${escaparHtml(maiorCategoria[0])}</strong> concentra ${percentualMaiorCategoria}% do valor apurado.` : ""}</p></div><div class="categories">${resumoCategorias}</div></div>
    <div class="section-label">DETALHAMENTO</div><h2>Danos por ocorrência</h2>${blocosOcorrencias}
    <div class="method"><div><strong>Critério de apuração</strong><br>Valores calculados pela quantidade registrada multiplicada pelo valor unitário aplicado no momento da catalogação. Este documento representa uma estimativa operacional e pode sofrer revisões.</div><div><strong>Base consultada</strong><br>Gardian · Módulo Danos e Custos<br>${escaparHtml(agora.toLocaleDateString("pt-BR"))}</div></div>
  </main><footer><span>GARDIAN · Defesa Civil</span><span>${escaparHtml(codigo)} · Documento gerado eletronicamente</span></footer>
</article></body></html>`;

    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    showToast("Relatório de danos preparado para impressão ou PDF.");
  };

  if (carregandoOcorrencias) {
    return <DataLoading description="Preparando os dados de danos e custos..." />;
  }

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
            onClick={emitirRelatorio}
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
                      {formatarCategoria(r.categoria)} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
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
