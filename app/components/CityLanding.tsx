"use client";

import Link from "next/link";
import { useState } from "react";
import { Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { GARDIAN_DATA } from "@/app/data/gardian";

const QUICK_LINKS = [
  {
    href: "/weather",
    icon: "rainy",
    label: "Previsão do Tempo",
    sub: "CPTEC · GOES-16",
    color: "bg-blue-100 text-blue-700",
  },
  {
    href: "/zones",
    icon: "hub",
    label: "Áreas de Risco",
    sub: "42 zonas mapeadas",
    color: "bg-error-container text-on-error-container",
  },
  {
    href: "/geology",
    icon: "terrain",
    label: "Risco Climático",
    sub: "AdaptaBrasil · IPCC",
    color: "bg-secondary/10 text-secondary",
  },
] as const;

const CITY_STATS = [
  { label: "Altitude média", value: "36", unit: "m", icon: "landscape" },
  { label: "População estimada", value: "305", unit: "mil", icon: "groups" },
  { label: "Zonas monitoradas", value: String(GARDIAN_DATA.KPIS.zonasTotal), unit: "", icon: "hub" },
  { label: "Sensores IoT ativos", value: String(GARDIAN_DATA.KPIS.sensoresAtivos), unit: "", icon: "sensors" },
] as const;

const NEWS = [
  {
    date: "18 MAI 2026",
    title: "Operação Chuvas 2026: Defesa Civil reforça monitoramento nas encostas",
    tag: "Operação",
  },
  {
    date: "15 MAI 2026",
    title: "Simulado de evacuação no distrito Centro registra 85% de adesão",
    tag: "Simulado",
  },
  {
    date: "12 MAI 2026",
    title: "Nova rede LoRaWAN expande cobertura para o litoral sul do município",
    tag: "Tecnologia",
  },
] as const;

const SERVICES = [
  { href: "/dashboard", icon: "dashboard", label: "Painel Geral", desc: "Visão consolidada da operação" },
  { href: "/monitoring", icon: "stat_2", label: "Monitoramento", desc: "Telemetria ao vivo" },
  { href: "/occurrences", icon: "emergency", label: "Ocorrências", desc: "Triagem e despacho" },
  { href: "/zones", icon: "map", label: "Zonas", desc: "Mapeamento territorial" },
] as const;

const PREVENTION = [
  {
    icon: "home",
    title: "Em caso de chuva forte",
    items: [
      "Afaste-se de encostas e margens de rios",
      "Não transite em vias alagadas",
      "Mantenha kit de emergência acessível",
    ],
  },
  {
    icon: "warning",
    title: "Sinais de alerta geológico",
    items: [
      "Rachaduras novas em muros e pisos",
      "Portas ou janelas emperrando",
      "Manchas de umidade em paredes",
    ],
  },
  {
    icon: "campaign",
    title: "Canais oficiais",
    items: [
      "Central 199 — Defesa Civil",
      "SMS Defesa Civil (40199)",
      "App Cidadão · alertas push",
    ],
  },
] as const;

const FAQ = [
  {
    q: "O que é o GARDIAN?",
    a: "O GARDIAN é o sistema integrado de monitoramento e comando da Defesa Civil de Porto Seguro. Reúne dados meteorológicos, sensores IoT, ocorrências e indicadores de risco geológico em um único painel operacional.",
  },
  {
    q: "Quais áreas são mais vulneráveis?",
    a: "Áreas de encosta e trechos costeiros com ocupação irregular, especialmente no Centro, Cambolo e Ponta do Mutá, apresentam histórico de deslizamentos e erosão. O mapeamento completo está disponível na seção de Zonas.",
  },
  {
    q: "Como recebo alertas da Defesa Civil?",
    a: "Alertas críticos são difundidos por SMS (40199), sirenes comunitárias, aplicativo do cidadão e imprensa local. Em situações de risco iminente, siga as orientações de evacuação preventiva.",
  },
  {
    q: "Posso reportar uma ocorrência?",
    a: "Sim. Moradores podem acionar a central 199 ou registrar relatos que são triados no sistema junto com dados de sensores e parceiros institucionais.",
  },
] as const;

const HEADER_SCROLL_OFFSET = 80;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
}

