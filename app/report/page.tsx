"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import {
  MOCK_ENTIDADE,
  MOCK_FORM_CONFIG,
  STATUS_CIDADE_META,
} from "@/app/data/mock";
import { api } from "@/app/services/Api";

// mapa de seleção de local publico (sem login)
const PublicMapPicker = dynamic(
  () => import("@/app/components/PublicMapPicker").then((m) => m.PublicMapPicker),
  { ssr: false },
);

interface EventoPublico {
  entidade: string;
  nome: string;
  resumoPublico: string;
  recomendacoes: string[];
}

function mensagemApi(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data;
  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    const mensagem = payload.error ?? payload.detail ?? payload.message;

    if (typeof mensagem === "string" && mensagem.trim()) return mensagem;

    for (const valor of Object.values(payload)) {
      if (typeof valor === "string" && valor.trim()) return valor;
      if (Array.isArray(valor)) {
        const textos = valor.filter((item): item is string => typeof item === "string");
        if (textos.length > 0) return textos.join(" ");
      }
    }
  }

  if (!error.response) {
    return "Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.";
  }

  if (error.response.status >= 500) {
    return "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.";
  }

  return fallback;
}

/* máscaras: aceitam apenas dígitos e formatam enquanto digita */
function mascararCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mascararTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* configuração vinda da tela de Entidade */
const CONFIG = MOCK_FORM_CONFIG;
const CHECKLIST = CONFIG.checklist.filter((c) => c.ativo);
const CATEGORIAS = CONFIG.categorias.filter((c) => c.ativo);

