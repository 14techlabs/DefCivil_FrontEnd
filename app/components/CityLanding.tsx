"use client";

import Link from "next/link";
import { useState } from "react";
import { Btn, Chip, Icon, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { GARDIAN_DATA } from "@/app/data/gardian";

type CityId = "porto-seguro" | "jequie" | "eunapolis" | "itagimirim" | "simoes-filho";

type CityConfig = {
  id: CityId;
  label: string;
  prefeitura: string;
  region: string;
  tagline: string;
  heroDescription: string;
  coords: string;
  lat: number;
  lon: number;
  mapBbox: string;
  altitude: string;
  population: string;
  aboutText: string;
  mapDescription: string;
  email: string;
};

const CITIES: CityConfig[] = [
  {
    id: "porto-seguro",
    label: "Porto Seguro",
    prefeitura: "Prefeitura de Porto Seguro",
    region: "Costa do Descobrimento · Bahia",
    tagline: "BERÇO DO BRASIL · EXTREMO SUL DA BAHIA",
    heroDescription:
      "Conhecida por suas praias, clima tropical e relevo costeiro com áreas de encosta, Porto Seguro conta com monitoramento integrado da Defesa Civil para proteger moradores em bairros litorâneos, vales e áreas urbanas.",
    coords: "16°27′S · 39°04′W",
    lat: -16.4497,
    lon: -39.0647,
    mapBbox: "-39.128%2C-16.512%2C-39.001%2C-16.388",
    altitude: "36",
    population: "305",
    aboutText:
      "A Defesa Civil de Porto Seguro atua em regime de plantão contínuo para prevenir e responder a desastres naturais — especialmente deslizamentos, alagamentos e erosão costeira, frequentes no período chuvoso.",
    mapDescription:
      "Monitoramento concentrado no município de Porto Seguro-BA, com ênfase em distritos litorâneos, áreas de encosta e trechos com córregos e nascentes.",
    email: "defesacivil@portoseguro.ba.gov.br",
  },
  {
    id: "jequie",
    label: "Jequié",
    prefeitura: "Prefeitura de Jequié",
    region: "Médio Rio de Contas · Bahia",
    tagline: "PRINCESA DO SUL · INTERIOR BAIANO",
    heroDescription:
      "No coração do sudoeste baiano, Jequié enfrenta períodos de chuva intensa e risco em encostas urbanas. O GARDIAN apoia a Defesa Civil no acompanhamento de áreas sensíveis e na resposta a ocorrências.",
    coords: "13°51′S · 40°05′W",
    lat: -13.8578,
    lon: -40.0839,
    mapBbox: "-40.15%2C-13.92%2C-40.02%2C-13.79",
    altitude: "223",
    population: "156",
    aboutText:
      "A Defesa Civil de Jequié trabalha na prevenção de deslizamentos, alagamentos e eventos associados ao regime pluviométrico da região, com foco em bairros em encosta e áreas de expansão urbana.",
    mapDescription:
      "Cobertura no município de Jequié-BA, com atenção a encostas, córregos urbanos e pontos de acúmulo hídrico em períodos chuvosos.",
    email: "defesacivil@jequie.ba.gov.br",
  },
  {
    id: "eunapolis",
    label: "Eunápolis",
    prefeitura: "Prefeitura de Eunápolis",
    region: "Extremo Sul · Bahia",
    tagline: "PORTA DE ENTRADA DO SUL · LITORAL",
    heroDescription:
      "Eunápolis combina área urbana densa e trechos com influência costeira. O monitoramento integrado auxilia a Defesa Civil a antecipar riscos de alagamento e movimentos de massa em encostas.",
    coords: "16°22′S · 39°35′W",
    lat: -16.3775,
    lon: -39.5822,
    mapBbox: "-39.65%2C-16.44%2C-39.51%2C-16.31",
    altitude: "16",
    population: "118",
    aboutText:
      "A Defesa Civil de Eunápolis atua na proteção da população frente a chuvas intensas, alagamentos e instabilidades em taludes, articulando dados de sensores, previsão meteorológica e relatos do cidadão.",
    mapDescription:
      "Atuação em Eunápolis-BA, com monitoramento de áreas urbanas sujeitas a alagamento e trechos com ocupação em encosta.",
    email: "defesacivil@eunapolis.ba.gov.br",
  },
  {
    id: "itagimirim",
    label: "Itagimirim",
    prefeitura: "Prefeitura de Itagimirim",
    region: "Extremo Sul · Bahia",
    tagline: "INTERIOR DO EXTREMO SUL · BA",
    heroDescription:
      "Em Itagimirim, a Defesa Civil utiliza o GARDIAN para acompanhar condições climáticas, áreas de risco e ocorrências, fortalecendo a resposta rápida em comunidades rurais e no perímetro urbano.",
    coords: "16°05′S · 39°41′W",
    lat: -16.0903,
    lon: -39.6817,
    mapBbox: "-39.75%2C-16.15%2C-39.61%2C-16.03",
    altitude: "156",
    population: "11",
    aboutText:
      "A Defesa Civil de Itagimirim prioriza a prevenção de desastres relacionados a chuvas, enxurradas e instabilidade de encostas, com apoio de dados integrados para decisão em campo.",
    mapDescription:
      "Monitoramento no município de Itagimirim-BA, incluindo zona urbana e comunidades com histórico de vulnerabilidade hidrológica.",
    email: "defesacivil@itagimirim.ba.gov.br",
  },
  {
    id: "simoes-filho",
    label: "Simões Filho",
    prefeitura: "Prefeitura de Simões Filho",
    region: "Região Metropolitana de Salvador · Bahia",
    tagline: "POLO INDUSTRIAL · RMS",
    heroDescription:
      "Integrante da Região Metropolitana de Salvador, Simões Filho concentra área urbana em expansão e polos logísticos sujeitos a alagamentos e acúmulo hídrico em períodos de chuva intensa. O GARDIAN apoia a Defesa Civil no monitoramento de áreas sensíveis e na resposta a ocorrências.",
    coords: "12°47′S · 38°24′W",
    lat: -12.7867,
    lon: -38.4031,
    mapBbox: "-38.47%2C-12.85%2C-38.34%2C-12.72",
    altitude: "10",
    population: "144",
    aboutText:
      "A Defesa Civil de Simões Filho atua na prevenção e resposta a alagamentos, enxurradas e eventos associados ao regime pluviométrico da região metropolitana, com foco em vias críticas, bairros urbanos e áreas de drenagem.",
    mapDescription:
      "Monitoramento no município de Simões Filho-BA, com atenção a corredores urbanos, córregos e trechos sujeitos a acúmulo hídrico em períodos chuvosos.",
    email: "defesacivil@simoesfilho.ba.gov.br",
  },
];

const SYSTEM_DESCRIPTION = {
  title: "O que é o GARDIAN",
  lead: "Plataforma integrada de monitoramento e gestão da Defesa Civil.",
  body: "O GARDIAN reúne em um único ambiente previsão do tempo, telemetria, mapeamento de áreas de risco, registro de ocorrências e indicadores climáticos. Equipes técnicas e gestores utilizam esses dados para antecipar eventos, orientar a população e coordenar ações de prevenção e resposta a desastres naturais.",
  highlights: [
    { icon: "cloud", label: "Clima e alertas", desc: "Previsão e dados meteorológicos em tempo quase real" },
    { icon: "hub", label: "Áreas de risco", desc: "Zonas mapeadas com níveis de vulnerabilidade" },
    { icon: "sensors", label: "Sensores IoT", desc: "Chuva, umidade e indicadores de campo" },
    { icon: "emergency", label: "Ocorrências", desc: "Triagem, despacho e acompanhamento operacional" },
  ],
} as const;

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

function cityStats(city: CityConfig) {
  return [
    { label: "Altitude média", value: city.altitude, unit: "m", icon: "landscape" as const },
    { label: "População estimada", value: city.population, unit: "mil", icon: "groups" as const },
    { label: "Zonas monitoradas", value: String(GARDIAN_DATA.KPIS.zonasTotal), unit: "", icon: "hub" as const },
    { label: "Usuários ativos", value: String(GARDIAN_DATA.KPIS.sensoresAtivos), unit: "", icon: "sensors" as const },
  ];
}

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
  
] as const;

