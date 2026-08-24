// ─────────────────────────────────────────────────────────────
// MOCK.TS — Base de dados mockada do Gardian (Porto Seguro/BA)
// Usada enquanto o backend não está integrado.
// Todas as telas novas e os incrementos das existentes leem daqui.
// ─────────────────────────────────────────────────────────────

/* ═══════════ ZONAS (formato da API) ═══════════ */

export interface MockZona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
  area: GeoJSON.Polygon | null;
}

export const MOCK_ZONAS: MockZona[] = [
  { id: 1, nome: "Zona Sul — Orla", descricao: "Encostas íngremes em área densamente povoada. Histórico recente de deslizamentos.", tipo: "urbana", status: "critico", area: null },
  { id: 2, nome: "Vila Esperança — Setor B", descricao: "Encostas ativas com sensores de fibra ótica. Monitoramento contínuo de fissuras.", tipo: "urbana", status: "critico", area: null },
  { id: 3, nome: "Vale das Acácias", descricao: "Zona rural com córrego principal. Histórico de alagamentos em vias marginais.", tipo: "rural", status: "atencao", area: null },
  { id: 4, nome: "Morro da Esperança", descricao: "Comunidade em encosta com ocupação irregular. Prioridade máxima.", tipo: "urbana", status: "atencao", area: null },
  { id: 5, nome: "Centro Industrial", descricao: "Zona industrial planificada. Baixíssimo risco geológico.", tipo: "urbana", status: "estavel", area: null },
  { id: 6, nome: "Zona Rural Norte", descricao: "Predominantemente agrícola. Monitoramento via satélite GOES-16.", tipo: "rural", status: "estavel", area: null },
];

export const zonaNome = (id: number | null | undefined) =>
  MOCK_ZONAS.find((z) => z.id === id)?.nome ?? (id != null ? `Zona #${id}` : "—");

/* ═══════════ EQUIPE / TÉCNICOS ═══════════ */

export type Hierarquia = "coordenador" | "supervisor" | "tecnico";

export interface MockTecnico {
  id: number;
  nome: string;
  cargo: string;
  hierarquia: Hierarquia;
  matricula: string;
  zonaBase: number;
  statusCampo: "em_campo" | "disponivel" | "offline";
  atendimentos30d: number;
  telefone: string;
}

export const MOCK_TECNICOS: MockTecnico[] = [
  { id: 101, nome: "Carlos Menezes", cargo: "Coordenador de Defesa Civil", hierarquia: "coordenador", matricula: "DC-0001", zonaBase: 5, statusCampo: "disponivel", atendimentos30d: 6, telefone: "(73) 99911-0001" },
  { id: 102, nome: "Renata Alves", cargo: "Supervisora Geotécnica", hierarquia: "supervisor", matricula: "DC-0104", zonaBase: 1, statusCampo: "em_campo", atendimentos30d: 14, telefone: "(73) 99911-0104" },
  { id: 103, nome: "João Batista", cargo: "Técnico de Campo", hierarquia: "tecnico", matricula: "DC-0212", zonaBase: 2, statusCampo: "em_campo", atendimentos30d: 22, telefone: "(73) 99911-0212" },
  { id: 104, nome: "Marina Souza", cargo: "Técnica Hidrológica", hierarquia: "tecnico", matricula: "DC-0218", zonaBase: 3, statusCampo: "em_campo", atendimentos30d: 18, telefone: "(73) 99911-0218" },
  { id: 105, nome: "Pedro Lima", cargo: "Técnico de Campo", hierarquia: "tecnico", matricula: "DC-0231", zonaBase: 4, statusCampo: "disponivel", atendimentos30d: 11, telefone: "(73) 99911-0231" },
  { id: 106, nome: "Aline Rocha", cargo: "Técnica de Vistoria", hierarquia: "tecnico", matricula: "DC-0244", zonaBase: 1, statusCampo: "offline", atendimentos30d: 9, telefone: "(73) 99911-0244" },
];

export const tecnicoNome = (id: number | null | undefined) =>
  MOCK_TECNICOS.find((t) => t.id === id)?.nome ?? (id != null ? `Técnico #${id}` : "—");

/* ═══════════ EVENTOS ═══════════ */

export interface MockEvento {
  id: number;
  nome: string;
  tipo: string;
  status: "ativo" | "monitorando" | "encerrado";
  vinculacaoAtiva: boolean; // toda ocorrência enviada no período é vinculada
  inicio: string;
  fim: string | null;
  zonas: number[];
  resumoPublico: string;
  recomendacoes: string[];
  timeline: { hora: string; titulo: string; detalhe: string; nivel: "info" | "atencao" | "critico" }[];
  rotaIA: {
    prioridade: string;
    paradas: {
      ordem: number;
      local: string;
      motivo: string;
      eta: string;
      lat: number;
      lng: number;
      prioridade: "pessoas_risco" | "zona_alto_indice" | "demais";
      ocorrenciaId: number | null;
    }[];
    distanciaTotal: string;
    tempoEstimado: string;
  };
  tempoReal: { hora: string; origem: "campo" | "sistema" | "cidadao"; autor: string; msg: string }[];
}

