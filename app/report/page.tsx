"use client";

import { useState } from "react";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { MOCK_EVENTOS } from "@/app/data/mock";

/* checklist rápido para o cidadão */
const CHECKLIST = [
  { id: "pessoas_risco", label: "Há pessoas em risco no local", icon: "personal_injury" },
  { id: "criancas_idosos", label: "Há crianças, idosos ou pessoas com mobilidade reduzida", icon: "elderly" },
  { id: "agua_invadindo", label: "Água invadindo imóveis", icon: "water" },
  { id: "rachaduras", label: "Rachaduras, estalos ou portas emperrando", icon: "foundation" },
  { id: "via_bloqueada", label: "Via bloqueada ou intransitável", icon: "block" },
  { id: "energia", label: "Fiação caída ou falta de energia", icon: "bolt" },
  { id: "animais", label: "Há animais no local", icon: "pets" },
];

const CATEGORIAS = [
  { id: "climatico", label: "Chuva / Alagamento", icon: "thunderstorm" },
  { id: "geologico", label: "Deslizamento / Encosta", icon: "terrain" },
  { id: "vias_publicas", label: "Via pública", icon: "directions_car" },
  { id: "produtos_perigosos", label: "Produto perigoso", icon: "science" },
];

export default function PublicReportPage() {
  const eventoAtivo = MOCK_EVENTOS.find((e) => e.status === "ativo") ?? null;

  const [categoria, setCategoria] = useState("climatico");
  const [descricao, setDescricao] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [modoLocal, setModoLocal] = useState<"endereco" | "coordenada">("endereco");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [contato, setContato] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "carregando" | "ok" | "erro">("idle");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
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

  const enviar = () => {
    if (descricao.trim().length < 10) {
      setErro("Descreva o que está acontecendo com pelo menos 10 caracteres.");
      return;
    }
    if (modoLocal === "endereco" && !endereco.trim()) {
      setErro("Informe o endereço ou use sua localização atual.");
      return;
    }
    if (modoLocal === "coordenada" && (!lat.trim() || !lng.trim())) {
      setErro("Informe as coordenadas ou use sua localização atual.");
      return;
    }
    setErro("");
    setProtocolo(`PS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setEnviado(true);
  };

  /* ───────── confirmação ───────── */
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
            Registrar uma ocorrência
          </h1>
          <p className="text-white/75 text-sm mt-3 max-w-xl leading-relaxed">
            Conte o que está acontecendo perto de você. As informações vão direto para a equipe de plantão.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* aviso do evento ativo (resumo público + recomendações) */}
        {eventoAtivo && (
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
        </section>

        {/* contato */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <MetaTag className="block mb-1">5. CONTATO (OPCIONAL)</MetaTag>
          <p className="text-[11px] text-on-surface-variant mb-3">
            Deixe um telefone se puder ser contatado pela equipe. Você pode registrar de forma anônima.
          </p>
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
            Enviar registro
          </Btn>
        </div>

        <p className="text-[11px] text-on-surface-variant text-center -mt-8 pb-8">
          Emergência com risco à vida: ligue 199 (Defesa Civil) ou 193 (Bombeiros).
        </p>
      </div>
    </main>
  );
}
