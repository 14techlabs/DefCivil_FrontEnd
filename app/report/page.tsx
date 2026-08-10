"use client";

import { useEffect, useState } from "react";
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
  nome: string;
  resumoPublico: string;
  recomendacoes: string[];
}

/* configuração vinda da tela de Entidade */
const CONFIG = MOCK_FORM_CONFIG;
const CHECKLIST = CONFIG.checklist.filter((c) => c.ativo);
const CATEGORIAS = CONFIG.categorias.filter((c) => c.ativo);

export default function PublicReportPage() {
  const [eventoAtivo, setEventoAtivo] = useState<EventoPublico | null>(null);

  // resumo público do evento ativo (feito pelo técnico)
  useEffect(() => {
    let cancelled = false;
    api
      .get<{
        evento: {
          nome: string;
          resumo_publico: string | null;
          recomendacoes: string[] | null;
        };
      }>("/eventos/publico/ativo/")
      .then((res) => {
        if (cancelled) return;
        const e = res.data.evento;
        setEventoAtivo({
          nome: e.nome,
          resumoPublico: e.resumo_publico ?? "",
          recomendacoes: e.recomendacoes ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setEventoAtivo(null);
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
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");

  const pegarLocalizacao = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("erro");
      return;
    }
    setGeoStatus("carregando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setModoLocal("coordenada");
        setGeoStatus("ok");
      },
      () => setGeoStatus("erro"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const enviar = async () => {
    if (descricao.trim().length < CONFIG.minCaracteresDescricao) {
      setErro(
        `Descreva o que está acontecendo com pelo menos ${CONFIG.minCaracteresDescricao} caracteres.`,
      );
      return;
    }
    if (CONFIG.exigirContato && !contato.trim()) {
      setErro("Informe um telefone de contato para prosseguir.");
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
        contato: contato.trim(),
        coordenadas: { lat: parseFloat(lat), lng: parseFloat(lng) },
      });
      setProtocolo(res.data.protocolo);
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar o registro. Confira os dados e tente novamente.");
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
            {eventoAtivo ? " Ela foi vinculada automaticamente ao evento em andamento." : ""}
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

        {/* aviso do evento ativo (resumo público + recomendações) */}
        {CONFIG.mostrarAvisoEvento && eventoAtivo && (
          <section className="card-tonal p-6 shadow-ambient-sm border-l-4 border-error">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="campaign" filled className="text-error text-[20px]" />
              <MetaTag className="text-error">AVISO EM ANDAMENTO · {eventoAtivo.nome.toUpperCase()}</MetaTag>
            </div>
            <p className="text-[13px] text-on-surface leading-relaxed">{eventoAtivo.resumoPublico}</p>
            <div className="mt-4 space-y-2">
              {eventoAtivo.recomendacoes.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon name="verified_user" filled className="text-secondary text-[16px] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* tipo */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <MetaTag className="block mb-3">1. O QUE ESTÁ ACONTECENDO?</MetaTag>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                  categoria === c.id
                    ? "bg-primary text-white shadow-ambient-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <Icon name={c.icon} filled={categoria === c.id} className="text-[24px]" />
                <span className="text-[11px] font-bold text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* descrição */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <MetaTag className="block mb-3">2. DESCREVA A SITUAÇÃO</MetaTag>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={5}
            placeholder="Ex.: a água começou a entrar no quintal por volta das 6h e já está na altura do joelho na rua..."
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none resize-none placeholder:text-on-surface-variant/50"
          />
          <p className="text-[11px] text-on-surface-variant mt-2">{descricao.length} caracteres</p>
        </section>

        {/* checklist */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <MetaTag className="block mb-1">3. MARQUE O QUE SE APLICA</MetaTag>
          <p className="text-[11px] text-on-surface-variant mb-4">
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
                  <span className={`text-[13px] font-medium ${on ? "text-primary font-bold" : "text-on-surface"}`}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* localização */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <MetaTag className="block mb-3">4. ONDE É?</MetaTag>

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
            <Chip tone="error" icon="error" className="mb-3">
              NÃO FOI POSSÍVEL OBTER A LOCALIZAÇÃO — PREENCHA MANUALMENTE
            </Chip>
          )}

          {modoLocal === "endereco" ? (
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro e ponto de referência"
              className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-on-surface-variant/50"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MetaTag className="block mb-1.5">LATITUDE</MetaTag>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-16.440000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
                />
              </div>
              <div>
                <MetaTag className="block mb-1.5">LONGITUDE</MetaTag>
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-39.070000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none"
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
          </div>
        </section>

        {/* anexos */}
        {CONFIG.permitirAnexos && (
          <section className="card-tonal p-6 shadow-ambient-sm">
            <MetaTag className="block mb-1">FOTOS E VÍDEOS (OPCIONAL)</MetaTag>
            <p className="text-[11px] text-on-surface-variant mb-3">
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
          <MetaTag className="block mb-1">
            5. CONTATO {CONFIG.exigirContato ? "(OBRIGATÓRIO)" : "(OPCIONAL)"}
          </MetaTag>
          <p className="text-[11px] text-on-surface-variant mb-3">
            {CONFIG.exigirContato
              ? "Informe um telefone para que a equipe possa confirmar os detalhes do registro."
              : CONFIG.permitirAnonimo
                ? "Deixe um telefone se puder ser contatado pela equipe. Você pode registrar de forma anônima."
                : "Deixe um telefone para que a equipe possa entrar em contato."}
          </p>
          <MetaTag className="block mb-1.5">CPF (OBRIGATÓRIO)</MetaTag>
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-on-surface-variant/50 mb-4"
          />

          <MetaTag className="block mb-1.5">
            TELEFONE {CONFIG.exigirContato ? "(OBRIGATÓRIO)" : "(OPCIONAL)"}
          </MetaTag>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder="(73) 90000-0000"
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-on-surface-variant/50"
          />
        </section>

        {erro && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-error-container text-on-error-container">
            <Icon name="error" filled className="text-[18px]" />
            <span className="text-[13px] font-bold">{erro}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pb-12">
          <Btn variant="primary" icon="send" full onClick={enviar}>
            {enviando ? "Enviando…" : "Enviar registro"}
          </Btn>
        </div>

        <p className="text-[11px] text-on-surface-variant text-center -mt-8 pb-8">
          Emergência com risco à vida: ligue {CONFIG.telefonesEmergencia}.
        </p>
      </div>
    </main>
  );
}