export const MOCK_EVENTOS: MockEvento[] = [
  {
    id: 1,
    nome: "Chuvas Intensas — Frente Fria Jul/26",
    tipo: "Climático · Alagamentos e deslizamentos",
    status: "ativo",
    vinculacaoAtiva: true,
    inicio: "2026-07-26T06:00:00",
    fim: null,
    zonas: [1, 2, 4],
    resumoPublico:
      "Chuvas intensas atingem a região desde a madrugada de domingo. Áreas de encosta na Zona Sul, Vila Esperança e Morro da Esperança estão sob alerta de deslizamento.",
    recomendacoes: [
      "Evite trafegar por vias alagadas — 30 cm de água já arrastam um veículo.",
      "Moradores de encosta: ao notar rachaduras, portas emperrando ou estalos, saia do imóvel e acione 199.",
      "Não descarte lixo em bueiros e canais de drenagem.",
      "Pontos de apoio abertos: Escola Municipal da Orla e Ginásio do Centro.",
    ],
    timeline: [
      { hora: "26/07 06:12", titulo: "Evento criado pela IA", detalhe: "Correlação CPTEC + CEMADEN indicou janela de chuva ≥ 90mm/24h.", nivel: "info" },
      { hora: "26/07 09:40", titulo: "1ª ocorrência vinculada", detalhe: "Alagamento na Av. Beira Mar validado por câmera CT-04.", nivel: "atencao" },
      { hora: "26/07 14:20", titulo: "Pico de registros", detalhe: "11 ocorrências em 2h — padrão semelhante ao evento de Eunápolis/25.", nivel: "critico" },
      { hora: "27/07 08:00", titulo: "Equipes mobilizadas", detalhe: "3 equipes em campo seguindo rota otimizada pela IA.", nivel: "info" },
      { hora: "28/07 07:30", titulo: "Chuva em redução", detalhe: "Acumulado caiu para 4mm/h. Monitoramento de solo mantido por 48h.", nivel: "info" },
    ],
    rotaIA: {
      prioridade: "1º pessoas em área de risco · 2º zonas de alto índice · 3º demais",
      paradas: [
        { ordem: 1, local: "Rua das Tulipas, 88 — Vila Esperança", motivo: "Família em imóvel com rachaduras ativas (área de risco R3)", eta: "08:15", lat: -16.4392, lng: -39.0705, prioridade: "pessoas_risco", ocorrenciaId: 9001 },
        { ordem: 2, local: "Rua do Cajueiro, 203 — Morro da Esperança", motivo: "Família com 2 crianças, água invadindo residência", eta: "09:00", lat: -16.4310, lng: -39.0790, prioridade: "pessoas_risco", ocorrenciaId: 9004 },
        { ordem: 3, local: "Trav. da Encosta, 12 — Zona Sul", motivo: "Zona de alto índice histórico · muro de contenção comprometido", eta: "10:05", lat: -16.4551, lng: -39.0648, prioridade: "zona_alto_indice", ocorrenciaId: 9002 },
        { ordem: 4, local: "Rua Alta do Setor 7, 45 — Vila Esperança", motivo: "Zona de alto índice · reavaliação de fissura em observação", eta: "10:45", lat: -16.4360, lng: -39.0668, prioridade: "zona_alto_indice", ocorrenciaId: 9007 },
        { ordem: 5, local: "Av. Beira Mar, 1450 — Zona Sul", motivo: "Alagamento em via arterial, sem pessoas em risco", eta: "11:30", lat: -16.4463, lng: -39.0621, prioridade: "demais", ocorrenciaId: 9003 },
      ],
      distanciaTotal: "27,8 km",
      tempoEstimado: "3h30 (com vistorias)",
    },
    tempoReal: [
      { hora: "07:42", origem: "campo", autor: "João Batista", msg: "Chegamos à Rua das Tulipas. Família de 4 pessoas retirada preventivamente. Rachadura de ~2cm em progressão." },
      { hora: "08:03", origem: "sistema", autor: "Pluviômetro CEM-2104", msg: "Acumulado 12h: 84,2mm — acima do limiar de alerta da Vila Esperança (65mm)." },
      { hora: "08:31", origem: "cidadao", autor: "Formulário público", msg: "Novo relato: água entrando em residência na Rua do Cajueiro (vinculado automaticamente ao evento)." },
      { hora: "09:12", origem: "campo", autor: "Renata Alves", msg: "Vistoria no muro da Trav. da Encosta concluída. Interditados 2 imóveis. Solicito lona e escoramento." },
    ],
  },
  {
    id: 2,
    nome: "Enxurrada Eunápolis — Referência",
    tipo: "Climático · Enxurrada urbana",
    status: "encerrado",
    vinculacaoAtiva: false,
    inicio: "2025-11-14T04:00:00",
    fim: "2025-11-17T18:00:00",
    zonas: [2, 4],
    resumoPublico: "Evento encerrado. Enxurrada com 38 ocorrências registradas em 72h.",
    recomendacoes: [],
    timeline: [
      { hora: "14/11 04:20", titulo: "Início do evento", detalhe: "Chuva de 110mm em 3h.", nivel: "critico" },
      { hora: "14/11 12:00", titulo: "38 ocorrências agrupadas", detalhe: "Maior volume da história do sistema.", nivel: "critico" },
      { hora: "17/11 18:00", titulo: "Evento encerrado", detalhe: "Relatório final emitido.", nivel: "info" },
    ],
    rotaIA: { prioridade: "—", paradas: [], distanciaTotal: "—", tempoEstimado: "—" },
    tempoReal: [],
  },
];

/* ═══════════ OCORRÊNCIAS (formato API + extras) ═══════════ */

export interface MockAnexo { nome: string; tipo: "foto" | "video" | "documento"; tamanho: string }

export interface MockOcorrencia {
  id: number;
  entidade: number;
  zona: number | null;
  autor: number | null;
  autorNome: string;
  titulo: string;
  categoria: string;
  status: "em_analise" | "alta_prioridade" | "em_andamento" | "aguardando" | "concluido";
  coordenadas: { lat: number; lng: number } | null;
  endereco: string;
  descricao: string;
  nivel_perigo_ia: string | null;
  analise_ia: string | null;
  valido_ia: boolean;
  feito_ia: boolean;
  tecnico_responsavel: number | null;
  nivel_perigo_tecnico: string | null;
  analise_tecnico: string | null;
  valido_tecnico: boolean | null;
  created_at: string;
  anexos: MockAnexo[];
  evento: number | null;
}

