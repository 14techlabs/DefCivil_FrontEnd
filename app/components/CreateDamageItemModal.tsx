// DefCivil_FrontEnd/app/components/CreateDamageItemModal.tsx
"use client";

import { useState } from "react";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

const CAMPO =
  "w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none";

type Cotacao = {
  valor: number;
  fonte: string;
  descricao: string;
  url: string | null;
  simulado?: boolean;
};

type PesquisaResposta = {
  termo: string;
  cotacoes: Cotacao[];
  sugestao_media: number | null;
  menor: number | null;
  maior: number | null;
  simulado: boolean;
};

export type ItemCatalogo = {
  id: number;
  nome: string;
  unidade: string;
  categoria: string;
  valor_unitario: string;
  origem_preco: "pesquisa" | "manual";
  origem_label: string;
  ativo: boolean;
  em_uso: boolean;
  observacoes: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CreateDamageItemModal({
  open,
  item,
  categorias,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Preenchido = edição; nulo = criação. */
  item: ItemCatalogo | null;
  categorias: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useGardian();
  const editando = item !== null;

  // Na criação o fluxo tem 2 passos: nomear + pesquisar, depois escolher o
  // valor. Na edição já entra direto no formulário.
  const [passo, setPasso] = useState<"buscar" | "valor">(editando ? "valor" : "buscar");

  const [nome, setNome] = useState(item?.nome ?? "");
  const [categoria, setCategoria] = useState(item?.categoria ?? "");
  const [unidade, setUnidade] = useState(item?.unidade ?? "un");
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? "");
  const [valor, setValor] = useState(item?.valor_unitario ?? "");
  const [origem, setOrigem] = useState<"pesquisa" | "manual">(item?.origem_preco ?? "manual");

  const [pesquisa, setPesquisa] = useState<PesquisaResposta | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscarPrecos = async () => {
    if (nome.trim().length < 2) {
      showToast("Informe o nome do item.", "error");
      return;
    }
    setBuscando(true);
    try {
      const res = await api.get<PesquisaResposta>(
        `/danos/itens/pesquisar-preco/?nome=${encodeURIComponent(nome.trim())}`,
      );
      setPesquisa(res.data);
      setPasso("valor");
    } catch {
      // Não travamos o cadastro se a pesquisa falhar: a pessoa segue e digita
      // o valor à mão.
      showToast("Não foi possível pesquisar preços. Informe o valor manualmente.", "error");
      setPesquisa(null);
      setPasso("valor");
    } finally {
      setBuscando(false);
    }
  };

  const escolher = (v: number) => {
    setValor(v.toFixed(2));
    setOrigem("pesquisa");
  };

  const salvar = async () => {
    const numero = Number(String(valor).replace(",", "."));
    if (!nome.trim()) {
      showToast("Informe o nome do item.", "error");
      return;
    }
    if (!Number.isFinite(numero) || numero < 0) {
      showToast("Informe um valor unitário válido.", "error");
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        nome: nome.trim(),
        unidade: unidade.trim() || "un",
        valor_unitario: numero.toFixed(2),
        origem_preco: origem,
        observacoes: observacoes.trim(),
        ...(editando ? {} : { categoria: categoria.trim() || "Geral" }),
        ...(pesquisa ? { cotacoes: pesquisa.cotacoes } : {}),
      };
      if (editando) {
        await api.patch(`/danos/itens/${item.id}/`, corpo);
        showToast("Item atualizado.");
      } else {
        await api.post("/danos/itens/", corpo);
        showToast("Item criado no catálogo.");
      }
      onSaved();
      onClose();
    } catch (e) {
      const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let msg = "Não foi possível salvar o item.";
      if (typeof data?.error === "string") msg = data.error;
      else if (Array.isArray(data?.valor_unitario)) msg = String(data.valor_unitario[0]);
      showToast(msg, "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6 flex items-start justify-between gap-4">
        <div>
          <Chip tone="primarySoft" className="!bg-white/15 !text-white">
            {editando ? `ITEM #${item.id}` : passo === "buscar" ? "PASSO 1 DE 2" : "PASSO 2 DE 2"}
          </Chip>
          <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">
            {editando ? "Editar item" : passo === "buscar" ? "Novo item" : nome}
          </h2>
          <p className="text-white/70 text-xs mt-1">
            {passo === "buscar"
              ? "Informe o nome e busque valores de referência."
              : "Escolha um valor da pesquisa ou informe o seu."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
          <Icon name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
        {passo === "buscar" ? (
          <>
            <div>
              <MetaTag className="block mb-1.5">NOME DO ITEM *</MetaTag>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscarPrecos();
                  }
                }}
                placeholder="Ex.: Colchão solteiro, Cesta básica, Telha"
                className={CAMPO}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <MetaTag className="block mb-1.5">CATEGORIA</MetaTag>
                <input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  list="categorias-dano"
                  placeholder="Assistência humanitária"
                  className={CAMPO}
                />
                <datalist id="categorias-dano">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <MetaTag className="block mb-1.5">UNIDADE</MetaTag>
                <input
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  placeholder="un, kg, m², cesta…"
                  className={CAMPO}
                />
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5">
              <Icon name="info" className="text-[14px] mt-0.5" />
              A busca traz valores de referência para você comparar. Você pode
              escolher um deles ou digitar o seu próprio valor no passo seguinte.
            </p>
          </>
        ) : (
          <>
            {pesquisa && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <MetaTag>VALORES ENCONTRADOS ({pesquisa.cotacoes.length})</MetaTag>
                  {pesquisa.simulado && (
                    <Chip tone="warning">VALORES SIMULADOS — BUSCA REAL PENDENTE</Chip>
                  )}
                </div>

                <div className="space-y-1.5">
                  {pesquisa.cotacoes.map((cot, i) => {
                    const selecionado = Number(valor) === cot.valor;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => escolher(cot.valor)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${
                          selecionado
                            ? "bg-secondary/12 ring-2 ring-secondary"
                            : "bg-surface-container-low hover:bg-secondary/8"
                        }`}
                      >
                        <Icon
                          name={selecionado ? "radio_button_checked" : "radio_button_unchecked"}
                          className="text-secondary text-[18px]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-primary">{brl(cot.valor)}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {cot.fonte} · {cot.descricao}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {pesquisa.sugestao_media != null && (
                  <div className="card-recessed p-3 flex items-center gap-3 flex-wrap">
                    <MetaTag>REFERÊNCIAS</MetaTag>
                    <button
                      type="button"
                      onClick={() => escolher(pesquisa.sugestao_media!)}
                      className="text-[11px] font-bold text-secondary hover:underline"
                    >
                      Média {brl(pesquisa.sugestao_media)}
                    </button>
                    <span className="text-[11px] text-on-surface-variant">
                      Menor {brl(pesquisa.menor ?? 0)} · Maior {brl(pesquisa.maior ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <MetaTag className="block mb-1.5">NOME *</MetaTag>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
              </div>
              <div>
                <MetaTag className="block mb-1.5">UNIDADE</MetaTag>
                <input
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className={CAMPO}
                />
              </div>
              {!editando && (
                <div>
                  <MetaTag className="block mb-1.5">CATEGORIA</MetaTag>
                  <input
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    list="categorias-dano-2"
                    className={CAMPO}
                  />
                  <datalist id="categorias-dano-2">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              )}
              <div>
                <MetaTag className="block mb-1.5">VALOR UNITÁRIO (R$) *</MetaTag>
                <input
                  value={valor}
                  onChange={(e) => {
                    setValor(e.target.value);
                    setOrigem("manual");
                  }}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={CAMPO}
                />
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {origem === "pesquisa"
                    ? "Valor escolhido da pesquisa."
                    : "Valor informado manualmente."}
                </p>
              </div>
            </div>

            <div>
              <MetaTag className="block mb-1.5">OBSERVAÇÕES</MetaTag>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Referência de preço, fornecedor, validade da cotação…"
                className={`${CAMPO} resize-none`}
              />
            </div>
          </>
        )}
      </div>

      <div className="border-t border-outline-variant/20 p-5 flex items-center justify-between gap-3">
        {passo === "buscar" ? (
          <>
            <Btn variant="ghost" onClick={onClose}>
              Cancelar
            </Btn>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setPasso("valor")}>
                Pular busca
              </Btn>
              <Btn variant="primary" icon="search" onClick={buscarPrecos} disabled={buscando}>
                {buscando ? "Buscando…" : "Buscar na web"}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <Btn
              variant="ghost"
              icon={editando ? undefined : "arrow_back"}
              onClick={editando ? onClose : () => setPasso("buscar")}
            >
              {editando ? "Cancelar" : "Voltar"}
            </Btn>
            <Btn variant="success" icon="check" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar item"}
            </Btn>
          </>
        )}
      </div>
    </ModalShell>
  );
}