function SectionNavLink({
  href,
  children,
}: {
  href: `#${string}`;
  children: React.ReactNode;
}) {
  const id = href.slice(1);
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection(id);
        window.history.replaceState(null, "", href);
      }}
      className="relative hover:text-secondary transition-colors duration-300 ease-out after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:scale-x-0 after:bg-secondary after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100"
    >
      {children}
    </a>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-tonal shadow-ambient-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-surface-container-low transition-colors"
      >
        <span className="font-bold text-sm text-primary">{q}</span>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="text-secondary text-[22px] shrink-0"
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-[13px] text-on-surface-variant leading-relaxed border-t border-outline-variant/20 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export function CityLanding() {
  const W = GARDIAN_DATA.WEATHER;

  return (
    <div className="min-h-screen bg-surface">
      {/* Barra institucional */}
      <div className="bg-primary text-white/80 text-[10px] font-mono uppercase tracking-mono font-bold py-2 px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <span>Prefeitura de Porto Seguro · Defesa Civil</span>
          <span>Costa do Descobrimento · Bahia</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-outline-variant/30 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-24 pb-4 h-20 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/logo_portoseguro.png"
                alt="Prefeitura de Porto Seguro"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="font-headline font-black text-xl text-primary tracking-tight leading-none">
                GARDIAN
              </p>
              <p className="text-[10px] font-bold tracking-mono text-slate-500 uppercase">
                Defesa Civil · Porto Seguro
              </p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
            <SectionNavLink href="#sobre">Sobre</SectionNavLink>
            <SectionNavLink href="#noticias">Informativos</SectionNavLink>
            <SectionNavLink href="#servicos">Serviços</SectionNavLink>
            <SectionNavLink href="#duvidas">Dúvidas</SectionNavLink>
          </nav>
          <Link href="/login">
            <Btn variant="primary" icon="dashboard">
              Centro de Comando
            </Btn>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 bg-gradient-to-br from-primary to-primary-container rounded-xl p-8 lg:p-12 text-white relative overflow-hidden min-h-[320px] flex flex-col justify-center">
              <div className="absolute top-0 right-0 opacity-[0.05] pointer-events-none">
                <Icon name="location_city" filled className="text-[280px]" />
              </div>
              <div className="relative z-10">
                <Chip tone="secondary" className="!bg-secondary/20 !text-secondary-container mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot inline-block mr-1.5" />
                  BERÇO DO BRASIL · EXTREMO SUL DA BAHIA
                </Chip>
                <h1 className="font-headline font-black text-4xl lg:text-6xl tracking-tighter leading-[1.05] mb-4">
                  Porto Seguro
                </h1>
                <p className="text-white/75 text-sm lg:text-base max-w-xl leading-relaxed mb-6">
                  Conhecida por suas praias, clima tropical e relevo costeiro com áreas de encosta,
                  Porto Seguro conta com monitoramento integrado da Defesa Civil para proteger
                  moradores em bairros litorâneos, vales e áreas urbanas.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/login">
                    <Btn variant="success" icon="dashboard">
                      Acessar Sistema
                    </Btn>
                  </Link>
                  <a
                    href="#sobre"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection("sobre");
                      window.history.replaceState(null, "", "#sobre");
                    }}
                  >
                    <Btn variant="ghostDark" icon="info">
                      Saiba Mais
                    </Btn>
                  </a>
                </div>
                <div className="flex flex-wrap gap-6 mt-8 text-[10px] font-mono uppercase tracking-mono font-bold text-white/50">
                  <span>
                    COORD: <strong className="text-white/90">16°27′S · 39°04′W</strong>
                  </span>
                  <span>
                    CLIMA ATUAL: <strong className="text-secondary-container">{W.condition}</strong>
                  </span>
                  <span>
                    TEMP: <strong className="text-white/90">{W.temp}°C</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Card emergência — inspirado no disk-199 do exemplo */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="card-tonal shadow-ambient p-6 flex-1 flex flex-col justify-center border-l-4 border-error">
                <MetaTag className="text-error block mb-2">EMERGÊNCIA</MetaTag>
                <p className="font-headline font-black text-6xl text-error tracking-tighter leading-none">
                  199
                </p>
                <p className="text-sm font-bold text-primary mt-2">Central da Defesa Civil</p>
                <p className="text-[12px] text-on-surface-variant mt-2 leading-relaxed">
                  Atendimento 24 horas, todos os dias. Em risco iminente, ligue imediatamente.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-error-container/50 flex items-start gap-2">
                  <Icon name="warning" filled className="text-error text-[18px] mt-0.5" />
                  <p className="text-[11px] text-on-error-container leading-snug">
                    {W.precipitation}% de probabilidade de chuva · acumulado de {W.rainfall_3h}mm nas últimas 3h
                  </p>
                </div>
              </div>
              <div className="card-recessed p-5 flex items-center gap-4">
                <Icon name="cloudy_snowing" filled className="text-secondary text-[36px]" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">
                    Previsão · {W.updatedAt}
                  </p>
                  <p className="font-headline font-black text-2xl text-primary tracking-tight">
                    {W.temp}°C · {W.humidity}% umidade
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Atalhos rápidos — inspirado em linhas-de-acao */}
      <section className="py-10 px-6 bg-surface-container-low">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="card-tonal p-8 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5 transition-all text-center group"
              >
                <div
                  className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${item.color}`}
                >
                  <Icon name={item.icon} filled className="text-[28px]" />
                </div>
                <p className="font-headline font-black text-lg text-primary tracking-tight group-hover:text-secondary transition-colors">
                  {item.label}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-1">{item.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre — inspirado em apresentacao-destaque */}
      <section id="sobre" className="py-14 px-6 scroll-mt-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-10">
            <MetaTag className="text-secondary block mb-2">DEFESA CIVIL DE PORTO SEGURO</MetaTag>
            <h2 className="font-headline font-black text-3xl lg:text-4xl text-primary tracking-tighter uppercase">
              Sobre a Cidade e o Monitoramento
            </h2>
            <div className="w-24 h-1 bg-secondary mx-auto mt-4 rounded-full" />
          </div>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[15px] text-on-surface-variant leading-relaxed">
              A Defesa Civil de Porto Seguro atua em regime de plantão contínuo para prevenir e
              responder a desastres naturais — especialmente deslizamentos, alagamentos e
              erosão costeira, frequentes no período chuvoso. O{" "}
              <strong className="text-primary">GARDIAN</strong> integra sensores IoT, modelos
              climáticos (CPTEC, GOES-16), indicadores AdaptaBrasil e relatos da população em uma
              plataforma de comando para equipes técnicas e gestores.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {CITY_STATS.map((s) => (
              <div
                key={s.label}
                className="card-tonal p-6 shadow-ambient-sm text-center"
              >
                <Icon name={s.icon} className="text-secondary text-[24px] mx-auto mb-3" />
                <p className="font-headline font-black text-4xl text-primary tracking-tighter">
                  {s.value}
                  {s.unit && (
                    <span className="text-lg text-slate-400 font-bold ml-0.5">{s.unit}</span>
                  )}
                </p>
                <MetaTag className="mt-2 block">{s.label}</MetaTag>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {PREVENTION.map((block) => (
              <div key={block.title} className="card-recessed p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
                    <Icon name={block.icon} filled className="text-primary text-[20px]" />
                  </div>
                  <h3 className="font-headline font-black text-base text-primary tracking-tight">
                    {block.title}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {block.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[12px] text-on-surface-variant"
                    >
                      <Icon name="check_circle" className="text-secondary text-[14px] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notícias */}
      <section id="noticias" className="py-14 px-6 bg-surface-container-low scroll-mt-24">
        <div className="max-w-[1200px] mx-auto">
          <SectionHeader
            overline="COMUNICADOS"
            title="Informativos"
            className="!justify-center [&_h3]:text-center [&_span]:text-center"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {NEWS.map((n) => (
              <article
                key={n.title}
                className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-6 text-white shadow-ambient-sm flex flex-col min-h-[220px]"
              >
                <div className="flex items-center justify-between mb-4">
                  <small className="text-[10px] font-mono text-white/60">{n.date}</small>
                  <Chip tone="primarySoft" className="!bg-white/15 !text-white">
                    {n.tag}
                  </Chip>
                </div>
                <h3 className="font-headline font-bold text-lg leading-snug tracking-tight flex-1">
                  {n.title}
                </h3>
                <button
                  type="button"
                  className="mt-6 w-full py-2.5 rounded-lg bg-white/15 text-[10px] font-black uppercase tracking-mono-tight hover:bg-white/25 transition-colors"
                >
                  Leia mais
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="py-14 px-6 scroll-mt-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-headline font-black text-3xl text-primary tracking-tighter uppercase">
              Alguns de Nossos Serviços
            </h2>
            <div className="w-24 h-1 bg-secondary mx-auto mt-4 rounded-full" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="card-tonal p-6 shadow-ambient-sm hover:shadow-ambient transition-all text-center group"
              >
                <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/20 transition-colors">
                  <Icon name={s.icon} filled className="text-secondary text-[26px]" />
                </div>
                <p className="font-bold text-sm text-primary">{s.label}</p>
                <p className="text-[11px] text-on-surface-variant mt-1">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mapa / localização */}
      <section className="py-14 px-6 bg-primary">
        <div className="max-w-[1200px] mx-auto text-center text-white">
          <MetaTag className="text-white/60 block mb-2">LOCALIZAÇÃO</MetaTag>
          <h2 className="font-headline font-black text-3xl tracking-tighter mb-4">
            Nossa Região de Atuação
          </h2>
          <p className="text-white/70 text-sm max-w-lg mx-auto mb-8">
            Monitoramento concentrado no município de Porto Seguro-BA, com ênfase em distritos
            litorâneos, áreas de encosta e trechos com córregos e nascentes.
          </p>
          <div className="rounded-xl overflow-hidden shadow-ambient bg-white text-left">
            <iframe
              title="Mapa de Porto Seguro, Bahia"
              className="w-full h-64 lg:h-[420px] border-0 block"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-39.128%2C-16.512%2C-39.001%2C-16.388&layer=mapnik&marker=-16.4497%2C-39.0647"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon name="pin_drop" filled className="text-secondary text-[22px]" />
                </div>
                <div>
                  <p className="font-headline font-black text-primary text-sm tracking-tight">
                    Porto Seguro, BA
                  </p>
                  <p className="text-[11px] font-mono font-bold text-on-surface-variant">
                    16.4497° S · 39.0647° W
                  </p>
                </div>
              </div>
              <a
                href="https://www.openstreetmap.org/?mlat=-16.4497&mlon=-39.0647#map=13/-16.4497/-39.0647"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-mono-tight text-secondary hover:text-primary transition-colors"
              >
                Abrir mapa completo
                <Icon name="open_in_new" className="text-[16px]" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="py-14 px-6 scroll-mt-24">
        <div className="max-w-[800px] mx-auto">
          <SectionHeader overline="DÚVIDAS FREQUENTES" title="Perguntas e Respostas" />
          <div className="space-y-3">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-container text-white/80 py-10 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <p className="font-headline font-black text-xl text-white mb-2">GARDIAN</p>
            <p className="text-[12px] leading-relaxed">
              Sistema Integrado de Defesa Civil · Porto Seguro-BA
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-mono font-bold text-white/50 mb-3">
              Fale Conosco
            </p>
            <p className="text-sm text-white/90 flex items-center gap-2 mb-2">
              <Icon name="call" className="text-[18px]" /> 199 — Defesa Civil
            </p>
            <p className="text-sm text-white/90 flex items-center gap-2">
              <Icon name="mail" className="text-[18px]" /> defesacivil@portoseguro.ba.gov.br
            </p>
          </div>
          <div className="md:text-right">
            <Link href="/login">
              <Btn variant="success" icon="dashboard" iconRight="arrow_forward">
                Centro de Comando
              </Btn>
            </Link>
            <p className="text-[10px] font-mono mt-4 text-white/40">
              SENTINEL PROTOCOL · 14 TECH
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