export const MOCK_OCORRENCIAS: MockOcorrencia[] = [
  {
    id: 9001, entidade: 1, zona: 2, autor: null, autorNome: "Maria L. (cidadã)",
    titulo: "Rachaduras estruturais — encosta sul",
    categoria: "geologico", status: "em_andamento",
    coordenadas: { lat: -16.4392, lng: -39.0705 },
    endereco: "Rua das Tulipas, 88 — Vila Esperança, Setor B, Porto Seguro/BA, 45810-000",
    descricao: "Moradora relatou rachaduras novas no muro de contenção, com umidade nas paredes do imóvel vizinho e estalos desde a madrugada.",
    nivel_perigo_ia: "R3", analise_ia: "Cruzamento de relato, saturação de solo em 88% e previsão de 45mm/h indica risco elevado de movimentação de massa nas próximas horas.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 103, nivel_perigo_tecnico: "R3", analise_tecnico: "Rachadura ativa confirmada em vistoria. Família retirada preventivamente.", valido_tecnico: true,
    created_at: "2026-07-27T14:32:00",
    anexos: [
      { nome: "rachadura_muro.jpg", tipo: "foto", tamanho: "2,1 MB" },
      { nome: "video_estalos.mp4", tipo: "video", tamanho: "14,8 MB" },
    ],
    evento: 1,
  },
  {
    id: 9002, entidade: 1, zona: 1, autor: null, autorNome: "Renata Alves (equipe)",
    titulo: "Muro de contenção comprometido",
    categoria: "geologico", status: "em_andamento",
    coordenadas: { lat: -16.4551, lng: -39.0648 },
    endereco: "Travessa da Encosta, 12 — Zona Sul (Orla), Porto Seguro/BA, 45810-000",
    descricao: "Deslocamento visível na base do muro de arrimo após chuva contínua. Três imóveis vizinhos potencialmente afetados.",
    nivel_perigo_ia: "R3", analise_ia: "Estrutura em zona com histórico de deslizamento (2024). Recomendada interdição preventiva.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 102, nivel_perigo_tecnico: "R4", analise_tecnico: "Interditados 2 imóveis. Escoramento emergencial solicitado.", valido_tecnico: true,
    created_at: "2026-07-27T09:10:00",
    anexos: [
      { nome: "laudo_preliminar.pdf", tipo: "documento", tamanho: "480 KB" },
      { nome: "muro_deslocamento.jpg", tipo: "foto", tamanho: "2,4 MB" },
      { nome: "interdicao_imoveis.jpg", tipo: "foto", tamanho: "1,8 MB" },
    ],
    evento: 1,
  },
  {
    id: 9003, entidade: 1, zona: 1, autor: null, autorNome: "Ana M. (cidadã)",
    titulo: "Alagamento de via arterial",
    categoria: "climatico", status: "alta_prioridade",
    coordenadas: { lat: -16.4463, lng: -39.0621 },
    endereco: "Av. Beira Mar, 1450 — Zona Sul (Orla), Porto Seguro/BA, 45810-000",
    descricao: "Via interditada por lâmina d'água acima de 60cm. Dois veículos parados e trânsito desviado.",
    nivel_perigo_ia: "R2", analise_ia: "Compatível com acumulado de 28,4mm/3h e drenagem saturada. Câmera CT-04 confirma.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 104, nivel_perigo_tecnico: null, analise_tecnico: null, valido_tecnico: null,
    created_at: "2026-07-28T07:58:00",
    anexos: [
      { nome: "foto_via.jpg", tipo: "foto", tamanho: "1,4 MB" },
      { nome: "camera_ct04.mp4", tipo: "video", tamanho: "22,3 MB" },
    ],
    evento: 1,
  },
  {
    id: 9004, entidade: 1, zona: 4, autor: null, autorNome: "Formulário público",
    titulo: "Água entrando em residência",
    categoria: "climatico", status: "em_analise",
    coordenadas: { lat: -16.4310, lng: -39.0790 },
    endereco: "Rua do Cajueiro, 203 — Morro da Esperança, Porto Seguro/BA, 45810-000",
    descricao: "Relato via formulário público: água invadindo residência pelos fundos, família com 2 crianças no local.",
    nivel_perigo_ia: "R2", analise_ia: "Padrão de escoamento superficial da encosta. Prioridade por presença de crianças.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: null, nivel_perigo_tecnico: null, analise_tecnico: null, valido_tecnico: null,
    created_at: "2026-07-28T08:31:00",
    anexos: [
      { nome: "quintal_alagado.jpg", tipo: "foto" as const, tamanho: "1,7 MB" },
      { nome: "audio_relato.m4a", tipo: "documento" as const, tamanho: "620 KB" },
    ],
    evento: 1,
  },
  {
    id: 9005, entidade: 1, zona: 3, autor: null, autorNome: "Sr. Osvaldo (cidadão)",
    titulo: "Queda de árvore sobre via rural",
    categoria: "vias_publicas", status: "concluido",
    coordenadas: { lat: -16.4188, lng: -39.1102 },
    endereco: "Estrada do Vale, km 4 — Vale das Acácias, Porto Seguro/BA, 45810-000",
    descricao: "Árvore de grande porte caiu bloqueando a estrada vicinal. Sem feridos.",
    nivel_perigo_ia: "R1", analise_ia: "Baixo risco. Encaminhado para remoção.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 105, nivel_perigo_tecnico: "R1", analise_tecnico: "Remoção concluída às 16h. Via liberada.", valido_tecnico: true,
    created_at: "2026-07-25T13:05:00",
    anexos: [
      { nome: "arvore_removida.jpg", tipo: "foto", tamanho: "1,9 MB" },
      { nome: "via_liberada.jpg", tipo: "foto", tamanho: "1,1 MB" },
    ],
    evento: null,
  },
  {
    id: 9006, entidade: 1, zona: 5, autor: null, autorNome: "Portaria fabril",
    titulo: "Vazamento de óleo em galpão",
    categoria: "produtos_perigosos", status: "concluido",
    coordenadas: { lat: -16.4402, lng: -39.0880 },
    endereco: "Rod. BR-367, Galpão 7 — Centro Industrial, Porto Seguro/BA, 45810-000",
    descricao: "Pequeno vazamento contido pela brigada interna. Solicitada vistoria de rotina.",
    nivel_perigo_ia: "R1", analise_ia: "Contenção adequada. Sem risco ambiental imediato.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 106, nivel_perigo_tecnico: "R1", analise_tecnico: "Vistoria concluída. Empresa notificada para manutenção preventiva.", valido_tecnico: true,
    created_at: "2026-07-22T10:40:00",
    anexos: [
      { nome: "contencao_brigada.jpg", tipo: "foto" as const, tamanho: "1,2 MB" },
      { nome: "ficha_emergencia_oleo.pdf", tipo: "documento" as const, tamanho: "310 KB" },
    ],
    evento: null,
  },
  {
    id: 9007, entidade: 1, zona: 2, autor: null, autorNome: "João Batista (equipe)",
    titulo: "Monitoramento de fissura — Setor 7",
    categoria: "geologico", status: "aguardando",
    coordenadas: { lat: -16.4360, lng: -39.0668 },
    endereco: "Rua Alta do Setor 7, 45 — Vila Esperança, Porto Seguro/BA, 45810-000",
    descricao: "Fissura estável em observação. Reavaliar após próxima janela de chuva.",
    nivel_perigo_ia: "R2", analise_ia: "Sem progressão nas últimas 72h. Manter observação.", valido_ia: true, feito_ia: true,
    tecnico_responsavel: 103, nivel_perigo_tecnico: "R2", analise_tecnico: "Marcadores de gesso instalados para acompanhar progressão.", valido_tecnico: true,
    created_at: "2026-07-24T15:20:00",
    anexos: [
      { nome: "marcadores.jpg", tipo: "foto", tamanho: "980 KB" },
      { nome: "medicao_fissura.pdf", tipo: "documento", tamanho: "220 KB" },
    ],
    evento: null,
  },
];

