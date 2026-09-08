// DefCivil_FrontEnd/app/(gardian)/damages/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { DataLoading } from "@/app/components/DataLoading";
import { getOccurrenceStatusMeta } from "@/app/lib/occurrenceStatus";
import { formatBRL } from "@/app/data/mock";
import { api } from "@/app/services/Api";
import {
  CreateDamageItemModal,
  type ItemCatalogo,
} from "@/app/components/CreateDamageItemModal";

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
    item: number;
    item_nome: string;
    categoria: string;
    unidade: string;
    quantidade: number;
    valor_unitario_aplicado: string | number;
    valor_total: string | number;
  }>;
}

interface EventoResumo {
  id: number;
  nome: string;
}

interface EventoListResponse {
  eventos: EventoResumo[];
}

interface DanosPorEvento {
  evento: EventoResumo;
  ocorrenciasComDano: number;
  custo: number;
  ocorrencias: DanoPorOcorrencia[];
}

interface RelatorioOcorrenciasResponse {
  ocorrencias: DanoPorOcorrencia[];
  totais: {
    custo_total: string | number;
    total_itens: number;
    ocorrencias_com_dano: number;
  };
}

interface ResumoDanosResponse {
  custo_total: string | number;
  total_itens: number;
  ocorrencias_com_dano: number;
  itens_catalogo: number;
  total_ocorrencias: number;
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
  const [detalheOc, setDetalheOc] = useState<number | null>(null);
  const [relatorioOcorrencias, setRelatorioOcorrencias] = useState<DanoPorOcorrencia[]>([]);
  const [totaisOcorrencias, setTotaisOcorrencias] = useState<RelatorioOcorrenciasResponse["totais"]>({
    custo_total: 0,
    total_itens: 0,
    ocorrencias_com_dano: 0,
  });
  const [carregandoOcorrencias, setCarregandoOcorrencias] = useState(true);
  const [erroOcorrencias, setErroOcorrencias] = useState("");
  const [danosPorEvento, setDanosPorEvento] = useState<DanosPorEvento[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erroEventos, setErroEventos] = useState("");
  const [ocorrenciaEventoAberta, setOcorrenciaEventoAberta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    api.get<RelatorioOcorrenciasResponse>("/danos/registros/por-ocorrencia/")
      .then((response) => {
        if (cancelado) return;
        setRelatorioOcorrencias(response.data.ocorrencias ?? []);
        setTotaisOcorrencias(response.data.totais ?? {
          custo_total: 0,
          total_itens: 0,
          ocorrencias_com_dano: 0,
        });
        setErroOcorrencias("");
      })
      .catch(() => {
        if (cancelado) return;
        setRelatorioOcorrencias([]);
        setErroOcorrencias("Não foi possível carregar os danos registrados.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoOcorrencias(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const carregarDanosPorEvento = async () => {
      try {
        const eventosResponse = await api.get<EventoListResponse>("/eventos/");
        const eventos = eventosResponse.data.eventos ?? [];
        const respostas = await Promise.all(
          eventos.map(async (evento) => {
            const response = await api.get<RelatorioOcorrenciasResponse>(
              "/danos/registros/por-ocorrencia/",
              { params: { evento_id: evento.id } },
            );
            return {
              evento,
              ocorrenciasComDano: Number(response.data.totais?.ocorrencias_com_dano || 0),
              custo: Number(response.data.totais?.custo_total || 0),
              ocorrencias: response.data.ocorrencias ?? [],
            };
          }),
        );
        if (cancelado) return;
        setDanosPorEvento(respostas.filter((grupo) => grupo.ocorrenciasComDano > 0));
        setErroEventos("");
      } catch {
        if (cancelado) return;
        setDanosPorEvento([]);
        setErroEventos("Não foi possível carregar os danos agrupados por evento.");
      } finally {
        if (!cancelado) setCarregandoEventos(false);
      }
    };

    carregarDanosPorEvento();
    return () => {
      cancelado = true;
    };
  }, []);

  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [categoriasApi, setCategoriasApi] = useState<string[]>([]);
  // `carregandoItens` e `erroItens` são DERIVADOS da comparação entre a chave
  // da consulta atual e a do último resultado — assim não chamamos setState de
  // forma síncrona dentro do efeito.
  const [carga, setCarga] = useState<{ chave: string } | null>(null);
  const [falhaItens, setFalhaItens] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [resumoDanos, setResumoDanos] = useState<ResumoDanosResponse | null>(null);
  const [carregandoResumoInicial, setCarregandoResumoInicial] = useState(true);
  const [busca, setBusca] = useState("");
  const [verInativos, setVerInativos] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ItemCatalogo | null>(null);

  const chaveCarga = `${recarga}|${verInativos}`;
  const carregandoItens = carga?.chave !== chaveCarga && falhaItens === null;
  const erroItens = carga?.chave === chaveCarga ? null : falhaItens;

  useEffect(() => {
    if (carga?.chave === chaveCarga) return;
    let cancelado = false;
    const p = new URLSearchParams();
    if (verInativos) p.set("incluir_inativos", "1");
    api
      .get<{ itens: ItemCatalogo[]; categorias: string[] }>(`/danos/itens/?${p}`)
      .then((res) => {
        if (cancelado) return;
        setItens(res.data.itens ?? []);
        setCategoriasApi(res.data.categorias ?? []);
        setFalhaItens(null);
        setCarga({ chave: chaveCarga });
      })
      .catch(() => {
        if (cancelado) return;
        setItens([]);
        setFalhaItens("Não foi possível carregar o catálogo de itens.");
        setCarga({ chave: chaveCarga });
      });
    return () => {
      cancelado = true;
    };
  }, [chaveCarga, carga, verInativos]);

  useEffect(() => {
    let cancelado = false;
    api.get<ResumoDanosResponse>("/danos/resumo/")
      .then((response) => {
        if (!cancelado) setResumoDanos(response.data);
      })
      .catch(() => {
        if (!cancelado) setResumoDanos(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoResumoInicial(false);
      });
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter(
      (i) =>
        i.nome.toLowerCase().includes(termo) ||
        (i.categoria ?? "").toLowerCase().includes(termo),
    );
  }, [itens, busca]);

  const excluirItem = useCallback(
    async (item: ItemCatalogo) => {
      try {
        const res = await api.delete<{ aviso?: string }>(`/danos/itens/${item.id}/`);
        showToast(res.data?.aviso ?? "Item removido do catálogo.");
        setRecarga((n) => n + 1);
      } catch {
        showToast("Não foi possível remover o item.", "error");
      }
    },
    [showToast],
  );

  const reativarItem = useCallback(
    async (item: ItemCatalogo) => {
      try {
        await api.post(`/danos/itens/${item.id}/reativar/`, {});
        showToast("Item reativado.");
        setRecarga((n) => n + 1);
      } catch {
        showToast("Não foi possível reativar o item.", "error");
      }
    },
    [showToast],
  );

  const emitirRelatorio = () => {
    if (carregandoOcorrencias) {
      showToast("Aguarde o carregamento dos dados de danos.", "error");
      return;
    }
    if (erroOcorrencias) {
      showToast("Não foi possível emitir o relatório sem os dados do backend.", "error");
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
      return `<div class="category-row"><div class="category-head"><strong>${escaparHtml(nome)}</strong><span>${escaparHtml(formatBRL(dados.valor))}</span></div><div class="bar"><span style="width:${percentual.toFixed(1)}%"></span></div><small>${dados.quantidade.toLocaleString("pt-BR")} itens aplicados</small></div>`;
    }).join("");
    const blocosOcorrencias = relatorioOcorrencias.map((ocorrencia, indice) => {
      const itensOcorrencia = ocorrencia.danos.map((dano) => `<tr><td><strong>${escaparHtml(dano.item_nome)}</strong><br><small>${escaparHtml(formatarCategoria(dano.categoria))}</small></td><td class="center">${Number(dano.quantidade).toLocaleString("pt-BR")} ${escaparHtml(dano.unidade)}</td><td class="money">${escaparHtml(formatBRL(Number(dano.valor_unitario_aplicado)))}</td><td class="money strong">${escaparHtml(formatBRL(Number(dano.valor_total)))}</td></tr>`).join("");
      return `<section class="occurrence"><div class="occurrence-head"><span class="sequence">${String(indice + 1).padStart(2, "0")}</span><div class="occurrence-title"><small>OCORRÊNCIA ${escaparHtml(ocorrencia.protocolo)}</small><h3>${escaparHtml(ocorrencia.titulo)}</h3><p>${escaparHtml(formatarCategoria(ocorrencia.categoria))} · ${escaparHtml(formatarDataRelatorio(ocorrencia.created_at))} · ${escaparHtml(getOccurrenceStatusMeta(ocorrencia.status).label)}</p></div><div class="occurrence-total"><small>SUBTOTAL</small><strong>${escaparHtml(formatBRL(Number(ocorrencia.custo_total || 0)))}</strong><span>${ocorrencia.total_itens} itens</span></div></div><table><thead><tr><th>Item catalogado</th><th class="center">Quantidade</th><th class="money">Valor unitário</th><th class="money">Valor total</th></tr></thead><tbody>${itensOcorrencia}</tbody></table></section>`;
    }).join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Danos - ${escaparHtml(codigo)}</title><style>
      :root{--navy:#0d1b2e;--navy2:#17324d;--teal:#007d73;--red:#ba1a1a;--ink:#17212b;--muted:#607080;--line:#dce4e8;--paper:#fff;--wash:#f3f7f8}*{box-sizing:border-box}body{margin:0;background:#dfe7ea;color:var(--ink);font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:12px;padding:12px;background:rgba(13,27,46,.94)}.toolbar button{border:0;border-radius:8px;padding:11px 18px;font-weight:700;cursor:pointer}.print{background:#17a99a;color:#fff}.close{background:#fff;color:var(--navy)}.report{width:210mm;min-height:297mm;margin:24px auto;background:var(--paper);box-shadow:0 18px 60px rgba(13,27,46,.18)}.hero{background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:18mm 16mm 14mm}.brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:16mm}.brand-logo{width:42mm;max-height:18mm;object-fit:contain}.doc-code{font-size:9px;color:#b8cad4;text-align:right;line-height:1.6}.eyebrow{color:#64d8ca;font-size:9px;font-weight:800;letter-spacing:.2em}.hero h1{font-size:34px;line-height:1.05;margin:8px 0 10px}.hero p{margin:0;color:#c7d6df;font-size:12px}main{padding:12mm 16mm 16mm}.metrics{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:9px;margin-top:-20mm;position:relative;margin-bottom:13mm}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(13,27,46,.08)}.metric.primary{background:var(--teal);border-color:var(--teal);color:#fff}.metric small{display:block;font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--muted);margin-bottom:7px}.metric.primary small{color:#c9fff6}.metric strong{display:block;font-size:20px}.metric span{display:block;font-size:9px;color:var(--muted);margin-top:5px}.metric.primary span{color:#d8fff9}.section-label{color:var(--teal);font-size:9px;font-weight:800;letter-spacing:.16em}h2{font-size:21px;color:var(--navy)}.executive{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-bottom:13mm}.insight{background:var(--wash);border-left:4px solid var(--teal);padding:15px}.insight p{font-size:11px;line-height:1.65;margin:0}.categories{border:1px solid var(--line);border-radius:10px;padding:13px}.category-row+.category-row{margin-top:10px}.category-head{display:flex;justify-content:space-between;font-size:9px}.category-row small{font-size:8px;color:var(--muted)}.bar{height:5px;background:#e8eff1;border-radius:5px;margin:5px 0}.bar span{display:block;height:100%;background:var(--teal)}.occurrence{border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10mm;break-inside:avoid}.occurrence-head{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px;background:var(--wash)}.sequence{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--navy);color:#fff;font-size:10px;font-weight:800}.occurrence-title small,.occurrence-total small{font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--teal)}.occurrence-title h3{font-size:13px;margin:3px 0}.occurrence-title p{font-size:9px;color:var(--muted);margin:0}.occurrence-total{text-align:right}.occurrence-total strong{display:block;color:var(--red);font-size:14px;margin:3px 0}.occurrence-total span{font-size:8px;color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:9px}th,td{padding:9px 10px;border-bottom:1px solid #edf1f3}th{font-size:7px;text-transform:uppercase;color:var(--muted)}.center{text-align:center}.money{text-align:right;white-space:nowrap}.strong{font-weight:800}.method{margin-top:12mm;padding-top:6mm;border-top:1px solid var(--line);font-size:8px;color:var(--muted);line-height:1.6}footer{display:flex;justify-content:space-between;padding:5mm 16mm;border-top:1px solid var(--line);font-size:8px;color:var(--muted)}@page{size:A4;margin:8mm}@media print{body{background:#fff}.no-print{display:none!important}.report{width:auto;min-height:auto;margin:0;box-shadow:none}.occurrence{page-break-inside:avoid}}
    </style></head><body><div class="toolbar no-print"><button class="print" onclick="window.print()">Salvar ou imprimir PDF</button><button class="close" onclick="window.close()">Fechar</button></div><article class="report"><header class="hero"><div class="brand"><img class="brand-logo" src="${escaparHtml(logoUrl)}" alt="Gardian"><div class="doc-code">${escaparHtml(codigo)}<br>Emitido em ${escaparHtml(agora.toLocaleString("pt-BR"))}</div></div><span class="eyebrow">DOCUMENTO OPERACIONAL</span><h1>Relatório consolidado<br>de danos e custos</h1><p>Panorama financeiro e quantitativo dos danos catalogados nas ocorrências.</p></header><main><div class="metrics"><div class="metric primary"><small>VALOR BRUTO CONSOLIDADO</small><strong>${escaparHtml(formatBRL(custoTotal))}</strong><span>Valores aplicados nos registros</span></div><div class="metric"><small>ITENS APLICADOS</small><strong>${totalItens.toLocaleString("pt-BR")}</strong><span>Em todas as categorias</span></div><div class="metric"><small>OCORRÊNCIAS</small><strong>${totaisOcorrencias.ocorrencias_com_dano.toLocaleString("pt-BR")}</strong><span>Com danos catalogados</span></div></div><div class="section-label">SÍNTESE</div><h2>Resumo executivo</h2><div class="executive"><div class="insight"><p>O levantamento consolida <strong>${totalItens.toLocaleString("pt-BR")} itens</strong> em <strong>${totaisOcorrencias.ocorrencias_com_dano.toLocaleString("pt-BR")} ocorrências</strong>. A ocorrência de maior impacto é <strong>${escaparHtml(maiorOcorrencia.protocolo)} - ${escaparHtml(maiorOcorrencia.titulo)}</strong>, estimada em <strong>${escaparHtml(formatBRL(Number(maiorOcorrencia.custo_total || 0)))}</strong>. ${maiorCategoria ? `A categoria <strong>${escaparHtml(maiorCategoria[0])}</strong> concentra ${percentualMaiorCategoria}% do valor.` : ""}</p></div><div class="categories">${resumoCategorias}</div></div><div class="section-label">DETALHAMENTO</div><h2>Danos por ocorrência</h2>${blocosOcorrencias}<div class="method"><strong>Critério de apuração</strong><br>Quantidade registrada multiplicada pelo valor unitário aplicado no momento da catalogação. Este documento representa uma estimativa operacional e pode sofrer revisões.</div></main><footer><span>GARDIAN · Defesa Civil</span><span>${escaparHtml(codigo)} · Documento gerado eletronicamente</span></footer></article></body></html>`;

    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    showToast("Relatório de danos preparado para impressão ou PDF.");
  };

  const custoTotal = Number(resumoDanos?.custo_total ?? totaisOcorrencias.custo_total ?? 0);
  const totalItens = Number(resumoDanos?.total_itens ?? totaisOcorrencias.total_itens ?? 0);
  const ocorrenciasComDano = Number(
    resumoDanos?.ocorrencias_com_dano ?? totaisOcorrencias.ocorrencias_com_dano ?? 0,
  );
  const itensAtivosCatalogo = Number(
    resumoDanos?.itens_catalogo ?? itens.filter((item) => item.ativo).length,
  );


  if (carregandoOcorrencias || carregandoEventos || carga === null || carregandoResumoInicial) {
    return <DataLoading />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GERENCIAMENTO DE DANOS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{itensAtivosCatalogo} ITENS ATIVOS NA BASE</MetaTag>
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
        <KPI label="Valor Bruto Total" value={formatBRL(custoTotal)} valueClassName={KPI_VALUE_CLASS} icon="payments" tone="error" sub="Itens aplicados em ocorrências" />
        <KPI label="Itens Aplicados" value={totalItens} valueClassName={KPI_VALUE_CLASS} icon="inventory_2" tone="warning" sub={`Em ${ocorrenciasComDano} ocorrências`} />
        <KPI label="Ocorrências c/ Danos" value={ocorrenciasComDano} valueClassName={KPI_VALUE_CLASS} icon="emergency" tone="secondary" sub="Com catalogação concluída" />
        <KPI label="Base de Itens" value={itensAtivosCatalogo} valueClassName={KPI_VALUE_CLASS} icon="database" tone="secondary" sub="Itens ativos disponíveis" />
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
          {carregandoOcorrencias && <DataLoading />}
          {!carregandoOcorrencias && erroOcorrencias && (
            <div className="card-tonal p-6 text-sm text-error">{erroOcorrencias}</div>
          )}
          {!carregandoOcorrencias && !erroOcorrencias && relatorioOcorrencias.length === 0 && (
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
                      {formatarCategoria(r.categoria)} · {formatarDataRelatorio(r.created_at)} · {getOccurrenceStatusMeta(r.status).label}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-headline font-black text-xl text-primary tracking-tighter tabular-nums whitespace-nowrap">{formatBRL(custo)}</p>
                    <MetaTag>{r.total_itens} ITENS</MetaTag>
                  </div>
                  <Icon name={open ? "expand_less" : "expand_more"} className="text-on-surface-variant text-[20px]" />
                </button>

                {open && (
                  <div className="px-6 pb-6 border-t border-outline-variant/20 pt-4">
                    <MetaTag className="block mb-3">ITENS CATALOGADOS NA OCORRÊNCIA</MetaTag>
                    <div className="space-y-2">
                      {r.danos.map((it) => (
                          <div key={it.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                            <Icon name="inventory_2" className="text-secondary text-[16px]" />
                            <span className="font-bold text-primary flex-1 min-w-0 truncate">{it.item_nome}</span>
                            <span className="text-on-surface-variant shrink-0 hidden sm:inline whitespace-nowrap">
                              {it.quantidade} {it.unidade} × {formatBRL(Number(it.valor_unitario_aplicado))}
                            </span>
                            <span className="font-black text-primary text-right shrink-0 tabular-nums whitespace-nowrap">
                              {formatBRL(Number(it.valor_total))}
                            </span>
                          </div>
                      ))}
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
          {carregandoEventos && <DataLoading />}
          {!carregandoEventos && erroEventos && (
            <div className="card-tonal p-6 text-sm text-error">{erroEventos}</div>
          )}
          {!carregandoEventos && !erroEventos && danosPorEvento.length === 0 && (
            <p className="text-[12px] text-on-surface-variant italic">Nenhum evento com danos catalogados.</p>
          )}
          {danosPorEvento.map(({ evento, ocorrenciasComDano, ocorrencias, custo }) => (
            <div key={evento.id} className="card-tonal p-7 shadow-ambient-sm">
              <SectionHeader
                overline={`EVENTO #${evento.id} · ${ocorrenciasComDano} OCORRÊNCIAS COM DANOS`}
                title={evento.nome}
                action={
                  <div className="text-right">
                    <p className="font-headline font-black text-2xl text-primary tracking-tighter tabular-nums whitespace-nowrap">{formatBRL(custo)}</p>
                    <MetaTag>VALOR BRUTO FINAL</MetaTag>
                  </div>
                }
              />
              <MetaTag className="block mb-3">DANOS SEPARADOS POR OCORRÊNCIA</MetaTag>
              <div className="space-y-3">
                {ocorrencias.map((ocorrencia) => {
                  const chave = `${evento.id}-${ocorrencia.ocorrencia_id}`;
                  const aberta = ocorrenciaEventoAberta === chave;
                  return (
                    <div
                      key={ocorrencia.ocorrencia_id}
                      className="overflow-hidden rounded-xl border border-outline-variant/25 bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() => setOcorrenciaEventoAberta(aberta ? null : chave)}
                        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-container-low"
                        aria-expanded={aberta}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error-container">
                          <Icon name="emergency" filled className="text-[18px] text-error" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-primary">
                            {ocorrencia.protocolo} · {ocorrencia.titulo}
                          </p>
                          <p className="mt-0.5 text-[10px] text-on-surface-variant">
                            {formatarCategoria(ocorrencia.categoria)} · {formatarDataRelatorio(ocorrencia.created_at)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="whitespace-nowrap text-[15px] font-black tabular-nums text-primary">
                            {formatBRL(Number(ocorrencia.custo_total || 0))}
                          </p>
                          <MetaTag>{ocorrencia.total_itens} ITENS</MetaTag>
                        </div>
                        <Icon
                          name={aberta ? "expand_less" : "expand_more"}
                          className="shrink-0 text-[20px] text-on-surface-variant"
                        />
                      </button>

                      {aberta && (
                        <div className="space-y-2 border-t border-outline-variant/20 px-4 pb-4 pt-3">
                          {ocorrencia.danos.map((dano) => (
                            <div
                              key={dano.id}
                              className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3 text-[12px]"
                            >
                              <Icon name="inventory_2" className="shrink-0 text-[16px] text-secondary" />
                              <span className="min-w-0 flex-1 truncate font-bold text-primary">
                                {dano.item_nome}
                              </span>
                              <Chip tone="neutral">{dano.quantidade} {dano.unidade}</Chip>
                              <span className="shrink-0 whitespace-nowrap text-right font-black tabular-nums text-primary">
                                {formatBRL(Number(dano.valor_total || 0))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
              <Btn
                variant="primary"
                icon="add"
                onClick={() => {
                  setEditando(null);
                  setModalAberto(true);
                }}
              >
                Novo Item
              </Btn>
            }
          />

          <div className="flex gap-3 items-center flex-wrap mb-5">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar item ou categoria…"
              className="flex-1 min-w-[220px] bg-surface-container-low rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verInativos}
                onChange={(e) => setVerInativos(e.target.checked)}
                className="w-4 h-4 accent-teal-700"
              />
              <span className="text-[11px] text-on-surface-variant">
                Mostrar itens desativados
              </span>
            </label>
          </div>

          {erroItens ? (
            <div className="text-center py-10">
              <Icon name="cloud_off" filled className="text-[32px] text-error" />
              <p className="text-sm text-on-surface-variant mt-2">{erroItens}</p>
              <div className="mt-4">
                <Btn variant="secondary" icon="refresh" onClick={() => setRecarga((n) => n + 1)}>
                  Tentar de novo
                </Btn>
              </div>
            </div>
          ) : carregandoItens ? (
            <div className="text-center py-10">
              <Icon name="progress_activity" className="text-secondary text-[28px] animate-spin" />
              <p className="text-sm text-on-surface-variant mt-2">Carregando catálogo…</p>
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-on-surface-variant">
                {busca ? "Nenhum item encontrado." : "Nenhum item no catálogo ainda."}
              </p>
              {!busca && (
                <div className="mt-4">
                  <Btn
                    variant="primary"
                    icon="add"
                    onClick={() => {
                      setEditando(null);
                      setModalAberto(true);
                    }}
                  >
                    Cadastrar o primeiro
                  </Btn>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30">
                    <th className="py-3 pr-4"><MetaTag>ITEM</MetaTag></th>
                    <th className="py-3 pr-4"><MetaTag>CATEGORIA</MetaTag></th>
                    <th className="py-3 pr-4"><MetaTag>UNIDADE</MetaTag></th>
                    <th className="py-3 pr-4"><MetaTag>ORIGEM</MetaTag></th>
                    <th className="py-3 pr-4 text-right"><MetaTag>PREÇO UNITÁRIO</MetaTag></th>
                    <th className="py-3 text-right"><MetaTag>AÇÕES</MetaTag></th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-outline-variant/15 hover:bg-surface-container-low transition-colors ${
                        c.ativo ? "" : "opacity-60"
                      }`}
                    >
                      <td className="py-3.5 pr-4 text-[13px] font-bold text-primary">
                        {c.nome}
                        {!c.ativo && <Chip tone="neutral"> DESATIVADO</Chip>}
                      </td>
                      <td className="py-3.5 pr-4"><Chip tone="neutral">{c.categoria}</Chip></td>
                      <td className="py-3.5 pr-4 text-[12px] text-on-surface-variant">{c.unidade}</td>
                      <td className="py-3.5 pr-4">
                        <Chip tone={c.origem_preco === "pesquisa" ? "secondary" : "neutral"}>
                          {c.origem_label}
                        </Chip>
                      </td>
                      <td className="py-3.5 pr-4 text-[13px] font-black text-primary text-right tabular-nums whitespace-nowrap">
                        {formatBRL(Number(c.valor_unitario))}
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(c);
                            setModalAberto(true);
                          }}
                          className="text-on-surface-variant hover:text-secondary p-1"
                          title="Editar item"
                          aria-label={`Editar ${c.nome}`}
                        >
                          <Icon name="edit" className="text-[16px]" />
                        </button>
                        {c.ativo ? (
                          <button
                            type="button"
                            onClick={() => excluirItem(c)}
                            className="text-on-surface-variant hover:text-error p-1"
                            title={
                              c.em_uso
                                ? "Item já usado em registros: será desativado, não excluído"
                                : "Excluir item"
                            }
                            aria-label={`Remover ${c.nome}`}
                          >
                            <Icon name={c.em_uso ? "visibility_off" : "delete"} className="text-[16px]" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reativarItem(c)}
                            className="text-on-surface-variant hover:text-secondary p-1"
                            title="Reativar item"
                            aria-label={`Reativar ${c.nome}`}
                          >
                            <Icon name="undo" className="text-[16px]" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <CreateDamageItemModal
        key={`item-${editando?.id ?? "novo"}-${modalAberto}`}
        open={modalAberto}
        item={editando}
        categorias={categoriasApi}
        onClose={() => {
          setModalAberto(false);
          setEditando(null);
        }}
        onSaved={() => setRecarga((n) => n + 1)}
      />

    </div>
  );
}
