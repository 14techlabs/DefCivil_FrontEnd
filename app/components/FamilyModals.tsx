// DefCivil_FrontEnd/app/components/FamilyModals.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { AddressLocationField } from "@/app/components/AddressLocationField";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

const CAMPO =
  "w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none";

function mensagemErro(e: unknown, padrao: string) {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (typeof data?.error === "string") return data.error;
  return padrao;
}

/* ══════════════════════════════════════════════════════════════════════
   EDITAR FAMÍLIA — nome, contato e localização
   ══════════════════════════════════════════════════════════════════════ */

type FamiliaEditavel = {
  id: number;
  nome: string;
  endereco: string;
  telefone: string;
  coordenadas: { lat: number; lng: number } | null;
  zona_nome: string | null;
  area_de_risco: boolean;
};

export function EditFamilyModal({
  open,
  familia,
  onClose,
  onSaved,
}: {
  open: boolean;
  familia: FamiliaEditavel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useGardian();

  // `key` no ModalShell (ver families/page.tsx) garante remontagem a cada
  // abertura, então o estado inicial já vem da família certa — sem efeito
  // de sincronização.
  const [nome, setNome] = useState(familia?.nome ?? "");
  const [endereco, setEndereco] = useState(familia?.endereco ?? "");
  const [telefone, setTelefone] = useState(familia?.telefone ?? "");
  const [areaDeRisco, setAreaDeRisco] = useState(familia?.area_de_risco ?? false);
  const [lat, setLat] = useState(familia?.coordenadas ? String(familia.coordenadas.lat) : "");
  const [lng, setLng] = useState(familia?.coordenadas ? String(familia.coordenadas.lng) : "");
  const [zonaNome, setZonaNome] = useState<string | null>(familia?.zona_nome ?? null);
  const [salvando, setSalvando] = useState(false);

  if (!familia) return null;

  const coordOk =
    lat.trim() !== "" && lng.trim() !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));

  const salvar = async () => {
    if (!nome.trim()) {
      showToast("Informe o nome da família.", "error");
      return;
    }
    setSalvando(true);
    try {
      const res = await api.patch<{ familia: { zona_nome: string | null } }>(
        `/familias/${familia.id}/`,
        {
          nome: nome.trim(),
          endereco: endereco.trim(),
          telefone: telefone.trim(),
          area_de_risco: areaDeRisco,
          ...(coordOk ? { coordenadas: { lat: Number(lat), lng: Number(lng) } } : {}),
        },
      );
      const zona = res.data.familia.zona_nome;
      showToast(zona ? `Família atualizada — zona ${zona}.` : "Família atualizada.");
      onSaved();
      onClose();
    } catch (e) {
      showToast(mensagemErro(e, "Não foi possível salvar as alterações."), "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6 flex items-start justify-between gap-4">
        <div>
          <Chip tone="primarySoft" className="!bg-white/15 !text-white">
            FAMÍLIA {familia.id}
          </Chip>
          <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">
            Editar família
          </h2>
          <p className="text-white/70 text-xs mt-1">
            Mudar a localização recalcula a zona automaticamente.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
          <Icon name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <MetaTag className="block mb-1.5">NOME DA FAMÍLIA *</MetaTag>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
          </div>
          <div>
            <MetaTag className="block mb-1.5">TELEFONE</MetaTag>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={CAMPO}
            />
          </div>
        </div>

        <AddressLocationField
          endereco={endereco}
          onEnderecoChange={setEndereco}
          lat={lat}
          lng={lng}
          onCoordChange={(la, ln) => {
            setLat(la);
            setLng(ln);
          }}
          zonaNome={zonaNome}
          onZonaChange={setZonaNome}
          height={200}
        />

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={areaDeRisco}
            onChange={(e) => setAreaDeRisco(e.target.checked)}
            className="w-4 h-4 accent-red-600"
          />
          <span className="text-[12px] text-on-surface">
            Marcar residência como <strong>área de risco</strong>
          </span>
        </label>
      </div>

      <div className="border-t border-outline-variant/20 p-5 flex items-center justify-between gap-3">
        <Btn variant="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn variant="success" icon="check" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Btn>
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TRANSFERIR CIDADÃO — mudar de família ou desmembrar numa nova
   ══════════════════════════════════════════════════════════════════════ */

type CidadaoResumo = { id: number; nome: string; parentesco: string };
type FamiliaOpcao = {
  id: number;
  nome: string;
  endereco?: string;
  zona_nome: string | null;
  total_cidadaos: number;
  distancia_m?: number | null;
  responsavel?: string | null;
};

function distanciaLegivel(m?: number | null) {
  if (m == null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function TransferCidadaoModal({
  open,
  cidadao,
  familiaOrigemId,
  origemCoordenadas,
  onClose,
  onDone,
}: {
  open: boolean;
  cidadao: CidadaoResumo | null;
  familiaOrigemId: number | null;
  origemCoordenadas: { lat: number; lng: number } | null;
  onClose: () => void;
  onDone: (novaFamiliaId: number) => void;
}) {
  const { showToast } = useGardian();

  const [modo, setModo] = useState<"existente" | "nova">("existente");
  const [destinoId, setDestinoId] = useState<number | "">("");

  // Busca no servidor: numa base grande, listar todas as famílias no cliente
  // seria inviável. O backend também ordena por proximidade quando recebe a
  // coordenada de origem — quem muda de casa costuma ir para perto.
  const [termo, setTermo] = useState("");
  const [somenteVizinhas, setSomenteVizinhas] = useState(false);
  const [opcoes, setOpcoes] = useState<FamiliaOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [parentesco, setParentesco] = useState("");
  const [salvando, setSalvando] = useState(false);

  // nova família
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zonaNome, setZonaNome] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (familiaOrigemId == null) return;
    setBuscando(true);
    try {
      const p = new URLSearchParams({ excluir: String(familiaOrigemId) });
      if (termo.trim()) p.set("q", termo.trim());
      if (origemCoordenadas) {
        p.set("lat", String(origemCoordenadas.lat));
        p.set("lng", String(origemCoordenadas.lng));
        if (somenteVizinhas) p.set("raio", "150");
      }
      const res = await api.get<{ familias: FamiliaOpcao[] }>(`/familias/buscar/?${p}`);
      setOpcoes(res.data.familias ?? []);
    } catch {
      setOpcoes([]);
    } finally {
      setBuscando(false);
    }
  }, [familiaOrigemId, termo, somenteVizinhas, origemCoordenadas]);

  useEffect(() => {
    if (!open || modo !== "existente") return;
    // Espera a digitação parar antes de consultar.
    const t = setTimeout(() => void carregar(), 350);
    return () => clearTimeout(t);
  }, [open, modo, carregar]);

  if (!cidadao || familiaOrigemId == null) return null;

  const coordOk =
    lat.trim() !== "" && lng.trim() !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));

  const transferir = async () => {
    if (modo === "existente" && destinoId === "") {
      showToast("Escolha a família de destino.", "error");
      return;
    }
    if (modo === "nova" && !nome.trim()) {
      showToast("Informe o nome da nova família.", "error");
      return;
    }
    setSalvando(true);
    try {
      const corpo =
        modo === "existente"
          ? { familia_destino: destinoId, ...(parentesco.trim() ? { parentesco: parentesco.trim() } : {}) }
          : {
              nova_familia: {
                nome: nome.trim(),
                endereco: endereco.trim(),
                ...(coordOk ? { coordenadas: { lat: Number(lat), lng: Number(lng) } } : {}),
              },
            };

      const res = await api.post<{ destino: { id: number; nome: string; zona_nome: string | null } }>(
        `/familias/${familiaOrigemId}/cidadaos/${cidadao.id}/transferir/`,
        corpo,
      );
      const destino = res.data.destino;
      showToast(
        modo === "nova"
          ? `${cidadao.nome} agora forma a ${destino.nome}.`
          : `${cidadao.nome} transferido para ${destino.nome}.`,
      );
      onDone(destino.id);
      onClose();
    } catch (e) {
      showToast(mensagemErro(e, "Não foi possível transferir o cidadão."), "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6 flex items-start justify-between gap-4">
        <div>
          <Chip tone="primarySoft" className="!bg-white/15 !text-white">
            MUDANÇA DE RESIDÊNCIA
          </Chip>
          <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">
            {cidadao.nome}
          </h2>
          <p className="text-white/70 text-xs mt-1">
            Mover para outra família ou separar numa nova.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
          <Icon name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo("existente")}
            className={`p-4 rounded-lg text-left transition-all ${
              modo === "existente"
                ? "bg-secondary text-white shadow-ambient-sm"
                : "bg-surface-container-low hover:bg-surface-container"
            }`}
          >
            <Icon name="swap_horiz" className="text-[20px]" />
            <p className="text-[12px] font-bold mt-1.5">Família existente</p>
            <p className={`text-[10px] mt-0.5 ${modo === "existente" ? "text-white/70" : "text-on-surface-variant"}`}>
              Mudou-se para outra casa já cadastrada
            </p>
          </button>
          <button
            type="button"
            onClick={() => setModo("nova")}
            className={`p-4 rounded-lg text-left transition-all ${
              modo === "nova"
                ? "bg-secondary text-white shadow-ambient-sm"
                : "bg-surface-container-low hover:bg-surface-container"
            }`}
          >
            <Icon name="call_split" className="text-[20px]" />
            <p className="text-[12px] font-bold mt-1.5">Nova família</p>
            <p className={`text-[10px] mt-0.5 ${modo === "nova" ? "text-white/70" : "text-on-surface-variant"}`}>
              Saiu e constituiu residência própria
            </p>
          </button>
        </div>

        {modo === "existente" ? (
          <>
            <div className="space-y-2">
              <MetaTag className="block">BUSCAR FAMÍLIA DE DESTINO *</MetaTag>
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Nome da família, endereço, morador ou CPF"
                className={CAMPO}
              />
              {origemCoordenadas && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={somenteVizinhas}
                    onChange={(e) => setSomenteVizinhas(e.target.checked)}
                    className="w-4 h-4 accent-teal-700"
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    Só famílias a até 150 m — mesmo prédio ou rua
                  </span>
                </label>
              )}
            </div>

            {buscando ? (
              <p className="text-[12px] text-on-surface-variant flex items-center gap-2">
                <Icon name="progress_activity" className="text-[16px] animate-spin" /> Buscando…
              </p>
            ) : opcoes.length === 0 ? (
              <p className="text-[12px] text-on-surface-variant italic">
                {termo || somenteVizinhas
                  ? "Nenhuma família encontrada com esse filtro."
                  : "Não há outra família cadastrada. Use a opção \u0022Nova família\u0022."}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {opcoes.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDestinoId(f.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left ${
                      destinoId === f.id
                        ? "bg-secondary/12 ring-2 ring-secondary"
                        : "bg-surface-container-low hover:bg-secondary/8"
                    }`}
                  >
                    <Icon name="home" className="text-secondary text-[16px] mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-primary truncate">{f.nome}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">
                        {f.endereco || "sem endereço"}
                        {f.responsavel ? ` · ${f.responsavel}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Chip tone={f.distancia_m === 0 ? "secondary" : "neutral"}>
                        {distanciaLegivel(f.distancia_m) ?? f.zona_nome ?? "SEM ZONA"}
                      </Chip>
                      <span className="text-[10px] font-mono text-slate-400">
                        {f.total_cidadaos} morador(es)
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div>
              <MetaTag className="block mb-1.5">PARENTESCO NA NOVA FAMÍLIA</MetaTag>
              <input
                value={parentesco}
                onChange={(e) => setParentesco(e.target.value)}
                placeholder={`Hoje: ${cidadao.parentesco || "não informado"}`}
                className={CAMPO}
              />
              <p className="text-[10px] text-on-surface-variant mt-1">
                O parentesco descreve o papel dentro da residência, então costuma
                mudar junto com ela.
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <MetaTag className="block mb-1.5">NOME DA NOVA FAMÍLIA *</MetaTag>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={`Ex.: Família ${cidadao.nome.split(" ").slice(-1)[0]}`}
                className={CAMPO}
              />
            </div>
            <AddressLocationField
              endereco={endereco}
              onEnderecoChange={setEndereco}
              lat={lat}
              lng={lng}
              onCoordChange={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
              zonaNome={zonaNome}
              onZonaChange={setZonaNome}
              height={200}
            />
            <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5">
              <Icon name="info" className="text-[14px] mt-0.5" />
              {cidadao.nome} passa a ser o responsável da nova residência.
            </p>
          </>
        )}
      </div>

      <div className="border-t border-outline-variant/20 p-5 flex items-center justify-between gap-3">
        <Btn variant="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn
          variant="success"
          icon={modo === "nova" ? "call_split" : "swap_horiz"}
          onClick={transferir}
          disabled={salvando}
        >
          {salvando ? "Transferindo…" : modo === "nova" ? "Separar" : "Transferir"}
        </Btn>
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DESLIGAR CIDADÃO — soft delete com motivo
   ══════════════════════════════════════════════════════════════════════ */

const MOTIVOS = [
  { valor: "obito", label: "Óbito", icone: "sentiment_very_dissatisfied" },
  { valor: "mudanca", label: "Mudou de cidade", icone: "luggage" },
  { valor: "transferencia", label: "Transferido para outra família", icone: "swap_horiz" },
  { valor: "nao_localizado", label: "Não localizado", icone: "person_search" },
  { valor: "outro", label: "Outro", icone: "more_horiz" },
];

export function DesligarCidadaoModal({
  open,
  cidadao,
  familiaId,
  onClose,
  onDone,
}: {
  open: boolean;
  cidadao: { id: number; nome: string } | null;
  familiaId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useGardian();
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!cidadao || familiaId == null) return null;

  const confirmar = async () => {
    if (!motivo) {
      showToast("Selecione o motivo do desligamento.", "error");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/familias/${familiaId}/cidadaos/${cidadao.id}/desligar/`, {
        motivo,
        data: data || null,
        observacao: observacao.trim(),
      });
      showToast(`${cidadao.nome} foi desligado do cadastro.`);
      onDone();
      onClose();
    } catch (e) {
      showToast(mensagemErro(e, "Não foi possível desligar o cidadão."), "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6 flex items-start justify-between gap-4">
        <div>
          <Chip tone="primarySoft" className="!bg-white/15 !text-white">
            DESLIGAMENTO
          </Chip>
          <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">
            {cidadao.nome}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white">
          <Icon name="close" className="text-[22px]" />
        </button>
      </div>

      <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="card-recessed p-4 flex items-start gap-3">
          <Icon name="history" className="text-secondary text-[18px] mt-0.5" />
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            O registro <strong>não é apagado</strong>. O cidadão continua vinculado à
            família como inativo, preservando o histórico — as ocorrências que ele
            abriu e quem morava na casa em cada evento.
          </p>
        </div>

        <div>
          <MetaTag className="block mb-2">MOTIVO *</MetaTag>
          <div className="space-y-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMotivo(m.valor)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${
                  motivo === m.valor
                    ? "bg-secondary/12 ring-2 ring-secondary"
                    : "bg-surface-container-low hover:bg-secondary/8"
                }`}
              >
                <Icon name={m.icone} className="text-secondary text-[18px]" />
                <span className="text-[12px] font-bold text-primary">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <MetaTag className="block mb-1.5">DATA</MetaTag>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={CAMPO}
          />
        </div>

        <div>
          <MetaTag className="block mb-1.5">
            OBSERVAÇÃO {motivo === "outro" && "*"}
          </MetaTag>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Detalhe do motivo, se necessário"
            className={`${CAMPO} resize-none`}
          />
        </div>
      </div>

      <div className="border-t border-outline-variant/20 p-5 flex items-center justify-between gap-3">
        <Btn variant="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn variant="danger" icon="person_off" onClick={confirmar} disabled={salvando}>
          {salvando ? "Desligando…" : "Confirmar desligamento"}
        </Btn>
      </div>
    </ModalShell>
  );
}