/* ═══════════ POSSÍVEIS EVENTOS (previsões da IA) ═══════════ */

export interface PossivelEvento {
  id: number;
  titulo: string;
  zona: number;
  confianca: number;
  janela: string;
  base: string[];           // base/fundamentação para o possível evento
  similares: string[];      // eventos passados nas mesmas condições
  status: "pendente" | "aprovado" | "descartado";
}

export const MOCK_POSSIVEIS_EVENTOS: PossivelEvento[] = [
  {
    id: 501,
    titulo: "Deslizamento em encosta — Vila Esperança",
    zona: 2, confianca: 92.4, janela: "Próximas 6h",
    base: ["Saturação de solo em 88% (limiar 75%)", "CEMADEN: 84mm acumulados/12h", "Relato cidadão com rachaduras ativas", "Histórico: 3 deslizamentos na zona desde 2022"],
    similares: ["Deslizamento R3 — Vila Esperança, mar/2024 (condições 91% semelhantes)", "Queda de barreira — Zona Sul, nov/2022"],
    status: "pendente",
  },
  {
    id: 502,
    titulo: "Transbordo do Córrego das Acácias",
    zona: 3, confianca: 71.8, janela: "12–24h",
    base: ["CPTEC prevê 60mm nas próximas 24h", "Pluviômetro rural: solo próximo da capacidade", "Vazão do córrego 40% acima da média"],
    similares: ["Transbordo do córrego — Vale das Acácias, 2023 (95mm/2h)"],
    status: "pendente",
  },
  {
    id: 503,
    titulo: "Ressaca e maré alta — Orla",
    zona: 1, confianca: 64.2, janela: "48h",
    base: ["Marinha: ondas de 2,5m previstas", "Maré de sizígia em 30/07", "Vento SE constante 28 km/h"],
    similares: ["Ressaca com avanço do mar — Orla, ago/2024"],
    status: "pendente",
  },
];

/* ═══════════ GRANDE RELATÓRIO DE IA ═══════════ */

export const MOCK_AI_REPORT = {
  geradoEm: "28/07/2026 08:45",
  versao: "GDN-IA v3.2",
  resumo:
    "A frente fria que atua sobre o litoral sul da Bahia desde 26/07 mantém a operação em estado de alerta. O acumulado de 84mm/12h na Vila Esperança superou o limiar crítico da zona (65mm), e a saturação de solo segue em 88%. O padrão observado tem 91% de similaridade com o evento de março/2024, que resultou em deslizamento R3. Recomenda-se manter equipes mobilizadas e aprovar o possível evento nº 501 para conversão em ocorrência preventiva.",
  estatisticas: [
    { label: "Ocorrências ativas", valor: "4", sub: "não concluídas · últimas 48h" },
    { label: "Acumulado Máx. 12h", valor: "84,2mm", sub: "Pluviômetro CEM-2104" },
    { label: "Saturação de solo", valor: "88%", sub: "Vila Esperança" },
    { label: "Similaridade Histórico", valor: "91%", sub: "vs. evento mar/2024" },
    { label: "Famílias em área de risco", valor: "23", sub: "zonas 1, 2 e 4" },
    { label: "Confiança média do modelo", valor: "76,1%", sub: "3 previsões ativas" },
  ],
  indicadoresConsiderados: [
    { nome: "Pluviometria observada (CEMADEN)", peso: 0.30, leitura: "84,2mm/12h", estado: "critico" },
    { nome: "Previsão CPTEC 24h", peso: 0.20, leitura: "60mm", estado: "atencao" },
    { nome: "Previsão INMET 24h", peso: 0.10, leitura: "52mm", estado: "atencao" },
    { nome: "Saturação de solo", peso: 0.20, leitura: "88%", estado: "critico" },
    { nome: "Histórico geológico da zona", peso: 0.12, leitura: "3 eventos/4 anos", estado: "atencao" },
    { nome: "Relatos da população", peso: 0.08, leitura: "4 relatos/24h", estado: "atencao" },
  ],
  eventosSimilares: [
    { nome: "Deslizamento R3 — Vila Esperança", data: "mar/2024", similaridade: 91, desfecho: "450m³ deslocados, 12 residências afetadas, 0 vítimas (evacuação preventiva)" },
    { nome: "Enxurrada de Eunápolis", data: "nov/2025", similaridade: 78, desfecho: "38 ocorrências em 72h, 2 pontes interditadas" },
    { nome: "Alagamento da via marginal", data: "2023", similaridade: 62, desfecho: "Transbordo após 120mm/24h, sem danos estruturais" },
  ],
};

/* ═══════════ MONITORAMENTO — RESUMO POR ZONA ═══════════ */

export interface ResumoZona {
  zona: number;
  status: "critico" | "atencao" | "estavel";
  resumo: string;
  possiveisEventos: number[]; // ids de MOCK_POSSIVEIS_EVENTOS
}

