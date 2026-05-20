// AdaptaBrasil data structure — Risco Climático IPCC
// Hierarchy: Tipo de impacto → Indicador → Composição (Vulnerabilidade/Exposição/Ameaça)
//            → Sub-índices → Fatores influenciadores
// Scale: 0.00 to 1.00. Classes: Muito baixo (0.0-0.19), Baixo (0.20-0.39),
//                                Médio (0.40-0.59), Alto (0.60-0.79), Muito alto (0.80-1.00)

const ADAPTABRASIL_LEVELS = [
  { id: "mb", label: "Muito baixo", color: "#2E8B57", range: [0.0, 0.19], rangeLabel: "0,00 a 0,19" },
  { id: "b",  label: "Baixo",       color: "#8BC34A", range: [0.20, 0.39], rangeLabel: "0,20 a 0,39" },
  { id: "m",  label: "Médio",       color: "#FFC107", range: [0.40, 0.59], rangeLabel: "0,40 a 0,59" },
  { id: "a",  label: "Alto",        color: "#FF8C00", range: [0.60, 0.79], rangeLabel: "0,60 a 0,79" },
  { id: "ma", label: "Muito alto",  color: "#E53935", range: [0.80, 1.00], rangeLabel: "0,80 a 1,00" },
];

// 6 categorias (Saúde e Biodiversidade removidas per request)
const ADAPTABRASIL_TYPES = [
  {
    id: "geohidrologicos",
    label: "Desastres Geo-hidrológicos",
    icon: "landslide",
    color: "#9C27B0",
    focus: true,
    subcategories: ["Deslizamento de terra", "Inundação", "Movimento gravitacional de massa"],
  },
  {
    id: "hidricos",
    label: "Recursos Hídricos",
    icon: "water_drop",
    color: "#1E88E5",
    subcategories: ["Risco de estresse hídrico", "Disponibilidade hídrica"],
  },
  {
    id: "alimentar",
    label: "Segurança Alimentar",
    icon: "restaurant",
    color: "#43A047",
    subcategories: ["Produção agrícola", "Culturas de subsistência"],
  },
  {
    id: "energetica",
    label: "Segurança Energética",
    icon: "bolt",
    color: "#FB8C00",
    subcategories: ["Geração hidrelétrica", "Biomassa"],
  },
  {
    id: "portuaria",
    label: "Infraestrutura Portuária",
    icon: "directions_boat",
    color: "#00ACC1",
    subcategories: ["Portos marítimos", "Hidrovias interiores"],
  },
  {
    id: "rodoviaria",
    label: "Infraestrutura Rodoviária",
    icon: "local_shipping",
    color: "#2E7D32",
    subcategories: ["Rodovias federais", "Rodovias estaduais"],
  },
  {
    id: "ferroviaria",
    label: "Infraestrutura Ferroviária",
    icon: "train",
    color: "#E53935",
    subcategories: ["Malha ferroviária de carga"],
  },
];

