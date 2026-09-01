// DefCivil_FrontEnd/app/(gardian)/damages/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader, Tab } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_DANOS_CATALOGO,
  MOCK_DANOS_REGISTROS,
  MOCK_OCORRENCIAS,
  MOCK_EVENTOS,
  formatBRL,
  tecnicoNome,
  zonaNome,
  type DanoCatalogoItem,
} from "@/app/data/mock";
import { api } from "@/app/services/Api";
import {
  CreateDamageItemModal,
  type ItemCatalogo,
} from "@/app/components/CreateDamageItemModal";

export default function DamagesPage() {
  const { showToast } = useGardian();

  const [tab, setTab] = useState<"ocorrencias" | "eventos" | "catalogo">("ocorrencias");
  // Os registros por ocorrência/evento ainda usam o catálogo mock; só a aba
  // "Catálogo" foi migrada para a API.
  const [catalogo] = useState<DanoCatalogoItem[]>(MOCK_DANOS_CATALOGO);
  const [detalheOc, setDetalheOc] = useState<number | null>(null);

  // Catálogo real, vindo da API. Os registros por ocorrência/evento seguem em
  // mock por enquanto — só a base de itens foi integrada.
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [categoriasApi, setCategoriasApi] = useState<string[]>([]);
  // `carregandoItens` e `erroItens` são DERIVADOS da comparação entre a chave
  // da consulta atual e a do último resultado — assim não chamamos setState de
  // forma síncrona dentro do efeito.
  const [carga, setCarga] = useState<{ chave: string } | null>(null);
  const [falhaItens, setFalhaItens] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
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
        // Item em uso é desativado, não apagado — o backend avisa quando isso
        // acontece, e repassamos para a pessoa entender o que houve.
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

  const catalogoById = useMemo(
    () => new Map(catalogo.map((c) => [c.id, c])),
    [catalogo],
  );

  const custoRegistro = (itens: { catalogoId: number; quantidade: number }[]) =>
    itens.reduce((acc, it) => acc + (catalogoById.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade, 0);

  const custoTotal = useMemo(
    () => MOCK_DANOS_REGISTROS.reduce((acc, r) => acc + custoRegistro(r.itens), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogo],
  );

  const totalItens = useMemo(
    () => MOCK_DANOS_REGISTROS.reduce((acc, r) => acc + r.itens.reduce((a, i) => a + i.quantidade, 0), 0),
    [],
  );

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


  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GERENCIAMENTO DE DANOS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{itens.length} ITENS NA BASE</MetaTag>
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
        <KPI label="Valor Bruto Total" value={formatBRL(custoTotal)} icon="payments" tone="error" sub="Itens aplicados em ocorrências" />
        <KPI label="Itens Aplicados" value={totalItens} icon="inventory_2" tone="warning" sub={`Em ${MOCK_DANOS_REGISTROS.length} registros`} />
        <KPI label="Ocorrências c/ Danos" value={MOCK_DANOS_REGISTROS.length} icon="emergency" tone="secondary" sub="Com catalogação concluída" />
        <KPI label="Base de Itens" value={itens.length} icon="database" tone="secondary" sub="Preços de referência" />
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
          {MOCK_DANOS_REGISTROS.map((r) => {
            const oc = MOCK_OCORRENCIAS.find((o) => o.id === r.ocorrenciaId);
            const custo = custoRegistro(r.itens);
            const open = detalheOc === r.id;
            return (
              <div key={r.id} className="card-tonal shadow-ambient-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDetalheOc(open ? null : r.id)}
                  className="w-full flex items-center gap-4 p-6 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center shrink-0">
                    <Icon name="emergency" filled className="text-error text-[20px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-primary truncate">
                      #{r.ocorrenciaId} · {oc?.titulo ?? "Ocorrência"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {oc ? zonaNome(oc.zona) : "—"} · Registrado por {tecnicoNome(r.registradoPor)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-headline font-black text-xl text-primary tracking-tighter tabular-nums whitespace-nowrap">{formatBRL(custo)}</p>
                    <MetaTag>{r.itens.reduce((a, i) => a + i.quantidade, 0)} ITENS</MetaTag>
                  </div>
                  <Icon name={open ? "expand_less" : "expand_more"} className="text-on-surface-variant text-[20px]" />
                </button>

                {open && (
                  <div className="px-6 pb-6 border-t border-outline-variant/20 pt-4">
                    <MetaTag className="block mb-3">ITENS CATALOGADOS NA OCORRÊNCIA</MetaTag>
                    <div className="space-y-2">
                      {r.itens.map((it, i) => {
                        const c = catalogoById.get(it.catalogoId);
                        if (!c) return null;
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                            <Icon name="inventory_2" className="text-secondary text-[16px]" />
                            <span className="font-bold text-primary flex-1 min-w-0 truncate">{c.nome}</span>
                            <span className="text-on-surface-variant shrink-0 hidden sm:inline whitespace-nowrap">
                              {it.quantidade} {c.unidade} × {formatBRL(c.precoUnitario)}
                            </span>
                            <span className="font-black text-primary text-right shrink-0 tabular-nums whitespace-nowrap">
                              {formatBRL(it.quantidade * c.precoUnitario)}
                            </span>
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
                    <p className="font-headline font-black text-2xl text-primary tracking-tighter tabular-nums whitespace-nowrap">{formatBRL(custo)}</p>
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
                      <span className="font-bold text-primary flex-1 min-w-0 truncate">{c.nome}</span>
                      <Chip tone="neutral">{qtd} {c.unidade}</Chip>
                      <span className="font-black text-primary text-right shrink-0 tabular-nums whitespace-nowrap">
                        {formatBRL(qtd * c.precoUnitario)}
                      </span>
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