export const MOCK_RESUMO_ZONAS: ResumoZona[] = [
  { zona: 2, status: "critico", resumo: "Saturação de solo em 88% e rachaduras ativas no Setor B. Duas ocorrências em andamento com equipe no local.", possiveisEventos: [501] },
  { zona: 1, status: "critico", resumo: "Alagamento ativo na Av. Beira Mar e muro de contenção interditado. Ressaca prevista para 48h.", possiveisEventos: [503] },
  { zona: 4, status: "atencao", resumo: "Escoamento superficial atingindo residências. Um relato do formulário público em análise.", possiveisEventos: [] },
  { zona: 3, status: "atencao", resumo: "Vazão do córrego 40% acima da média. Transbordo possível na janela de 12–24h.", possiveisEventos: [502] },
  { zona: 5, status: "estavel", resumo: "Sem registros ativos. Vistoria de rotina concluída no dia 22/07.", possiveisEventos: [] },
  { zona: 6, status: "estavel", resumo: "Solo com umidade dentro da normalidade. Monitoramento padrão via satélite.", possiveisEventos: [] },
];

/* ═══════════ METEOROLOGIA — 3 ÓRGÃOS + PLUVIÔMETROS ═══════════ */

// Previsões dos órgãos. O dado REAL disponível é apenas a chuva acumulada,
// medida pelos pluviômetros do CEMADEN (MOCK_PLUVIOMETROS).
// Previsões dos órgãos. O dado REAL disponível é apenas a chuva acumulada,
// medida pelos pluviômetros do CEMADEN (ver MOCK_PLUVIOMETROS).
export const MOCK_METEO_ORGAOS = [
  {
    id: "inmet",
    nome: "INMET",
    fonte: "Estação A413 — Porto Seguro",
    atualizado: "08:00",
    previsao: "Chuva moderada a forte",
    icone: "rainy",
    chanceChuva: 85,
    precipitacao: 52,
    vento: 24,
    ventoDir: "SE",
    umidade: 90,
    tempMin: 21,
    tempMax: 26,
  },
  {
    id: "cptec",
    nome: "CPTEC/INPE",
    fonte: "Modelo WRF 5km",
    atualizado: "06:00",
    previsao: "Pancadas com trovoadas",
    icone: "thunderstorm",
    chanceChuva: 92,
    precipitacao: 60,
    vento: 28,
    ventoDir: "SE",
    umidade: 92,
    tempMin: 20,
    tempMax: 25,
  },
  {
    id: "cemaden",
    nome: "CEMADEN",
    fonte: "Rede de pluviômetros automáticos",
    atualizado: "08:40",
    previsao: "Chuva persistente",
    icone: "water_drop",
    chanceChuva: 88,
    precipitacao: 55,
    vento: 26,
    ventoDir: "S",
    umidade: 93,
    tempMin: 21,
    tempMax: 25,
  },
];

// Pluviômetros coletados do painel interativo do CEMADEN (via scrapper)
export const MOCK_PLUVIOMETROS = [
  { codigo: "CEM-2104", nome: "Vila Esperança", zona: 2, mm1h: 6.4, mm6h: 41.8, mm12h: 84.2, mm24h: 96.0, status: "critico" as const, ultimaLeitura: "08:40" },
  { codigo: "CEM-2088", nome: "Orla — Centro", zona: 1, mm1h: 4.2, mm6h: 33.0, mm12h: 71.6, mm24h: 88.4, status: "critico" as const, ultimaLeitura: "08:40" },
  { codigo: "CEM-2110", nome: "Morro da Esperança", zona: 4, mm1h: 5.0, mm6h: 36.2, mm12h: 74.8, mm24h: 90.2, status: "atencao" as const, ultimaLeitura: "08:30" },
  { codigo: "CEM-2131", nome: "Vale das Acácias", zona: 3, mm1h: 2.8, mm6h: 21.4, mm12h: 44.0, mm24h: 58.6, status: "atencao" as const, ultimaLeitura: "08:40" },
  { codigo: "CEM-2145", nome: "Rural Norte", zona: 6, mm1h: 0.8, mm6h: 8.2, mm12h: 16.4, mm24h: 22.0, status: "estavel" as const, ultimaLeitura: "08:20" },
];

/* ═══════════ GEOLOGIA POR ZONA ═══════════ */

export interface GeologiaZona {
  zona: number;
  litologia: string;
  tipoSolo: string;
  declividade: string;
  suscetibilidade: "alta" | "media" | "baixa";
  observacoes: string;
}

export const MOCK_GEOLOGIA_ZONAS: GeologiaZona[] = [
  { zona: 1, litologia: "Sedimentos costeiros do Grupo Barreiras", tipoSolo: "Argissolo Amarelo", declividade: "25–45% (encosta)", suscetibilidade: "alta", observacoes: "Falésias e taludes de corte com histórico de queda de blocos." },
  { zona: 2, litologia: "Grupo Barreiras — arenitos argilosos", tipoSolo: "Latossolo Amarelo distrófico", declividade: "30–50%", suscetibilidade: "alta", observacoes: "Ocupação em talude. Sensores de fibra ótica instalados." },
  { zona: 3, litologia: "Depósitos aluvionares quaternários", tipoSolo: "Gleissolo Háplico", declividade: "0–8% (planície)", suscetibilidade: "media", observacoes: "Planície de inundação do Córrego das Acácias." },
];

/* ═══════════ GERENCIAMENTO DE DANOS ═══════════ */

export interface DanoCatalogoItem {
  id: number;
  nome: string;
  categoria: string;
  unidade: string;
  precoUnitario: number;
}