// Detailed indicators for "Desastres Geo-hidrológicos" (primary focus)
// Based on AdaptaBrasil IPCC conceptual framework:
// Risco = f(Vulnerabilidade, Exposição, Ameaça)
// Vulnerabilidade = f(Sensibilidade, Capacidade Adaptativa)
const ADAPTABRASIL_GEO_INDICATORS = {
  // Root indicator
  root: {
    id: "deslizamento",
    label: "Índice de risco para deslizamento de terra",
    description: "Risco de impacto das mudanças climáticas em sistemas socioecológicos, considerando a ameaça de desastre geo-hidrológico no evento de deslizamento de terra.",
    value: 0.67,
    trend: "up",
    composition: [
      { id: "vulnerabilidade", label: "Vulnerabilidade", value: 0.58 },
      { id: "exposicao", label: "Exposição", value: 0.43 },
      { id: "ameaca", label: "Ameaça", value: 0.82 },
    ],
    factors: [
      { label: "Jovens sem ensino médio concluído até os 19 anos de idade", weight: 7.0 },
      { label: "População com demandas especiais em situação de desastres", weight: 5.3 },
      { label: "Renda municipal apropriada pelos 20% mais pobres", weight: 5.2 },
      { label: "Nível de implementação e articulação do plano municipal de saneamento básico", weight: 4.4 },
      { label: "Instrumentos de gestão de ocupação urbana em áreas de risco de deslizamento de terra", weight: 4.4 },
      { label: "Ações adaptativas para redução de risco em situações de desastre de deslizamento de terra", weight: 4.4 },
      { label: "Plano de contingência para desastre de deslizamento de terra", weight: 4.4 },
      { label: "Índice firjan de gestão fiscal", weight: 3.1 },
      { label: "Inacessibilidade às cidades", weight: 3.1 },
      { label: "Programa cidades resilientes", weight: 3.0 },
      { label: "Nível de falta de acesso ao saneamento básico", weight: 2.1 },
      { label: "Proporção de domicílios inadequados ou semi-inadequados", weight: 2.1 },
      { label: "Investimento per capita em políticas de adaptação e infraestrutura para proteção ambiental", weight: 1.8 },
      { label: "Governança em meio ambiente", weight: 1.7 },
      { label: "Governança em habitação", weight: 1.4 },
      { label: "Sistemas de alerta antecipado para desastres de deslizamento de terra", weight: 0.9 },
      { label: "Índice firjan de desenvolvimento municipal de emprego e renda", weight: 0.7 },
      { label: "Governança em transporte", weight: 0.6 },
      { label: "Legislação de zoneamento e uso e ocupação do solo", weight: 0.0 },
      { label: "Inexistência de manejo de águas pluviais", weight: 0.0 },
      { label: "Produto interno bruto por área urbana", weight: 0.0 },
      { label: "Falta de mobilidade urbana", weight: 0.0 },
    ],
  },

  // Vulnerabilidade breakdown
  vulnerabilidade: {
    id: "vulnerabilidade",
    label: "Índice de vulnerabilidade",
    description: "Grau em que um sistema socioecológico é potencialmente modificado ou afetado por desastres geo-hidrológicos.",
    value: 0.58,
    parent: "root",
    composition: [
      { id: "sensibilidade", label: "Sensibilidade", value: 0.51 },
      { id: "capacidade", label: "Capacidade Adaptativa", value: 0.42 },
    ],
  },

  sensibilidade: {
    id: "sensibilidade",
    label: "Sensibilidade",
    description: "Grau em que um sistema socioecológico é potencialmente modificado ou afetado por desastres geo-hidrológicos.",
    value: 0.51,
    parent: "vulnerabilidade",
    composition: [
      { id: "populacao", label: "População", value: 0.51 },
      { id: "infraestrutura", label: "Infraestrutura", value: 0.34 },
    ],
  },

  populacao: {
    id: "populacao",
    label: "Condições socioeconômicas e demografia da população",
    description: "Fatores populacionais que contribuem para a sensibilidade da população em situações de desastre de deslizamento de terra.",
    value: 0.51,
    parent: "sensibilidade",
    composition: [
      { id: "demandas_especiais", label: "População com demandas especiais", value: 0.58 },
      { id: "jovens", label: "Jovens sem ensino médio", value: 0.62 },
      { id: "desigualdade", label: "Desigualdade de renda", value: 0.47 },
      { id: "domicilios_inadequados", label: "Domicílios inadequados", value: 0.38 },
    ],
  },

  // Exposição breakdown
  exposicao: {
    id: "exposicao",
    label: "Índice de exposição",
    description: "Exposição da população ao desastre geo-hidrológico de deslizamento de terra.",
    value: 0.43,
    parent: "root",
    composition: [
      { id: "moradias", label: "Moradias em ambiente de risco", value: 0.42 },
      { id: "densidade", label: "Densidade demográfica", value: 0.44 },
    ],
    factors: [
      { label: "Proporção de domicílios em áreas de risco", weight: 51.5 },
      { label: "Densidade da população em áreas urbanizadas", weight: 48.5 },
    ],
  },

  moradias: {
    id: "moradias",
    label: "Moradias em ambiente de risco",
    description: "Domicílios particulares permanentes expostos a desastres naturais.",
    value: 0.42,
    parent: "exposicao",
    composition: [
      { id: "domicilios_risco", label: "Domicílios em áreas de risco", value: 0.42 },
    ],
  },

  domicilios_risco: {
    id: "domicilios_risco",
    label: "Proporção de domicílios em áreas de risco",
    description: "Domicílios particulares permanentes expostos a desastres naturais.",
    value: 0.42,
    parent: "moradias",
    leaf: true,
  },

  densidade: {
    id: "densidade",
    label: "Densidade populacional",
    description: "Número de habitantes, por área do município, potencialmente expostos às adversidades de uma situação de escassez hídrica.",
    value: 0.44,
    parent: "exposicao",
    leaf: true,
  },

  // Ameaça
  ameaca: {
    id: "ameaca",
    label: "Índice de ameaça",
    description: "Ameaça geo-hidrológica de deslizamento de terra estimada a partir de modelos climáticos e características do terreno.",
    value: 0.82,
    parent: "root",
    composition: [
      { id: "chuva_intensa", label: "Chuva intensa acumulada", value: 0.85 },
      { id: "declividade", label: "Declividade do terreno", value: 0.78 },
      { id: "tipo_solo", label: "Tipo de solo", value: 0.71 },
    ],
  },
};

export const ADAPTABRASIL = { LEVELS: ADAPTABRASIL_LEVELS, TYPES: ADAPTABRASIL_TYPES, GEO: ADAPTABRASIL_GEO_INDICATORS };
export type AdaptaBrasilData = typeof ADAPTABRASIL;
