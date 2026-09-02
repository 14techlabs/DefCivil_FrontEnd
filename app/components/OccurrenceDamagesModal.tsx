// DefCivil_FrontEnd/app/components/OccurrenceDamagesModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

interface CatalogItem {
  id: number;
  nome: string;
  unidade: string;
  categoria: string;
  valor_unitario: string | number;
}

interface DamageRecord {
  id: number;
  item: number;
  item_nome: string;
  unidade: string;
  categoria: string;
  quantidade: number;
  valor_unitario_aplicado: string | number;
  valor_total: string | number;
  observacoes: string;
  created_at: string;
  usar_preco_catalogo?: boolean;
}

interface Props {
  open: boolean;
  ocorrenciaId: number;
  fatalidades: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const moeda = (valor: string | number) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** ISO -> '25/08 14:36'. Split evita o fuso do `new Date`. */
function formatarDataHistorico(iso: string): string {
  if (!iso) return "—";
  const [data, hora] = iso.split("T");
  const [, m, d] = data.split("-");
  return `${d}/${m} ${(hora ?? "").slice(0, 5)}`;
}

type DanoHumano = {
  feridos_leves: number;
  feridos_graves: number;
  obitos: number;
  desaparecidos: number;
  desalojados: number;
  desabrigados: number;
  observacoes: string;
  total_afetados: number;
  tem_vitima_fatal: boolean;
};

type EntradaHistorico = {
  id: number;
  tipo_label: string;
  acao_label: string;
  campos_alterados: string[];
  criado_em: string;
};

const HUMANO_VAZIO: DanoHumano = {
  feridos_leves: 0,
  feridos_graves: 0,
  obitos: 0,
  desaparecidos: 0,
  desalojados: 0,
  desabrigados: 0,
  observacoes: "",
  total_afetados: 0,
  tem_vitima_fatal: false,
};

/** Ordem em que a Defesa Civil costuma reportar. */
const CATEGORIAS_HUMANO: { campo: keyof DanoHumano; rotulo: string; alerta?: boolean }[] = [
  { campo: "obitos", rotulo: "ÓBITOS", alerta: true },
  { campo: "desaparecidos", rotulo: "DESAPARECIDOS", alerta: true },
  { campo: "feridos_graves", rotulo: "FERIDOS GRAVES" },
  { campo: "feridos_leves", rotulo: "FERIDOS LEVES" },
  { campo: "desabrigados", rotulo: "DESABRIGADOS" },
  { campo: "desalojados", rotulo: "DESALOJADOS" },
];

export function OccurrenceDamagesModal({
  open,
  ocorrenciaId,
  fatalidades,
  onClose,
  onSaved,
}: Props) {
  const { showToast } = useGardian();
  const [catalogo, setCatalogo] = useState<CatalogItem[]>([]);
  const [danos, setDanos] = useState<DamageRecord[]>([]);
  const [danosOriginais, setDanosOriginais] = useState<DamageRecord[]>([]);
  const [fatalidadesDraft, setFatalidadesDraft] = useState("0");

  /**
   * Dano humano detalhado. `fatalidades` na ocorrência é o contador simples;
   * gravar `obitos` aqui atualiza aquele campo automaticamente no backend, o
   * que evita dois lugares escrevendo o mesmo número.
   */
  const [humano, setHumano] = useState<DanoHumano>(HUMANO_VAZIO);
  const [temHumano, setTemHumano] = useState(false);
  const [historicoDanos, setHistoricoDanos] = useState<EntradaHistorico[]>([]);
  const [aba, setAba] = useState<"material" | "humano" | "historico">("material");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [itemId, setItemId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [usarCatalogo, setUsarCatalogo] = useState(true);
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalogoResponse, danosResponse, humanoResponse, historicoResponse] =
        await Promise.all([
          api.get<{ itens: CatalogItem[] }>("/danos/itens/"),
          api.get<{ danos: DamageRecord[] }>("/danos/registros/", {
            params: { ocorrencia: ocorrenciaId },
          }),
          // Dano humano e histórico são complementares: se falharem, a aba de
          // material ainda é útil. Por isso cada um tem seu próprio catch.
          api
            .get<{ dano_humano: DanoHumano }>(
              `/danos/ocorrencia/${ocorrenciaId}/humano/`,
            )
            .catch(() => null),
          api
            .get<{ historico: EntradaHistorico[] }>(
              `/danos/ocorrencia/${ocorrenciaId}/historico/`,
            )
            .catch(() => null),
        ]);

      setCatalogo(catalogoResponse.data.itens ?? []);
      const registros = (danosResponse.data.danos ?? []).map((dano) => ({
        ...dano,
        usar_preco_catalogo: false,
      }));
      setDanos(registros);
      setDanosOriginais(registros);

      // 204 devolve corpo vazio: `data` vem como string vazia, não objeto.
      const dh = humanoResponse?.data?.dano_humano ?? null;
      setHumano(dh ?? HUMANO_VAZIO);
      setTemHumano(dh != null);
      setHistoricoDanos(historicoResponse?.data?.historico ?? []);
    } catch {
      setCatalogo([]);
      setDanos([]);
      setError("Não foi possível carregar os danos e o catálogo.");
    } finally {
      setLoading(false);
    }
  }, [ocorrenciaId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setFatalidadesDraft(String(fatalidades ?? 0));
      setEditandoId(null);
      setItemId("");
      setQuantidade("1");
      setValorUnitario("");
      setUsarCatalogo(true);
      setObservacoes("");
      void carregar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, fatalidades, carregar]);

  const custoTotal = useMemo(
    () => danos.reduce((total, dano) => total + Number(dano.valor_total || 0), 0),
    [danos],
  );

  const limparFormulario = () => {
    setEditandoId(null);
    setItemId("");
    setQuantidade("1");
    setValorUnitario("");
    setUsarCatalogo(true);
    setObservacoes("");
    setError("");
  };

  const iniciarEdicao = (dano: DamageRecord) => {
    setEditandoId(dano.id);
    setItemId(String(dano.item));
    setQuantidade(String(dano.quantidade));
    setValorUnitario(String(dano.valor_unitario_aplicado ?? ""));
    setUsarCatalogo(dano.usar_preco_catalogo ?? false);
    setObservacoes(dano.observacoes ?? "");
    setError("");
  };

  const aplicarDanoAoRascunho = () => {
    const item = Number(itemId);
    const qtd = Number(quantidade);
    const unitario = Number(valorUnitario.replace(",", "."));
    if (!Number.isInteger(item) || item < 1) {
      setError("Selecione um item do catálogo.");
      return;
    }
    if (!Number.isInteger(qtd) || qtd < 1) {
      setError("A quantidade deve ser um número inteiro igual ou maior que 1.");
      return;
    }
    if (!usarCatalogo && (!valorUnitario.trim() || !Number.isFinite(unitario) || unitario < 0)) {
      setError("Informe um valor unitário válido ou use o preço do catálogo.");
      return;
    }

    const itemCatalogo = catalogo.find((itemCatalogado) => itemCatalogado.id === item);
    if (!itemCatalogo) {
      setError("O item selecionado não está mais disponível no catálogo.");
      return;
    }
    const valorAplicado = usarCatalogo ? Number(itemCatalogo.valor_unitario) : unitario;
    const registro: DamageRecord = {
      id: editandoId ?? -Date.now(),
      item,
      item_nome: itemCatalogo.nome,
      unidade: itemCatalogo.unidade,
      categoria: itemCatalogo.categoria,
      quantidade: qtd,
      valor_unitario_aplicado: valorAplicado,
      valor_total: valorAplicado * qtd,
      observacoes: observacoes.trim(),
      created_at: editandoId === null
        ? new Date().toISOString()
        : danos.find((dano) => dano.id === editandoId)?.created_at ?? new Date().toISOString(),
      usar_preco_catalogo: usarCatalogo,
    };
    setDanos((atuais) => editandoId === null
      ? [registro, ...atuais]
      : atuais.map((dano) => dano.id === editandoId ? registro : dano));
    limparFormulario();
  };

  const excluirDano = (dano: DamageRecord) => {
    if (!window.confirm(`Remover ${dano.item_nome} desta ocorrência? A remoção será aplicada ao salvar.`)) return;
    setDanos((atuais) => atuais.filter((item) => item.id !== dano.id));
    if (editandoId === dano.id) limparFormulario();
  };

  function ajustarHumano(campo: keyof DanoHumano, delta: number) {
    setHumano((h) => {
      const atual = Number(h[campo]) || 0;
      // Nunca abaixo de zero: o backend rejeitaria e o erro chegaria tarde.
      return { ...h, [campo]: Math.max(0, atual + delta) };
    });
  }

  const salvarTudo = async () => {
    const fatalidadesValor = Number(fatalidadesDraft);
    if (!Number.isInteger(fatalidadesValor) || fatalidadesValor < 0) {
      setError("Fatalidades deve ser um número inteiro igual ou maior que zero.");
      return;
    }

    const idsAtuais = new Set(danos.filter((dano) => dano.id > 0).map((dano) => dano.id));
    const excluidos = danosOriginais.filter((dano) => !idsAtuais.has(dano.id));
    const novos = danos.filter((dano) => dano.id < 0);
    const originaisPorId = new Map(danosOriginais.map((dano) => [dano.id, dano]));
    const alterados = danos.filter((dano) => {
      if (dano.id < 0) return false;
      const original = originaisPorId.get(dano.id);
      return original && (
        original.item !== dano.item
        || original.quantidade !== dano.quantidade
        || Number(original.valor_unitario_aplicado) !== Number(dano.valor_unitario_aplicado)
        || original.observacoes !== dano.observacoes
        || dano.usar_preco_catalogo === true
      );
    });

    const payloadDano = (dano: DamageRecord) => ({
      ocorrencia: ocorrenciaId,
      item: dano.item,
      quantidade: dano.quantidade,
      valor_unitario_aplicado: dano.usar_preco_catalogo ? null : Number(dano.valor_unitario_aplicado),
      observacoes: dano.observacoes,
    });

    setSaving(true);
    setError("");
    /**
     * O PUT do dano humano já atualiza `fatalidades` na ocorrência (o backend
     * sincroniza com `obitos`). Por isso não fazemos os dois: o PATCH direto
     * só entra quando o detalhamento nunca foi preenchido, para não descartar
     * o número que já estava lá.
     */
    const operacoesHumano = temHumano || humano.total_afetados > 0
      ? [
          api.put(`/danos/ocorrencia/${ocorrenciaId}/humano/`, {
            feridos_leves: humano.feridos_leves,
            feridos_graves: humano.feridos_graves,
            obitos: humano.obitos,
            desaparecidos: humano.desaparecidos,
            desalojados: humano.desalojados,
            desabrigados: humano.desabrigados,
            observacoes: humano.observacoes,
          }),
        ]
      : [api.patch(`/ocorrencias/${ocorrenciaId}/`, { fatalidades: fatalidadesValor })];

    const operacoes = [
      ...operacoesHumano,
      ...excluidos.map((dano) => api.delete(`/danos/registros/${dano.id}/`)),
      ...novos.map((dano) => api.post("/danos/registros/", payloadDano(dano))),
      ...alterados.map((dano) => api.patch(`/danos/registros/${dano.id}/`, payloadDano(dano))),
    ];
    const resultados = await Promise.allSettled(operacoes);
    const falhas = resultados.filter((resultado) => resultado.status === "rejected").length;
    try {
      await carregar();
      await onSaved();
    } finally {
      setSaving(false);
    }
    if (falhas > 0) {
      setError(`${falhas} alteração(ões) não puderam ser salvas. Os dados foram recarregados para evitar inconsistências.`);
    } else {
      showToast("Danos e custos atualizados.");
      onClose();
    }
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-3xl">
      <div className="bg-surface-container-low px-8 py-6">
        <MetaTag>OCORRÊNCIA #{ocorrenciaId}</MetaTag>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-tighter text-primary">
          Danos humanos, materiais e custos
        </h2>
      </div>

      <div className="max-h-[72vh] space-y-6 overflow-y-auto p-8">
        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-lg bg-error-container p-4 text-sm font-bold text-on-error-container">
            <Icon name="error" filled className="shrink-0 text-error" /> {error}
          </div>
        )}

        <section className="card-recessed p-5">
          <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <MetaTag className="block">DANO HUMANO</MetaTag>
              <p className="mt-1 text-sm font-black text-primary">
                Vítimas e afetados
                {!temHumano && (
                  <span className="ml-2 text-[11px] font-bold text-on-surface-variant">
                    ainda não registrado
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <MetaTag className="block">TOTAL AFETADOS</MetaTag>
              <p
                className={`text-2xl font-black tracking-tighter ${
                  humano.obitos > 0 || humano.desaparecidos > 0
                    ? "text-error"
                    : "text-primary"
                }`}
              >
                {CATEGORIAS_HUMANO.reduce(
                  (soma, c) => soma + (Number(humano[c.campo]) || 0),
                  0,
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CATEGORIAS_HUMANO.map(({ campo, rotulo, alerta }) => (
              <div
                key={campo}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-2.5"
              >
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-mono-tight ${
                    alerta ? "text-error" : "text-on-surface-variant"
                  }`}
                >
                  {rotulo}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => ajustarHumano(campo, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-high text-lg font-black text-primary hover:bg-secondary/12"
                    aria-label={`Diminuir ${rotulo}`}
                  >
                    −
                  </button>
                  <span className="w-9 text-center font-mono text-sm font-black text-primary tabular-nums">
                    {String(humano[campo])}
                  </span>
                  <button
                    type="button"
                    onClick={() => ajustarHumano(campo, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-high text-lg font-black text-primary hover:bg-secondary/12"
                    aria-label={`Aumentar ${rotulo}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
            Desalojado vai para casa de conhecidos; desabrigado depende de abrigo
            público. A distinção é da classificação oficial e entra no relatório de
            repasse. O número de óbitos atualiza o campo de fatalidades da ocorrência.
          </p>

          <label className="mt-4 block">
            <MetaTag className="mb-2 block">OBSERVAÇÕES</MetaTag>
            <textarea
              value={humano.observacoes}
              onChange={(event) =>
                setHumano((h) => ({ ...h, observacoes: event.target.value }))
              }
              rows={2}
              placeholder="Detalhes sobre as vítimas"
              className="w-full resize-none rounded-lg border-none bg-white px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary"
            />
          </label>
        </section>

        {historicoDanos.length > 0 && (
          <section className="card-recessed p-5">
            <MetaTag className="mb-3 block">
              HISTÓRICO DE DANOS ({historicoDanos.length})
            </MetaTag>
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {historicoDanos.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-[11px]"
                >
                  <span className="font-bold text-primary">
                    {h.tipo_label} · {h.acao_label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-on-surface-variant">
                    {h.campos_alterados.join(", ") || "—"}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
                    {formatarDataHistorico(h.criado_em)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <MetaTag className="block">DANOS MATERIAIS</MetaTag>
              <p className="mt-1 text-sm font-black text-primary">Itens registrados</p>
            </div>
            <div className="text-right">
              <MetaTag className="block">CUSTO TOTAL</MetaTag>
              <p className="font-headline text-xl font-black text-primary">{moeda(custoTotal)}</p>
            </div>
          </div>

          {loading ? (
            <p className="rounded-lg bg-surface-container-low p-5 text-sm text-on-surface-variant">Carregando danos…</p>
          ) : danos.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low p-5 text-sm text-on-surface-variant">Nenhum dano material registrado.</p>
          ) : (
            <div className="space-y-2">
              {danos.map((dano) => (
                <div key={dano.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-4">
                  <Icon name="inventory_2" className="shrink-0 text-secondary" />
                  <div className="min-w-48 flex-1">
                    <p className="text-sm font-black text-primary">{dano.item_nome}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {dano.quantidade} {dano.unidade} × {moeda(dano.valor_unitario_aplicado)}
                      {dano.observacoes ? ` · ${dano.observacoes}` : ""}
                    </p>
                  </div>
                  <p className="min-w-24 text-right text-sm font-black text-primary">{moeda(dano.valor_total)}</p>
                  <button type="button" onClick={() => iniciarEdicao(dano)} className="rounded-lg p-2 hover:bg-white" aria-label={`Editar ${dano.item_nome}`}>
                    <Icon name="edit" className="text-[18px] text-primary" />
                  </button>
                  <button type="button" onClick={() => excluirDano(dano)} className="rounded-lg p-2 hover:bg-error-container" aria-label={`Remover ${dano.item_nome}`}>
                    <Icon name="delete" className="text-[18px] text-error" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-tonal p-5 shadow-[0_0_28px_-8px_rgba(5,17,37,0.18)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="mt-1 text-sm font-black text-primary">{editandoId === null ? "Adicionar item" : "Atualizar item registrado"}</p>
            </div>
            {editandoId !== null && <Btn variant="ghost" onClick={limparFormulario}>Cancelar edição</Btn>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <MetaTag className="mb-2 block">ITEM DO CATÁLOGO</MetaTag>
              <div className="relative">
                <select
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                  className="w-full appearance-none rounded-lg border-none bg-surface-container-low py-3 pl-4 pr-12 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Selecione um item</option>
                  {catalogo.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome} · {item.categoria} · {moeda(item.valor_unitario)}/{item.unidade}</option>
                  ))}
                </select>
                <Icon
                  name="keyboard_arrow_down"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-primary"
                />
              </div>
            </label>
            <label>
              <MetaTag className="mb-2 block">QUANTIDADE</MetaTag>
              <input
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(event) => setQuantidade(event.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
              />
            </label>
            <div>
              <MetaTag className="mb-2 block">VALOR UNITÁRIO</MetaTag>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
                <input type="checkbox" checked={usarCatalogo} onChange={(event) => setUsarCatalogo(event.target.checked)} className="accent-[#006A60]" />
                Usar o preço atual do catálogo
              </label>
              {!usarCatalogo && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorUnitario}
                  onChange={(event) => setValorUnitario(event.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary"
                />
              )}
            </div>
            <label>
              <MetaTag className="mb-2 block">OBSERVAÇÕES</MetaTag>
              <textarea
                rows={3}
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Detalhes do dano, estado do item ou justificativa do valor…"
                className="w-full resize-y rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Btn variant="secondary" icon={editandoId === null ? "add" : "check"} onClick={aplicarDanoAoRascunho} disabled={saving || loading || catalogo.length === 0}>
              {editandoId === null ? "Adicionar à lista" : "Aplicar edição"}
            </Btn>
          </div>
          {!loading && catalogo.length === 0 && (
            <p className="mt-3 text-xs font-bold text-on-surface-variant">Cadastre primeiro um item na Base de Danos.</p>
          )}
        </section>
      </div>

      <div className="flex gap-3 border-t border-outline-variant/20 px-8 py-5">
        <Btn variant="secondary" onClick={onClose} full disabled={saving}>Cancelar</Btn>
        <Btn variant="primary" icon="save" onClick={() => void salvarTudo()} full disabled={saving || loading}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Btn>
      </div>
    </ModalShell>
  );
}