export const MOCK_DANOS_CATALOGO: DanoCatalogoItem[] = [
  { id: 1, nome: "Cesta básica emergencial", categoria: "Assistência humanitária", unidade: "un", precoUnitario: 185.0 },
  { id: 2, nome: "Colchão solteiro", categoria: "Assistência humanitária", unidade: "un", precoUnitario: 240.0 },
  { id: 3, nome: "Lona plástica 4x5m", categoria: "Material de contenção", unidade: "un", precoUnitario: 96.0 },
  { id: 4, nome: "Escoramento de madeira (kit)", categoria: "Material de contenção", unidade: "kit", precoUnitario: 720.0 },
  { id: 5, nome: "Telha de fibrocimento 2,44m", categoria: "Reconstrução", unidade: "un", precoUnitario: 68.0 },
  { id: 6, nome: "Hora de retroescavadeira", categoria: "Maquinário", unidade: "h", precoUnitario: 310.0 },
  { id: 7, nome: "Caminhão-pipa (viagem)", categoria: "Maquinário", unidade: "viagem", precoUnitario: 450.0 },
  { id: 8, nome: "Kit higiene familiar", categoria: "Assistência humanitária", unidade: "un", precoUnitario: 74.0 },
];

export interface DanoRegistro {
  id: number;
  ocorrenciaId: number;
  itens: { catalogoId: number; quantidade: number }[];
  registradoPor: number; // técnico
  registradoEm: string;
}

export const MOCK_DANOS_REGISTROS: DanoRegistro[] = [
  { id: 1, ocorrenciaId: 9001, itens: [{ catalogoId: 1, quantidade: 2 }, { catalogoId: 2, quantidade: 4 }, { catalogoId: 3, quantidade: 3 }, { catalogoId: 8, quantidade: 2 }], registradoPor: 103, registradoEm: "2026-07-27T18:10:00" },
  { id: 2, ocorrenciaId: 9002, itens: [{ catalogoId: 4, quantidade: 2 }, { catalogoId: 3, quantidade: 6 }], registradoPor: 102, registradoEm: "2026-07-27T19:40:00" },
  { id: 3, ocorrenciaId: 9003, itens: [{ catalogoId: 6, quantidade: 3 }, { catalogoId: 7, quantidade: 1 }], registradoPor: 104, registradoEm: "2026-07-28T11:05:00" },
  { id: 4, ocorrenciaId: 9005, itens: [{ catalogoId: 6, quantidade: 2 }], registradoPor: 105, registradoEm: "2026-07-25T17:00:00" },
];

/* ═══════════ FAMÍLIAS ═══════════ */

export interface MockFamilia {
  id: number;
  responsavel: string;
  telefone: string;
  zona: number;
  endereco: string;
  coordenadas: { lat: number; lng: number };
  areaDeRisco: boolean;
  membros: { nome: string; idade: number; parentesco: string }[];
  animais: { nome: string; especie: string }[];
  ocorrencias: number[]; // ids de ocorrências relacionadas
  eventosAtingida: number[]; // ids de eventos
}

export const MOCK_FAMILIAS: MockFamilia[] = [
  {
    id: 1, responsavel: "Maria Lúcia Santos", telefone: "(73) 98822-1010", zona: 2,
    endereco: "Rua das Tulipas, 88 — Vila Esperança", coordenadas: { lat: -16.4392, lng: -39.0705 }, areaDeRisco: true,
    membros: [
      { nome: "Maria Lúcia Santos", idade: 46, parentesco: "Responsável" },
      { nome: "José Carlos Santos", idade: 49, parentesco: "Cônjuge" },
      { nome: "Larissa Santos", idade: 15, parentesco: "Filha" },
      { nome: "Miguel Santos", idade: 9, parentesco: "Filho" },
    ],
    animais: [{ nome: "Rex", especie: "Cão" }],
    ocorrencias: [9001], eventosAtingida: [1],
  },
  {
    id: 2, responsavel: "Antônio Ferreira", telefone: "(73) 98822-2020", zona: 1,
    endereco: "Travessa da Encosta, 12 — Zona Sul", coordenadas: { lat: -16.4551, lng: -39.0648 }, areaDeRisco: true,
    membros: [
      { nome: "Antônio Ferreira", idade: 62, parentesco: "Responsável" },
      { nome: "Dalva Ferreira", idade: 58, parentesco: "Cônjuge" },
    ],
    animais: [{ nome: "Mimi", especie: "Gato" }, { nome: "Louro", especie: "Ave" }],
    ocorrencias: [9002], eventosAtingida: [1],
  },
  {
    id: 3, responsavel: "Cláudia Nascimento", telefone: "(73) 98822-3030", zona: 4,
    endereco: "Rua do Cajueiro, 203 — Morro da Esperança", coordenadas: { lat: -16.4310, lng: -39.0790 }, areaDeRisco: true,
    membros: [
      { nome: "Cláudia Nascimento", idade: 34, parentesco: "Responsável" },
      { nome: "Enzo Nascimento", idade: 7, parentesco: "Filho" },
      { nome: "Valentina Nascimento", idade: 4, parentesco: "Filha" },
    ],
    animais: [],
    ocorrencias: [9004], eventosAtingida: [1],
  },
  {
    id: 4, responsavel: "Osvaldo Pereira", telefone: "(73) 98822-4040", zona: 3,
    endereco: "Estrada do Vale, km 4 — Vale das Acácias", coordenadas: { lat: -16.4188, lng: -39.1102 }, areaDeRisco: false,
    membros: [
      { nome: "Osvaldo Pereira", idade: 71, parentesco: "Responsável" },
    ],
    animais: [{ nome: "Estrela", especie: "Cavalo" }, { nome: "Bidu", especie: "Cão" }],
    ocorrencias: [9005], eventosAtingida: [],
  },
  {
    id: 5, responsavel: "Fernanda Ribeiro", telefone: "(73) 98822-5050", zona: 5,
    endereco: "Rua Industrial, 340 — Centro Industrial", coordenadas: { lat: -16.4402, lng: -39.0880 }, areaDeRisco: false,
    membros: [
      { nome: "Fernanda Ribeiro", idade: 29, parentesco: "Responsável" },
      { nome: "Tiago Ribeiro", idade: 31, parentesco: "Cônjuge" },
    ],
    animais: [],
    ocorrencias: [], eventosAtingida: [],
  },
];

/* ═══════════ HISTÓRICO ═══════════ */