export default function PublicReportPage() {
  const [eventosAtivos, setEventosAtivos] = useState<EventoPublico[]>([]);

  // resumo público do evento ativo (feito pelo técnico)
  useEffect(() => {
    let cancelled = false;
    api
      .get<{
        eventos: {
          entidade_id: number;
          entidade: string;
          evento: {
            nome: string;
            resumo_publico: string | null;
            recomendacoes: string[] | null;
          };
        }[];
      }>("/eventos/publico/ativo/")
      .then((res) => {
        if (cancelled) return;
        setEventosAtivos(
          (res.data.eventos ?? []).map((item) => ({
            entidade: item.entidade,
            nome: item.evento.nome,
            resumoPublico: item.evento.resumo_publico ?? "",
            recomendacoes: item.evento.recomendacoes ?? [],
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setEventosAtivos([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [categoria, setCategoria] = useState(CATEGORIAS[0]?.id ?? "climatico");
  const [descricao, setDescricao] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [modoLocal, setModoLocal] = useState<"endereco" | "coordenada">("endereco");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [contato, setContato] = useState("");
  const [cpf, setCpf] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; tamanho: string }[]>([]);
  const [geoStatus, setGeoStatus] = useState<"idle" | "carregando" | "ok" | "erro">("idle");
  const [geoBuscando, setGeoBuscando] = useState(false);
  const [geoAviso, setGeoAviso] = useState("");
  const [enderecoAviso, setEnderecoAviso] = useState("");
  const [localEntidade, setLocalEntidade] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");

  const pegarLocalizacao = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("erro");
      setGeoAviso("Seu navegador não suporta geolocalização. Marque o local no mapa.");
      return;
    }
    setGeoStatus("carregando");
    setGeoAviso("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setModoLocal("coordenada");
        setGeoStatus("ok");
      },
      (err) => {
        setGeoStatus("erro");
        const msgs: Record<number, string> = {
          1: "Acesso à localização negado. Permita no navegador e tente de novo, ou marque o ponto no mapa.",
          2: "Localização indisponível no momento. Marque o ponto no mapa.",
          3: "Tempo esgotado. Tente novamente ou marque o ponto no mapa.",
        };
        setGeoAviso(
          msgs[err.code] ?? "Não foi possível obter a localização. Marque o ponto no mapa.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const buscarEndereco = async () => {
    const termo = endereco.trim();
    if (termo.length < 4) {
      setEnderecoAviso("Informe um endereço com pelo menos 4 caracteres.");
      return;
    }
    setGeoBuscando(true);
    setEnderecoAviso("");
    try {
      const res = await api.get<{
        candidatos: { lat: number; lng: number; entidade?: string }[];
        aviso?: string;
      }>("/api/geocodificar/", { params: { endereco: termo } });
      const primeiro = res.data.candidatos?.[0];
      if (primeiro) {
        setLat(String(primeiro.lat));
        setLng(String(primeiro.lng));
        setModoLocal("coordenada");
        setGeoStatus("ok");
        setLocalEntidade(primeiro.entidade ?? "");
      } else {
        setLocalEntidade("");
        setEnderecoAviso(
          res.data.aviso ?? "Nenhum endereço encontrado. Marque o ponto no mapa.",
        );
      }
    } catch (error) {
      setEnderecoAviso(
        mensagemApi(error, "Não foi possível localizar o endereço. Marque o ponto no mapa."),
      );
    } finally {
      setGeoBuscando(false);
    }
  };

  const enviar = async () => {
    if (descricao.trim().length < CONFIG.minCaracteresDescricao) {
      setErro(
        `Descreva o que está acontecendo com pelo menos ${CONFIG.minCaracteresDescricao} caracteres.`,
      );
      return;
    }
    if (CONFIG.exigirContato && contato.replace(/\D/g, "").length < 10) {
      setErro("Informe um telefone válido (com DDD) para prosseguir.");
      return;
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      setErro("Informe um CPF válido (11 dígitos) para prosseguir.");
      return;
    }
    if (CONFIG.exigirLocalizacao && (!lat.trim() || !lng.trim())) {
      setErro("Marque o local no mapa ou use sua localização atual.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const res = await api.post<{ protocolo: string }>("/ocorrencias/publicas/", {
        descricao: descricao.trim(),
        categoria,
        cpf: cpf.replace(/\D/g, ""),
        contato: contato.replace(/\D/g, ""),
        endereco: endereco.trim(),
        coordenadas: { lat: parseFloat(lat), lng: parseFloat(lng) },
      });
      setProtocolo(res.data.protocolo);
      setEnviado(true);
    } catch (error) {
      setErro(
        mensagemApi(error, "Não foi possível enviar o registro. Confira os dados e tente novamente."),
      );
    } finally {
      setEnviando(false);
    }
  };

  /* ───────── confirmação ───────── */
  /* ───────── canal desativado pela entidade ───────── */
  if (!CONFIG.ativo) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="card-tonal p-10 shadow-ambient max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mx-auto mb-5">
            <Icon name="pause_circle" filled className="text-on-surface-variant text-[32px]" />
          </div>
          <h1 className="font-headline font-black text-3xl tracking-tighter text-primary">
            Canal indisponível
          </h1>
          <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
            {CONFIG.mensagemDesativado}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-6">
            {MOCK_ENTIDADE.sigla} · {MOCK_ENTIDADE.telefone}
          </p>
        </div>
      </main>
    );
  }

  if (enviado) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="card-tonal p-10 shadow-ambient max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-5">
            <Icon name="check_circle" filled className="text-secondary text-[32px]" />
          </div>
          <h1 className="font-headline font-black text-3xl tracking-tighter text-primary">
            Registro enviado
          </h1>
          <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
            Sua ocorrência foi encaminhada à Defesa Civil e será analisada pela equipe.
            {eventosAtivos.length > 0 ? " Ela foi vinculada automaticamente ao evento em andamento." : ""}
          </p>
          <div className="card-recessed p-5 mt-6">
            <MetaTag className="block mb-1">PROTOCOLO</MetaTag>
            <p className="font-headline font-black text-2xl text-primary tracking-tighter">{protocolo}</p>
          </div>
          <p className="text-[12px] text-on-surface-variant mt-5">
            Em caso de risco imediato à vida, ligue <strong className="text-error">199</strong> (Defesa Civil) ou{" "}
            <strong className="text-error">193</strong> (Bombeiros).
          </p>
          <div className="mt-6">
            <Btn
              variant="ghost"
              icon="add"
              onClick={() => {
                setEnviado(false);
                setDescricao("");
                setChecks({});
                setEndereco("");
                setLat("");
                setLng("");
                setContato("");
                setCpf("");
                setAnexos([]);
                setGeoStatus("idle");
                setGeoAviso("");
                setEnderecoAviso("");
                setGeoBuscando(false);
              }}
            >
              Registrar outra ocorrência
            </Btn>
          </div>
        </div>
      </main>
    );
  }

  /* ───────── formulário ───────── */
  return (
    <main className="min-h-screen bg-surface">
      {/* topo */}
      <header className="bg-gradient-to-br from-primary to-primary-container text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Icon name="shield" filled className="text-white text-[22px]" />
            </div>
            <div>
              <p className="font-headline font-black text-xl leading-tight tracking-tight">GARDIAN</p>
              <p className="text-[10px] font-bold tracking-mono text-white/60 uppercase">
                Defesa Civil · Porto Seguro/BA
              </p>
            </div>
          </div>
          <h1 className="font-headline font-black text-4xl tracking-tighter leading-tight">
            {CONFIG.titulo}
          </h1>
          <p className="text-white/75 text-sm mt-3 max-w-xl leading-relaxed">{CONFIG.subtitulo}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* situação do município, definida na tela de Entidade */}
        <section
          className="rounded-xl p-6 text-white"
          style={{ background: STATUS_CIDADE_META[MOCK_ENTIDADE.statusCidade].cor }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon
              name={STATUS_CIDADE_META[MOCK_ENTIDADE.statusCidade].icon}
              filled
              className="text-[20px]"
            />
            <span className="text-[11px] font-black uppercase tracking-mono">
              {MOCK_ENTIDADE.municipio} · Município{" "}
              {STATUS_CIDADE_META[MOCK_ENTIDADE.statusCidade].label}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-white/90">{MOCK_ENTIDADE.mensagemPublica}</p>
        </section>

        {/* avisos dos eventos ativos (resumo público + recomendações) */}
        {CONFIG.mostrarAvisoEvento &&
          eventosAtivos.map((ev) => (
            <section key={ev.entidade + ev.nome} className="card-tonal p-6 shadow-ambient-sm border-l-4 border-error">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="campaign" filled className="text-error text-[20px]" />
                <MetaTag className="text-error">AVISO EM ANDAMENTO · {ev.entidade.toUpperCase()} · {ev.nome.toUpperCase()}</MetaTag>
              </div>
              <p className="text-[13px] text-on-surface leading-relaxed">{ev.resumoPublico}</p>
              <div className="mt-4 space-y-2">
                {ev.recomendacoes.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon name="verified_user" filled className="text-secondary text-[16px] mt-0.5 shrink-0" />
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

        {/* tipo */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">1. O que está acontecendo?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex min-h-32 flex-col items-center justify-center gap-2 p-4 rounded-lg transition-all ${
                  categoria === c.id
                    ? "bg-primary text-white shadow-ambient-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="flex flex-col items-center justify-center gap-2">
                  <Icon name={c.icon} filled={categoria === c.id} className="text-[24px] leading-none" />
                  <span className="text-sm font-bold text-center leading-snug">
                    {c.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* descrição */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">2. Descreva a situação</h2>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={5}
            placeholder="Ex.: a água começou a entrar no quintal por volta das 6h e já está na altura do joelho na rua..."
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-base font-medium text-on-surface focus:ring-2 focus:ring-secondary outline-none resize-none placeholder:text-[14px] placeholder:text-on-surface-variant/75"
          />
          <p className="mt-2 text-xs font-medium text-on-surface-variant">{descricao.length} caracteres</p>
        </section>

        {/* checklist */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-1 text-sm font-bold text-primary">3. Marque o que se aplica</h2>
          <p className="mb-4 text-sm text-on-surface-variant">
            Isso ajuda a equipe a definir a prioridade do atendimento.
          </p>
          <div className="space-y-2">
            {CHECKLIST.map((c) => {
              const on = !!checks[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChecks((v) => ({ ...v, [c.id]: !v[c.id] }))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-lg text-left transition-all ${
                    on ? "bg-secondary/10 ring-1 ring-secondary/40" : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <Icon
                    name={on ? "check_box" : "check_box_outline_blank"}
                    className={`text-[20px] shrink-0 ${on ? "text-secondary" : "text-on-surface-variant"}`}
                  />
                  <Icon name={c.icon} className={`text-[18px] shrink-0 ${on ? "text-secondary" : "text-on-surface-variant"}`} />
                  <span className={`text-sm font-medium ${on ? "text-primary font-bold" : "text-on-surface"}`}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* localização */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">4. Onde é?</h2>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setModoLocal("endereco")}
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                modoLocal === "endereco" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              Endereço
            </button>
            <button
              type="button"
              onClick={() => setModoLocal("coordenada")}
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                modoLocal === "coordenada" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              Coordenadas
            </button>
            <Btn variant="secondary" icon="my_location" onClick={pegarLocalizacao}>
              {geoStatus === "carregando" ? "Localizando…" : "Usar minha localização"}
            </Btn>
          </div>

          {geoStatus === "ok" && (
            <Chip tone="secondary" icon="check" className="mb-3">
              LOCALIZAÇÃO CAPTURADA
            </Chip>
          )}
          {geoStatus === "erro" && (
            <>
              <Chip tone="error" icon="error" className="mb-1">
                {geoAviso || "NÃO FOI POSSÍVEL OBTER A LOCALIZAÇÃO — PREENCHA MANUALMENTE"}
              </Chip>
              <p className="text-[10px] text-on-surface-variant mb-3">
                Dica: a geolocalização precisa de HTTPS (ou localhost). Você também pode marcar
                o ponto no mapa.
              </p>
            </>
          )}

          {modoLocal === "endereco" ? (
            <div className="space-y-2">
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro e ponto de referência"
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Btn variant="secondary" icon="search" onClick={buscarEndereco}>
                  {geoBuscando ? "Buscando…" : "Localizar no mapa"}
                </Btn>
                {enderecoAviso && (
                  <span className="text-[11px] text-error font-bold">{enderecoAviso}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MetaTag className="block mb-1.5">LATITUDE</MetaTag>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-16.440000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px]"
                />
              </div>
              <div>
                <MetaTag className="block mb-1.5">LONGITUDE</MetaTag>
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-39.070000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px]"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <PublicMapPicker
              lat={lat}
              lng={lng}
              height={260}
              onChange={(la, ln) => {
                setLat(la);
                setLng(ln);
                setModoLocal("coordenada");
                setGeoStatus("ok");
              }}
            />
            <p className="text-[11px] text-on-surface-variant mt-2">
              Arraste o marcador até o local exato do ocorrido.
            </p>
            {localEntidade && (
              <p className="text-[11px] text-secondary font-bold mt-1">
                Localização em {localEntidade}
              </p>
            )}
          </div>
        </section>

        {/* anexos */}
        {CONFIG.permitirAnexos && (
          <section className="card-tonal p-6 shadow-ambient-sm">
            <h2 className="mb-1 text-sm font-bold text-primary">Fotos e vídeos (opcional)</h2>
            <p className="mb-3 text-sm text-on-surface-variant">
              Imagens ajudam a equipe a dimensionar a situação antes de chegar ao local.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg bg-surface-container-low border-2 border-dashed border-outline-variant/40 cursor-pointer hover:bg-surface-container transition-all">
              <Icon name="add_a_photo" className="text-secondary text-[24px]" />
              <span className="text-[12px] font-bold text-primary">Clique para anexar</span>
              <span className="text-[10px] text-on-surface-variant">JPG, PNG ou MP4</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const arquivos = Array.from(e.target.files ?? []).map((f) => ({
                    nome: f.name,
                    tamanho:
                      f.size > 1024 * 1024
                        ? `${(f.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
                        : `${Math.max(1, Math.round(f.size / 1024))} KB`,
                  }));
                  setAnexos((prev) => [...prev, ...arquivos]);
                }}
              />
            </label>

            {anexos.length > 0 && (
              <div className="space-y-2 mt-3">
                {anexos.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
                  >
                    <Icon name="image" className="text-secondary text-[18px]" />
                    <span className="font-bold text-primary flex-1 truncate">{a.nome}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">{a.tamanho}</span>
                    <button
                      type="button"
                      onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-md hover:bg-surface-container"
                      aria-label="Remover anexo"
                    >
                      <Icon name="close" className="text-on-surface-variant text-[16px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* contato */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-1 text-sm font-bold text-primary">
            5. Contato {CONFIG.exigirContato ? "(obrigatório)" : "(opcional)"}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">
            {CONFIG.exigirContato
              ? "Informe um telefone para que a equipe possa confirmar os detalhes do registro."
              : "O CPF é obrigatório para identificar o registro. O telefone é opcional e permite que a equipe entre em contato."}
          </p>
          <label htmlFor="report-cpf" className="mb-1.5 block text-sm font-semibold text-primary">
            CPF (obrigatório)
          </label>
          <input
            id="report-cpf"
            value={cpf}
            onChange={(e) => setCpf(mascararCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50 mb-4"
          />

          <label htmlFor="report-telefone" className="mb-1.5 block text-sm font-semibold text-primary">
            Telefone {CONFIG.exigirContato ? "(obrigatório)" : "(opcional)"}
          </label>
          <input
            id="report-telefone"
            value={contato}
            onChange={(e) => setContato(mascararTelefone(e.target.value))}
            placeholder="(73) 90000-0000"
            type="tel"
            inputMode="tel"
            maxLength={14}
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50"
          />
        </section>

        {erro && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2 p-4 rounded-lg bg-error-container text-on-error-container"
          >
            <Icon name="error" filled className="text-[18px]" />
            <span className="text-[13px] font-bold">{erro}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pb-12">
          <Btn variant="primary" icon="send" full onClick={enviar}>
            {enviando ? "Enviando…" : "Enviar registro"}
          </Btn>
        </div>

        <p className="text-[13px] text-on-surface-variant text-center -mt-8 pb-8">
          Emergência com risco à vida: ligue {CONFIG.telefonesEmergencia}.
        </p>
      </div>
    </main>
  );
}
