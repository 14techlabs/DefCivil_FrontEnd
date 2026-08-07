// DefCivil_FrontEnd/app/components/CreateFamilyModal.tsx
"use client";

import { useState } from "react";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { AddressLocationField } from "@/app/components/AddressLocationField";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

/* ───────────── tipos ───────────── */

interface CreateFamilyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (familiaId: number) => void;
}

type CidadaoForm = {
  nome: string;
  cpf: string;
  nascimento: string;
  parentesco: string;
  responsavel: boolean;
};

type AnimalForm = {
  nome: string;
  especie: string;
  porte: "pequeno" | "medio" | "grande";
  quantidade: string;
};

const CIDADAO_VAZIO: CidadaoForm = {
  nome: "",
  cpf: "",
  nascimento: "",
  parentesco: "Responsável",
  responsavel: true,
};

const ANIMAL_VAZIO: AnimalForm = { nome: "", especie: "", porte: "medio", quantidade: "1" };

const CAMPO =
  "w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none";

/* ── CPF: validação idêntica à do backend, para avisar antes de enviar ── */

function limparCpf(v: string) {
  return v.replace(/\D/g, "");
}

function mascaraCpf(v: string) {
  const d = limparCpf(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function cpfValido(v: string) {
  const cpf = limparCpf(v);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}

/* ───────────── componente ───────────── */

export function CreateFamilyModal({ open, onClose, onCreated }: CreateFamilyModalProps) {
  const { showToast } = useGardian();

  const [step, setStep] = useState(0);
  const [salvando, setSalvando] = useState(false);

  // passo 0 — dados da residência
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [areaDeRisco, setAreaDeRisco] = useState(false);
  const [zonaNome, setZonaNome] = useState<string | null>(null);
  // O CoordsPickerMap trabalha com strings; convertemos ao enviar.
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // passo 1 — cidadãos (mínimo 1) e animais
  const [cidadaos, setCidadaos] = useState<CidadaoForm[]>([{ ...CIDADAO_VAZIO }]);
  const [animais, setAnimais] = useState<AnimalForm[]>([]);

  /**
   * Limpa e fecha. Fazer o reset aqui, e não num efeito disparado por `open`,
   * evita setState síncrono durante o render — e garante que o formulário
   * nunca reabra com dados da tentativa anterior.
   */
  const fechar = () => {
    setStep(0);
    setNome("");
    setEndereco("");
    setTelefone("");
    setAreaDeRisco(false);
    setLat("");
    setLng("");
    setZonaNome(null);
    setCidadaos([{ ...CIDADAO_VAZIO }]);
    setAnimais([]);
    setSalvando(false);
    onClose();
  };

  const atualizarCidadao = (i: number, campo: keyof CidadaoForm, valor: string | boolean) =>
    setCidadaos((lista) =>
      lista.map((c, idx) => {
        if (idx !== i) {
          // só um responsável por residência
          return campo === "responsavel" && valor === true ? { ...c, responsavel: false } : c;
        }
        return { ...c, [campo]: valor };
      }),
    );

  const atualizarAnimal = (i: number, campo: keyof AnimalForm, valor: string) =>
    setAnimais((lista) => lista.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));

  const coordOk = lat.trim() !== "" && lng.trim() !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const podeAvancar = nome.trim().length > 0 && coordOk;

  const validarCidadaos = () => {
    if (cidadaos.length === 0) return "Cadastre ao menos um cidadão.";
    for (const [i, c] of cidadaos.entries()) {
      if (!c.nome.trim()) return `Informe o nome do ${i + 1}º cidadão.`;
      if (!c.cpf.trim()) return `Informe o CPF de ${c.nome.trim()}.`;
      if (!cpfValido(c.cpf)) return `O CPF de ${c.nome.trim()} é inválido.`;
    }
    const cpfs = cidadaos.map((c) => limparCpf(c.cpf));
    const repetido = cpfs.find((c, i) => cpfs.indexOf(c) !== i);
    if (repetido) return `O CPF ${mascaraCpf(repetido)} está repetido nesta família.`;
    for (const a of animais) {
      if (!a.especie.trim()) return "Informe a espécie de todos os animais.";
    }
    return null;
  };

  const salvar = async () => {
    const problema = validarCidadaos();
    if (problema) {
      showToast(problema, "error");
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post<{ familia: { id: number; zona_nome: string | null } }>(
        "/familias/",
        {
          nome: nome.trim(),
          endereco: endereco.trim(),
          telefone: telefone.trim(),
          area_de_risco: areaDeRisco,
          coordenadas: { lat: Number(lat), lng: Number(lng) },
          cidadaos: cidadaos.map((c) => ({
            nome: c.nome.trim(),
            cpf: limparCpf(c.cpf),
            data_nascimento: c.nascimento || null,
            parentesco: c.parentesco.trim(),
            responsavel: c.responsavel,
          })),
          animais: animais.map((a) => ({
            nome: a.nome.trim(),
            especie: a.especie.trim(),
            porte: a.porte,
            quantidade: Number(a.quantidade) || 1,
          })),
        },
      );
      const criada = res.data.familia;
      showToast(
        criada.zona_nome
          ? `Família cadastrada na zona ${criada.zona_nome}.`
          : "Família cadastrada. A coordenada não caiu em nenhuma zona.",
      );
      onCreated(criada.id);
      fechar();
    } catch (e) {
      // O backend detalha CPF inválido/duplicado dizendo em qual família está.
      const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let msg = "Não foi possível cadastrar a família.";
      if (typeof data?.error === "string") msg = data.error;
      else if (Array.isArray(data?.cidadaos)) {
        const primeiro = (data.cidadaos as Record<string, string[]>[]).find(
          (x) => x && Object.keys(x).length,
        );
        const campo = primeiro && Object.values(primeiro)[0];
        if (Array.isArray(campo) && campo.length) msg = String(campo[0]);
      }
      showToast(msg, "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell open={open} onClose={fechar} maxWidth="max-w-3xl">
      <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Chip tone="primarySoft" className="!bg-white/15 !text-white">
              PASSO {step + 1} DE 2
            </Chip>
            <h2 className="font-headline font-black text-2xl tracking-tighter mt-2">
              {step === 0 ? "Nova família" : "Quem mora na residência"}
            </h2>
            <p className="text-white/70 text-xs mt-1">
              {step === 0
                ? "A zona é identificada pela coordenada da residência."
                : "Uma família tem ao menos um cidadão. O CPF é obrigatório."}
            </p>
          </div>
          <button type="button" onClick={fechar} className="text-white/70 hover:text-white">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5">
        {step === 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <MetaTag className="block mb-1.5">NOME DA FAMÍLIA *</MetaTag>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Família Santos"
                  className={CAMPO}
                />
              </div>
              <div className="sm:col-span-2">
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
          </>
        ) : (
          <>
            {/* Cidadãos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <MetaTag>CIDADÃOS ({cidadaos.length})</MetaTag>
                <Btn
                  variant="ghost"
                  icon="person_add"
                  onClick={() =>
                    setCidadaos((l) => [
                      ...l,
                      { ...CIDADAO_VAZIO, parentesco: "", responsavel: false },
                    ])
                  }
                >
                  Adicionar
                </Btn>
              </div>

              {cidadaos.map((c, i) => (
                <div key={i} className="card-recessed p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <MetaTag className="text-secondary">CIDADÃO {i + 1}</MetaTag>
                    {cidadaos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCidadaos((l) => l.filter((_, idx) => idx !== i))}
                        className="text-on-surface-variant hover:text-error"
                        aria-label={`Remover cidadão ${i + 1}`}
                      >
                        <Icon name="close" className="text-[16px]" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <MetaTag className="block mb-1.5">NOME *</MetaTag>
                      <input
                        value={c.nome}
                        onChange={(e) => atualizarCidadao(i, "nome", e.target.value)}
                        placeholder="Nome completo"
                        className={CAMPO}
                      />
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">CPF *</MetaTag>
                      <input
                        value={c.cpf}
                        onChange={(e) => atualizarCidadao(i, "cpf", mascaraCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className={`${CAMPO} ${
                          c.cpf && !cpfValido(c.cpf) ? "ring-2 ring-error" : ""
                        }`}
                      />
                      {c.cpf.length === 14 && !cpfValido(c.cpf) && (
                        <p className="text-[10px] text-error mt-1">CPF inválido.</p>
                      )}
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">NASCIMENTO</MetaTag>
                      <input
                        type="date"
                        value={c.nascimento}
                        onChange={(e) => atualizarCidadao(i, "nascimento", e.target.value)}
                        className={CAMPO}
                      />
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">PARENTESCO</MetaTag>
                      <input
                        value={c.parentesco}
                        onChange={(e) => atualizarCidadao(i, "parentesco", e.target.value)}
                        placeholder="Filho(a), Cônjuge…"
                        className={CAMPO}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={c.responsavel}
                      onChange={(e) => atualizarCidadao(i, "responsavel", e.target.checked)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    <span className="text-[11px] text-on-surface-variant">
                      Responsável pela residência
                    </span>
                  </label>
                </div>
              ))}
            </div>

            {/* Animais */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <MetaTag>ANIMAIS ({animais.length})</MetaTag>
                <Btn
                  variant="ghost"
                  icon="pets"
                  onClick={() => setAnimais((l) => [...l, { ...ANIMAL_VAZIO }])}
                >
                  Adicionar
                </Btn>
              </div>

              {animais.length === 0 && (
                <p className="text-[11px] text-on-surface-variant italic">
                  Nenhum animal. O porte é usado para dimensionar abrigo na evacuação.
                </p>
              )}

              {animais.map((a, i) => (
                <div key={i} className="card-recessed p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <MetaTag className="text-secondary">ANIMAL {i + 1}</MetaTag>
                    <button
                      type="button"
                      onClick={() => setAnimais((l) => l.filter((_, idx) => idx !== i))}
                      className="text-on-surface-variant hover:text-error"
                      aria-label={`Remover animal ${i + 1}`}
                    >
                      <Icon name="close" className="text-[16px]" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <MetaTag className="block mb-1.5">NOME</MetaTag>
                      <input
                        value={a.nome}
                        onChange={(e) => atualizarAnimal(i, "nome", e.target.value)}
                        placeholder="Opcional em animal de criação"
                        className={CAMPO}
                      />
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">ESPÉCIE *</MetaTag>
                      <input
                        value={a.especie}
                        onChange={(e) => atualizarAnimal(i, "especie", e.target.value)}
                        placeholder="Cão, Gato, Ave…"
                        className={CAMPO}
                      />
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">PORTE</MetaTag>
                      <select
                        value={a.porte}
                        onChange={(e) => atualizarAnimal(i, "porte", e.target.value)}
                        className={CAMPO}
                      >
                        <option value="pequeno">Pequeno</option>
                        <option value="medio">Médio</option>
                        <option value="grande">Grande</option>
                      </select>
                    </div>
                    <div>
                      <MetaTag className="block mb-1.5">QUANTIDADE</MetaTag>
                      <input
                        type="number"
                        min={1}
                        value={a.quantidade}
                        onChange={(e) => atualizarAnimal(i, "quantidade", e.target.value)}
                        className={CAMPO}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-outline-variant/20 p-5 flex items-center justify-between gap-3">
        {step === 0 ? (
          <>
            <Btn variant="ghost" onClick={fechar}>
              Cancelar
            </Btn>
            <Btn
              variant="primary"
              icon="arrow_forward"
              onClick={() => setStep(1)}
              disabled={!podeAvancar}
            >
              {podeAvancar ? "Continuar" : "Informe nome e localização"}
            </Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" icon="arrow_back" onClick={() => setStep(0)}>
              Voltar
            </Btn>
            <Btn variant="success" icon="check" onClick={salvar} disabled={salvando}>
              {salvando ? "Cadastrando…" : "Cadastrar família"}
            </Btn>
          </>
        )}
      </div>
    </ModalShell>
  );
}