export const MOCK_HIST_PREVISOES_TEMPO = [
  { data: "22/07", orgao: "CPTEC", previstoMm: 8, realMm: 5.2, desvio: -2.8 },
  { data: "23/07", orgao: "INMET", previstoMm: 12, realMm: 14.6, desvio: 2.6 },
  { data: "24/07", orgao: "CPTEC", previstoMm: 20, realMm: 18.2, desvio: -1.8 },
  { data: "25/07", orgao: "CEMADEN", previstoMm: 30, realMm: 41.0, desvio: 11.0 },
  { data: "26/07", orgao: "CPTEC", previstoMm: 55, realMm: 62.4, desvio: 7.4 },
  { data: "27/07", orgao: "CEMADEN", previstoMm: 70, realMm: 84.2, desvio: 14.2 },
  { data: "28/07", orgao: "CPTEC", previstoMm: 60, realMm: 81.2, desvio: 21.2 },
];

export interface HistPrevisaoIA {
  id: number;
  titulo: string;
  data: string;
  zona: number;
  confianca: number;
  status: "aprovado" | "descartado" | "pendente";
  desfecho: string;
}

export const MOCK_HIST_PREVISOES_IA: HistPrevisaoIA[] = [
  { id: 501, titulo: "Deslizamento em encosta — Vila Esperança", data: "28/07/2026", zona: 2, confianca: 92.4, status: "pendente", desfecho: "Em avaliação pela coordenação." },
  { id: 502, titulo: "Transbordo do Córrego das Acácias", data: "28/07/2026", zona: 3, confianca: 71.8, status: "pendente", desfecho: "Em avaliação pela coordenação." },
  { id: 503, titulo: "Ressaca e maré alta — Orla", data: "28/07/2026", zona: 1, confianca: 64.2, status: "pendente", desfecho: "Em avaliação pela coordenação." },
  { id: 498, titulo: "Alagamento urbano — Zona Sul", data: "26/07/2026", zona: 1, confianca: 88.0, status: "aprovado", desfecho: "Convertido em ocorrência #9003. Confirmado em campo." },
  { id: 495, titulo: "Queda de barreira — BR-367", data: "24/07/2026", zona: 5, confianca: 41.5, status: "descartado", desfecho: "Vistoria não encontrou indícios. Falso positivo por ruído de sensor." },
  { id: 490, titulo: "Enxurrada — Morro da Esperança", data: "19/07/2026", zona: 4, confianca: 57.0, status: "descartado", desfecho: "Chuva prevista não se confirmou (frente dissipou)." },
];

export interface HistAcaoEquipe {
  id: number;
  tecnico: number;
  acao: string;
  local: string;
  zona: number;
  ocorrenciaId: number | null;
  quando: string;
}

export const MOCK_HIST_ACOES_EQUIPE: HistAcaoEquipe[] = [
  { id: 1, tecnico: 103, acao: "Retirada preventiva de família e instalação de marcadores", local: "Rua das Tulipas, 88", zona: 2, ocorrenciaId: 9001, quando: "28/07 07:42" },
  { id: 2, tecnico: 102, acao: "Vistoria e interdição de 2 imóveis", local: "Travessa da Encosta, 12", zona: 1, ocorrenciaId: 9002, quando: "28/07 09:12" },
  { id: 3, tecnico: 104, acao: "Sinalização de desvio e medição de lâmina d'água", local: "Av. Beira Mar, 1450", zona: 1, ocorrenciaId: 9003, quando: "28/07 08:20" },
  { id: 4, tecnico: 105, acao: "Remoção de árvore e liberação de via", local: "Estrada do Vale, km 4", zona: 3, ocorrenciaId: 9005, quando: "25/07 16:00" },
  { id: 5, tecnico: 106, acao: "Vistoria de rotina em galpão industrial", local: "Rod. BR-367, Galpão 7", zona: 5, ocorrenciaId: 9006, quando: "22/07 14:30" },
  { id: 6, tecnico: 103, acao: "Instalação de marcadores de gesso em fissura", local: "Rua Alta do Setor 7, 45", zona: 2, ocorrenciaId: 9007, quando: "24/07 15:40" },
];

/* ═══════════ ENTIDADE ═══════════ */

export type StatusCidade = "estavel" | "alerta" | "critico";

export const STATUS_CIDADE_META: Record<
  StatusCidade,
  { label: string; descricao: string; icon: string; cor: string; tone: "secondary" | "warning" | "error" }
> = {
  estavel: {
    label: "Estável",
    descricao: "Operação em rotina. Sem eventos ativos ou riscos iminentes identificados.",
    icon: "check_circle",
    cor: "#006A60",
    tone: "secondary",
  },
  alerta: {
    label: "Em Alerta",
    descricao: "Condições de risco identificadas. Equipes em prontidão e monitoramento reforçado.",
    icon: "warning",
    cor: "#C2570B",
    tone: "warning",
  },
  critico: {
    label: "Crítico",
    descricao: "Evento em curso com risco à população. Operação em regime de emergência.",
    icon: "e911_emergency",
    cor: "#BA1A1A",
    tone: "error",
  },
};

export interface MockEntidade {
  id: number;
  nome: string;
  sigla: string;
  cnpj: string;
  municipio: string;
  uf: string;
  responsavel: string;
  cargoResponsavel: string;
  telefone: string;
  email: string;
  endereco: string;
  populacao: number;
  statusCidade: StatusCidade;
  mensagemPublica: string;
}

export const MOCK_ENTIDADE: MockEntidade = {
  id: 1,
  nome: "Coordenadoria Municipal de Proteção e Defesa Civil",
  sigla: "COMPDEC Porto Seguro",
  cnpj: "16.238.847/0001-05",
  municipio: "Porto Seguro",
  uf: "BA",
  responsavel: "Carlos Menezes",
  cargoResponsavel: "Coordenador de Defesa Civil",
  telefone: "(73) 3288-1990",
  email: "defesacivil@portoseguro.ba.gov.br",
  endereco: "Av. dos Navegantes, 500 — Centro, Porto Seguro/BA, 45810-000",
  populacao: 155000,
  statusCidade: "critico",
  mensagemPublica:
    "Município em situação crítica devido às chuvas intensas. Evite deslocamentos desnecessários e acione a Defesa Civil pelo 199 em caso de risco.",
};