const SERVICES = [
  { href: "/dashboard", icon: "dashboard", label: "Painel Geral", desc: "Visão consolidada da operação" },
  { href: "/monitoring", icon: "stat_2", label: "Monitoramento", desc: "Telemetria" },
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
 
] as const;

function cityFaq(cityName: string) {
  return [
  {
    q: "O que é o GARDIAN?",
    a: `O GARDIAN é o sistema integrado de monitoramento e comando da Defesa Civil de ${cityName}. Reúne dados meteorológicos, sensores IoT, ocorrências e indicadores de risco geológico em um único painel operacional.`,
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
}

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
  const [cityId, setCityId] = useState<CityId>("porto-seguro");
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  const stats = cityStats(city);
  const faq = cityFaq(city.label);
  const W = GARDIAN_DATA.WEATHER;
  const mapEmbedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${city.mapBbox}&layer=mapnik&marker=${city.lat}%2C${city.lon}`;
  const mapExternalHref = `https://www.openstreetmap.org/?mlat=${city.lat}&mlon=${city.lon}#map=13/${city.lat}/${city.lon}`;

  return (
    <div className="min-h-screen bg-surface">
      {/* Barra institucional */}
      <div className="bg-primary text-white/80 text-[10px] font-mono uppercase tracking-mono font-bold py-2 px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <span>{city.prefeitura} · Defesa Civil</span>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <label htmlFor="city-select" className="sr-only">
              Município do sistema
            </label>
            <div className="flex items-center gap-2">
              <Icon name="location_city" className="text-[14px] text-white/60" />
              <select
                id="city-select"
                value={cityId}
                onChange={(e) => setCityId(e.target.value as CityId)}
                className="bg-white/10 text-white border border-white/20 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-mono-tight cursor-pointer hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-secondary/80 min-w-[140px]"
              >
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id} className="text-primary bg-white normal-case">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden sm:inline text-white/50">{city.region}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-outline-variant/30 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Icon name="shield" filled className="text-white text-[22px]" />
            </div>
            <div>
              <p className="font-headline font-black text-xl text-primary tracking-tight leading-none">
                GARDIAN
              </p>
              <p className="text-[10px] font-bold tracking-mono text-slate-500 uppercase">
                Defesa Civil · {city.label}
              </p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
            <SectionNavLink href="#sistema">O Sistema</SectionNavLink>
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
                  {city.tagline}
                </Chip>
                <h1 className="font-headline font-black text-4xl lg:text-6xl tracking-tighter leading-[1.05] mb-4">
                  {city.label}
                </h1>
                <p className="text-white/75 text-sm lg:text-base max-w-xl leading-relaxed mb-6">
                  {city.heroDescription}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/login">
                    <Btn variant="success" icon="dashboard">
                      Acessar Sistema
                    </Btn>
                  </Link>
                
                </div>
                <div className="flex flex-wrap gap-6 mt-8 text-[10px] font-mono uppercase tracking-mono font-bold text-white/50">
                  <span>
                    COORD: <strong className="text-white/90">{city.coords}</strong>
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

      {/* Descrição do sistema */}
      <section id="sistema" className="py-12 px-6 scroll-mt-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="card-tonal shadow-ambient p-8 lg:p-10 border-l-4 border-secondary">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5">
                <MetaTag className="text-secondary block mb-2">PLATAFORMA GARDIAN</MetaTag>
                <h2 className="font-headline font-black text-2xl lg:text-3xl text-primary tracking-tighter mb-3">
                  {SYSTEM_DESCRIPTION.title}
                </h2>
                <p className="text-sm font-bold text-secondary mb-4">{SYSTEM_DESCRIPTION.lead}</p>
                <p className="text-[14px] text-on-surface-variant leading-relaxed">
                  {SYSTEM_DESCRIPTION.body}
                </p>
                <p className="text-[12px] text-on-surface-variant/80 mt-4 leading-relaxed">
                  Instância ativa: <strong className="text-primary">{city.prefeitura}</strong> — os
                  dados exibidos referem-se à operação da Defesa Civil em{" "}
                  <strong className="text-primary">{city.label}</strong>.
                </p>
              </div>
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SYSTEM_DESCRIPTION.highlights.map((item) => (
                  <div
                    key={item.label}
                    className="card-recessed p-5 flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                      <Icon name={item.icon} filled className="text-secondary text-[20px]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-primary">{item.label}</p>
                      <p className="text-[12px] text-on-surface-variant mt-1 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
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
            <MetaTag className="text-secondary block mb-2">
              DEFESA CIVIL DE {city.label.toUpperCase()}
            </MetaTag>
            <h2 className="font-headline font-black text-3xl lg:text-4xl text-primary tracking-tighter uppercase">
              Sobre a Cidade e o Monitoramento
            </h2>
            <div className="w-24 h-1 bg-secondary mx-auto mt-4 rounded-full" />
          </div>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[15px] text-on-surface-variant leading-relaxed">
              {city.aboutText} O{" "}
              <strong className="text-primary">GARDIAN</strong> integra sensores IoT, modelos
              climáticos (CPTEC, GOES-16), indicadores AdaptaBrasil e relatos da população em uma
              plataforma de comando para equipes técnicas e gestores.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {stats.map((s) => (
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
          <div className=" flex justify-center items-center gap-5">
            {NEWS.map((n) => (
              <article
                key={n.title}
                className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-6 text-white shadow-ambient-sm flex flex-col min-h-[220px] max-w-[320px]"
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
          <p className="text-white/70 text-sm max-w-lg mx-auto mb-8">{city.mapDescription}</p>
          <div className="rounded-xl overflow-hidden shadow-ambient bg-white text-left">
            <iframe
              title={`Mapa de ${city.label}, Bahia`}
              className="w-full h-64 lg:h-[420px] border-0 block"
              src={mapEmbedSrc}
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
                    {city.label}, BA
                  </p>
                  <p className="text-[11px] font-mono font-bold text-on-surface-variant">
                    {Math.abs(city.lat).toFixed(4)}° S · {Math.abs(city.lon).toFixed(4)}° W
                  </p>
                </div>
              </div>
              <a
                href={mapExternalHref}
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
            {faq.map((item) => (
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
              Sistema Integrado de Defesa Civil · {city.label}-BA
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
              <Icon name="mail" className="text-[18px]" /> {city.email}
            </p>
          </div>
          <div className="md:text-right">
            <Link href="/login">
              <Btn variant="success" icon="dashboard" iconRight="arrow_forward">
                Centro de Comando
              </Btn>
            </Link>
            
          </div>
        </div>
      </footer>
    </div>
  );
}


