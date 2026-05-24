"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MapPlaceholder } from "@/app/components/MapPlaceholder";
import { Bar, Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { useAppNavigation } from "@/app/lib/useAppNavigation";

function ZoneDetailContent() {
  const searchParams = useSearchParams();
  const zoneId = searchParams.get("zone") ?? "PT-ZN-02";
  const { alertMode } = useGardian();
  const { go, router } = useAppNavigation();
  const back = () => router.push("/zones");

  const ZONES = GARDIAN_DATA.ZONES;
  const OCCURRENCES = GARDIAN_DATA.OCCURRENCES;
  const z = ZONES.find((x) => x.id === zoneId) || ZONES[0];
  const zoneOccs = OCCURRENCES.filter((o) => o.zoneId === z.id);
  const tone = z.status === "critico" ? "error" : z.status === "atencao" ? "warning" : "secondary";

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant hover:text-primary mb-4"
        >
          <Icon name="arrow_back" className="text-[16px]" /> Voltar para Zonas
        </button>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">GEO-DATA PROTOCOL · v2.4</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>ZONA #{z.id}</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <Chip tone={tone}>{z.statusLabel}</Chip>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">{z.name}</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">{z.description}</p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="add_box">Inserir Tratamento</Btn>
            <Btn variant="primary" icon="report">Registrar Novo Evento</Btn>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 lg:col-span-7 card-tonal p-2 shadow-ambient-sm">
          <MapPlaceholder variant="topo" height={500} alertMode={alertMode && z.status === "critico"} />
        </section>

        <section className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          <div className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-center justify-between mb-6">
              <MetaTag>Saturação do Solo</MetaTag>
              <Icon name="water_drop" filled className="text-error text-[20px]" />
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-headline font-black text-7xl text-primary tracking-tighter">
                {typeof z.primarySensor.value === "number" ? z.primarySensor.value : 82}
                {z.primarySensor.unit === "%" ? "%" : ""}
              </span>
              <Chip tone="error" icon="trending_up">+4%</Chip>
            </div>
            <Bar value={typeof z.primarySensor.value === "number" ? z.primarySensor.value : 82} tone={tone} />
            <p className="text-[12px] text-on-surface-variant mt-4 leading-relaxed">
              Nível de alerta crítico. A saturação atual excede o limite de segurança geomecânica para o tipo de solo predominante (Argissolo).
            </p>
          </div>

          <div className="card-tonal p-7 shadow-ambient-sm">
            <div className="flex items-center justify-between mb-6">
              <MetaTag>Inclinação do Talude</MetaTag>
              <Icon name="architecture" filled className="text-secondary text-[20px]" />
            </div>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-headline font-black text-7xl text-primary tracking-tighter">{z.gradient}°</span>
              <Chip tone="secondary">ESTÁVEL</Chip>
            </div>
            <Bar value={(z.gradient / 60) * 100} tone="secondary" />
            <p className="text-[12px] text-on-surface-variant mt-4 leading-relaxed">
              Ângulo de repouso mantido. Monitoramento de fissuras superficiais ativo via sensores de fibra ótica.
            </p>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="HISTÓRICO 5 ANOS" title="Eventos Registrados" />
          {z.history.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">Sem eventos críticos registrados nos últimos 5 anos.</p>
          ) : (
            <div className="space-y-3">
              {z.history.map((h, i) => (
                <div key={i} className="bg-surface-container-low p-4 rounded-lg flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono font-black text-error">{h.year}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-primary">{h.label}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{h.note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="col-span-12 lg:col-span-7 card-tonal p-7 shadow-ambient-sm">
          <SectionHeader overline="SOLUÇÕES APLICADAS" title="Histórico de Mitigação" />
          {z.treatments.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant">Nenhum tratamento aplicado.</p>
          ) : (
            <div className="space-y-4">
              {z.treatments.map((t, i) => (
                <div
                  key={i}
                  className={`p-5 rounded-lg ${t.status === "concluido" ? "bg-secondary/8" : "bg-warning-container/40"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon
                      name={t.status === "concluido" ? "check_circle" : "pending"}
                      filled
                      className={t.status === "concluido" ? "text-secondary" : "text-orange-600"}
                    />
                    <h5 className="font-bold text-sm text-primary">{t.label}</h5>
                    <Chip tone={t.status === "concluido" ? "secondary" : "warning"} className="ml-auto">
                      {t.status === "concluido" ? "CONCLUÍDA" : "EM ANDAMENTO"}
                    </Chip>
                  </div>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{t.note}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-5 bg-primary-container/8 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="psychology" filled className="text-primary text-[18px]" />
              <MetaTag className="text-primary">LIMIAR APRENDIDO PELA IA</MetaTag>
            </div>
            <p className="text-sm font-bold text-primary">{z.threshold.label}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Modelo recalibrado após mitigações aplicadas. Threshold reduz falsos positivos em 32%.
            </p>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 card-tonal p-7 shadow-ambient-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <MetaTag className="block mb-1">Ocorrências</MetaTag>
              <h3 className="font-headline font-black text-xl text-primary tracking-tight">Ativas</h3>
            </div>
            {zoneOccs.length > 0 && (
              <Chip tone="error">{String(zoneOccs.length).padStart(2, "0")} ATIVAS</Chip>
            )}
          </div>
          {zoneOccs.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Sem ocorrências ativas para esta zona.</p>
          ) : (
            <div className="space-y-3">
              {zoneOccs.map((o) => (
                <div
                  key={o.id}
                  className="bg-surface-container-low p-4 rounded-lg cursor-pointer hover:bg-surface-container transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-mono-tight text-error">
                      {o.categoryLabel}
                    </span>
                  </div>
                  <h5 className="font-bold text-sm text-primary mb-2">{o.title}</h5>
                  <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Icon name="schedule" className="text-[12px]" /> {o.reportedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="person" className="text-[12px]" /> {o.reportedBy}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => go("occurrences")}
            className="w-full mt-5 py-3 rounded-lg bg-surface-container-high text-primary text-[10px] font-black uppercase tracking-mono hover:bg-primary hover:text-white transition-all"
          >
            Ver Todas as Ocorrências
          </button>
        </section>

        <section className="col-span-12 card-tonal p-10 shadow-ambient-sm relative overflow-hidden">
          <SectionHeader overline="LINHA DO TEMPO" title="Histórico de Eventos & Mitigação" />
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/40" />
            <div className="space-y-8 relative">
              {[
                {
                  date: "12 OUT 2024",
                  title: "Instalação de Tela de Alta Resistência",
                  desc: "Mitigação estrutural finalizada no talude Norte. Redução comprovada de 45% no risco de queda de detritos.",
                  color: "primary",
                  chips: [
                    { l: "MITIGAÇÃO CONCLUÍDA", t: "secondary" as const },
                    { l: "INVESTIMENTO: R$ 45K", t: "neutral" as const },
                  ],
                },
                {
                  date: "28 SET 2024",
                  title: "Simulado de Evacuação Comunitária",
                  desc: "Participação de 85% dos residentes cadastrados. Tempo de resposta médio: 4m 12s para os pontos de encontro designados.",
                  color: "secondary",
                },
                {
                  date: "15 SET 2024",
                  title: "Atualização de Mapeamento RTK",
                  desc: "Levantamento aéreo via drone para identificação de deformações superficiais imperceptíveis a olho nu.",
                  color: "neutral",
                },
              ].map((e, i) => (
                <div key={i} className="flex gap-6 pl-8 relative">
                  <div
                    className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full ring-4 ring-white ${
                      e.color === "primary"
                        ? "bg-primary"
                        : e.color === "secondary"
                          ? "bg-secondary"
                          : "bg-outline-variant"
                    }`}
                    style={{
                      boxShadow:
                        "0 0 0 1px " +
                        (e.color === "primary"
                          ? "#051125"
                          : e.color === "secondary"
                            ? "#006A60"
                            : "#c5c6cd"),
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-bold text-primary text-base">{e.title}</h5>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-mono">
                        {e.date}
                      </span>
                    </div>
                    <p className="text-[13px] text-on-surface-variant leading-relaxed mb-3">{e.desc}</p>
                    {e.chips && (
                      <div className="flex gap-2">
                        {e.chips.map((c, ci) => (
                          <Chip key={ci} tone={c.t}>
                            {c.l}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* <section className="col-span-12 card-tonal p-8 shadow-ambient-sm flex items-center justify-between gap-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-live-dot" />
              <MetaTag>STATUS DO SENSOR IoT · #{z.id}</MetaTag>
            </div>
            <h4 className="font-headline font-black text-2xl text-primary">Rede LoRaWAN Operacional</h4>
            <p className="text-xs text-on-surface-variant mt-1">Último pacote de dados há 42s · Criptografia AES-256</p>
          </div>
          <div className="flex gap-12">
            {[
              { l: "Latência", v: "12ms" },
              { l: "Bateria", v: "94%" },
              { l: "Sinal", v: "-82dBm" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <MetaTag className="block mb-1">{s.l}</MetaTag>
                <p className="font-headline font-black text-2xl text-secondary">{s.v}</p>
              </div>
            ))}
          </div>
        </section> */}
      </div>
    </div>
  );
}

export default function ZoneDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-on-surface-variant">Carregando detalhes da zona…</div>
      }
    >
      <ZoneDetailContent />
    </Suspense>
  );
}