export interface StatusCidadeRegistro {
  id: number;
  status: StatusCidade;
  quando: string;
  autor: string;
  motivo: string;
}

export const MOCK_STATUS_HISTORICO: StatusCidadeRegistro[] = [
  { id: 4, status: "critico", quando: "27/07/2026 14:20", autor: "Carlos Menezes", motivo: "Pico de 11 ocorrências em 2h e saturação de solo acima do limiar." },
  { id: 3, status: "alerta", quando: "26/07/2026 06:15", autor: "Cúpula (automático)", motivo: "Previsão de acumulado ≥ 90mm/24h confirmada por CPTEC e CEMADEN." },
  { id: 2, status: "estavel", quando: "18/07/2026 08:00", autor: "Renata Alves", motivo: "Encerramento do monitoramento pós-chuvas de julho." },
  { id: 1, status: "alerta", quando: "15/07/2026 17:40", autor: "Carlos Menezes", motivo: "Frente fria com previsão de chuva persistente." },
];


/* ═══════════ PRESTAÇÃO DE CONTAS ═══════════ */

export interface ContaEvento {
  id: number;
  /** referência a MOCK_EVENTOS quando o evento ainda vive no sistema */
  eventoId: number | null;
  nome: string;
  tipo: string;
  periodo: string;
  exercicio: number;
  ocorrencias: number;
  familiasAtingidas: number;
  /** null = custo calculado a partir dos danos catalogados (evento em curso) */
  custoConsolidado: number | null;
  decretoMunicipal: string | null;
  fonteRecurso: string;
  repasseRecebido: number;
  statusPrestacao: "em_curso" | "em_elaboracao" | "enviada" | "aprovada";
  prazoLimite: string;
  observacao: string;
}

export const MOCK_CONTAS_EVENTOS: ContaEvento[] = [
  {
    id: 1,
    eventoId: 1,
    nome: "Chuvas Intensas — Frente Fria Jul/26",
    tipo: "Climático · Alagamentos e deslizamentos",
    periodo: "26/07/2026 — em curso",
    exercicio: 2026,
    ocorrencias: 4,
    familiasAtingidas: 3,
    custoConsolidado: null,
    decretoMunicipal: "Decreto 4.812/2026 — Situação de Emergência",
    fonteRecurso: "Recurso próprio + FUNCAP (pendente)",
    repasseRecebido: 0,
    statusPrestacao: "em_curso",
    prazoLimite: "30/09/2026",
    observacao: "Custos parciais lançados conforme a catalogação de danos avança.",
  },
  {
    id: 2,
    eventoId: null,
    nome: "Vendaval — Orla e Centro",
    tipo: "Climático · Vendaval",
    periodo: "08/04/2026 — 11/04/2026",
    exercicio: 2026,
    ocorrencias: 17,
    familiasAtingidas: 9,
    custoConsolidado: 63480,
    decretoMunicipal: null,
    fonteRecurso: "Recurso próprio",
    repasseRecebido: 0,
    statusPrestacao: "enviada",
    prazoLimite: "30/06/2026",
    observacao: "Prestação enviada ao controle interno em 22/06/2026, aguardando parecer.",
  },
  {
    id: 3,
    eventoId: null,
    nome: "Deslizamento — Vila Esperança",
    tipo: "Geológico · Movimento de massa",
    periodo: "12/03/2026 — 19/03/2026",
    exercicio: 2026,
    ocorrencias: 12,
    familiasAtingidas: 12,
    custoConsolidado: 118250,
    decretoMunicipal: "Decreto 4.740/2026 — Situação de Emergência",
    fonteRecurso: "Transferência obrigatória — Defesa Civil Nacional",
    repasseRecebido: 90000,
    statusPrestacao: "aprovada",
    prazoLimite: "30/06/2026",
    observacao: "Aprovada sem ressalvas em 04/07/2026.",
  },
  {
    id: 4,
    eventoId: 2,
    nome: "Enxurrada Eunápolis — Referência",
    tipo: "Climático · Enxurrada urbana",
    periodo: "14/11/2025 — 17/11/2025",
    exercicio: 2025,
    ocorrencias: 38,
    familiasAtingidas: 31,
    custoConsolidado: 187430,
    decretoMunicipal: "Decreto 4.601/2025 — Situação de Emergência",
    fonteRecurso: "Transferência obrigatória — Defesa Civil Nacional",
    repasseRecebido: 142000,
    statusPrestacao: "aprovada",
    prazoLimite: "28/02/2026",
    observacao: "Aprovada sem ressalvas em 12/02/2026.",
  },
  {
    id: 5,
    eventoId: null,
    nome: "Ressaca — Avanço do Mar",
    tipo: "Climático · Erosão costeira",
    periodo: "02/08/2025 — 05/08/2025",
    exercicio: 2025,
    ocorrencias: 9,
    familiasAtingidas: 4,
    custoConsolidado: 41900,
    decretoMunicipal: null,
    fonteRecurso: "Recurso próprio",
    repasseRecebido: 0,
    statusPrestacao: "aprovada",
    prazoLimite: "31/12/2025",
    observacao: "Aprovada com ressalva de documentação complementar.",
  },
];

export const STATUS_PRESTACAO_LABEL: Record<ContaEvento["statusPrestacao"], string> = {
  em_curso: "Em curso",
  em_elaboracao: "Em elaboração",
  enviada: "Enviada",
  aprovada: "Aprovada",
};

/* ═══════════ PAINEL — CIDADÃOS CONECTADOS ═══════════ */

export const MOCK_CIDADAOS_CONECTADOS = 1284;

/* ═══════════ HELPERS ═══════════ */

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const STATUS_OCORRENCIA_LABEL: Record<string, string> = {
  aberto: "Aberto",
  resolvido: "Resolvido",
  fechado: "Fechado",
  em_analise: "Em Análise",
  alta_prioridade: "Alta Prioridade",
  em_andamento: "Em Andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  concluido: "Concluído",
};

export function googleMapsUrl(coords: { lat: number; lng: number } | null, endereco?: string) {
  if (coords) return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  if (endereco) return `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`;
  return "#";
}
