// ─────────────────────────────────────────────────────────────
// CUPULA.TS — motor de respostas mockado da IA do Gardian.
// Interpreta a pergunta por palavras-chave e monta a resposta a
// partir da base em app/data/mock.ts. Substituível por chamada
// real ao backend sem alterar a tela.
// ─────────────────────────────────────────────────────────────

import {
  MOCK_AI_REPORT,
  MOCK_POSSIVEIS_EVENTOS,
  MOCK_EVENTOS,
  MOCK_OCORRENCIAS,
  MOCK_RESUMO_ZONAS,
  MOCK_ZONAS,
  MOCK_PLUVIOMETROS,
  MOCK_METEO_ORGAOS,
  MOCK_DANOS_CATALOGO,
  MOCK_DANOS_REGISTROS,
  MOCK_FAMILIAS,
  MOCK_TECNICOS,
  MOCK_HIST_PREVISOES_IA,
  STATUS_OCORRENCIA_LABEL,
  formatBRL,
  tecnicoNome,
  zonaNome,
} from "@/app/data/mock";

export interface RespostaCupula {
  texto: string;
  fontes: string[];
  /** relatórios ganham cabeçalho próprio e botão de exportação */
  relatorio?: { titulo: string; periodo: string };
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const inclui = (t: string, termos: string[]) => termos.some((x) => t.includes(x));

/* ───────── blocos reutilizáveis ───────── */

function blocoEventoAtivo(): string {
  const ev = MOCK_EVENTOS.find((e) => e.status === "ativo");
  if (!ev) return "Não há evento ativo no momento.";
  const ocs = MOCK_OCORRENCIAS.filter((o) => o.evento === ev.id);
  const emAndamento = ocs.filter(
    (o) => o.status === "em_andamento" || o.status === "alta_prioridade",
  );
  return [
    `Evento ativo: ${ev.nome} (${ev.tipo}).`,
    `Aberto desde 26/07, cobrindo ${ev.zonas.map(zonaNome).join(", ")}.`,
    "",
    `• ${ocs.length} ocorrências vinculadas, ${emAndamento.length} com equipe em campo`,
    `• Vinculação automática: ${ev.vinculacaoAtiva ? "ligada" : "desligada"}`,
    `• Rota da IA com ${ev.rotaIA.paradas.length} paradas — ${ev.rotaIA.distanciaTotal}, ${ev.rotaIA.tempoEstimado}`,
    "",
    "Último registro da timeline: " +
      `${ev.timeline[ev.timeline.length - 1].titulo} — ${ev.timeline[ev.timeline.length - 1].detalhe}`,
  ].join("\n");
}

function blocoPrevisoes(): string {
  const linhas = MOCK_POSSIVEIS_EVENTOS.map(
    (p) =>
      `• ${p.titulo} — ${p.confianca.toFixed(1).replace(".", ",")}% de confiança, janela de ${p.janela}\n   Base principal: ${p.base[0]}`,
  );
  return [
    `Tenho ${MOCK_POSSIVEIS_EVENTOS.length} previsões ativas no momento:`,
    "",
    ...linhas,
    "",
    "Aprovar uma previsão a converte em ocorrência preventiva. Posso detalhar a base de qualquer uma delas.",
  ].join("\n");
}

function blocoChuva(): string {
  const media =
    MOCK_PLUVIOMETROS.reduce((a, p) => a + p.mm24h, 0) / MOCK_PLUVIOMETROS.length;
  const maior = [...MOCK_PLUVIOMETROS].sort((a, b) => b.mm24h - a.mm24h)[0];
  return [
    `A chuva acumulada real média nas últimas 24h é de ${media.toFixed(1).replace(".", ",")}mm, medida por ${MOCK_PLUVIOMETROS.length} pluviômetros do CEMADEN.`,
    "",
    `Maior acumulado: ${maior.nome} (${maior.codigo}) com ${maior.mm24h.toFixed(1).replace(".", ",")}mm — ${maior.mm12h.toFixed(1).replace(".", ",")}mm só nas últimas 12h.`,
    "",
    "Previsões para as próximas 24h:",
    ...MOCK_METEO_ORGAOS.map(
      (o) =>
        `• ${o.nome}: ${o.precipitacao}mm, ${o.chanceChuva}% de chance de chuva, ${o.previsao.toLowerCase()}`,
    ),
    "",
    "Os três órgãos subestimaram o volume real — o desvio vem crescendo desde 25/07.",
  ].join("\n");
}

function blocoZona(zonaId: number): string {
  const z = MOCK_ZONAS.find((x) => x.id === zonaId);
  const resumo = MOCK_RESUMO_ZONAS.find((r) => r.zona === zonaId);
  const ocs = MOCK_OCORRENCIAS.filter((o) => o.zona === zonaId);
  const familias = MOCK_FAMILIAS.filter((f) => f.zona === zonaId);
  const emRisco = familias.filter((f) => f.areaDeRisco).length;
  const previsoes = MOCK_POSSIVEIS_EVENTOS.filter((p) => p.zona === zonaId);
  const pluv = MOCK_PLUVIOMETROS.find((p) => p.zona === zonaId);

  return [
    `${z?.nome ?? zonaNome(zonaId)} — status ${resumo?.status ?? z?.status ?? "—"}.`,
    "",
    resumo?.resumo ?? z?.descricao ?? "",
    "",
    `• ${ocs.length} ocorrências registradas (${ocs.filter((o) => o.status !== "concluido").length} não concluídas)`,
    `• ${familias.length} famílias cadastradas, ${emRisco} em área de risco`,
    pluv
      ? `• Pluviômetro ${pluv.codigo}: ${pluv.mm24h.toFixed(1).replace(".", ",")}mm/24h`
      : "• Sem pluviômetro instalado nesta zona",
    previsoes.length > 0
      ? `• Previsão ativa: ${previsoes[0].titulo} (${previsoes[0].confianca.toFixed(1).replace(".", ",")}%)`
      : "• Nenhuma previsão ativa para esta zona",
  ]
    .filter(Boolean)
    .join("\n");
}

function blocoDanos(): string {
  const catalogo = new Map(MOCK_DANOS_CATALOGO.map((c) => [c.id, c]));
  const custo = MOCK_DANOS_REGISTROS.reduce(
    (acc, r) =>
      acc +
      r.itens.reduce(
        (a, it) => a + (catalogo.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade,
        0,
      ),
    0,
  );
  const itens = MOCK_DANOS_REGISTROS.reduce(
    (a, r) => a + r.itens.reduce((x, i) => x + i.quantidade, 0),
    0,
  );
  const maisCaro = [...MOCK_DANOS_REGISTROS]
    .map((r) => ({
      oc: r.ocorrenciaId,
      valor: r.itens.reduce(
        (a, it) => a + (catalogo.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade,
        0,
      ),
    }))
    .sort((a, b) => b.valor - a.valor)[0];

  return [
    `O valor bruto acumulado em danos é de ${formatBRL(custo)}, distribuídos em ${itens} itens aplicados em ${MOCK_DANOS_REGISTROS.length} ocorrências.`,
    "",
    `Maior custo individual: ocorrência ${maisCaro.oc}, com ${formatBRL(maisCaro.valor)}.`,
    `A base de referência tem ${MOCK_DANOS_CATALOGO.length} itens catalogados.`,
    "",
    "Posso emitir o relatório detalhado por ocorrência ou consolidado por evento.",
  ].join("\n");
}

function blocoEquipe(): string {
  const emCampo = MOCK_TECNICOS.filter((t) => t.statusCampo === "em_campo");
  const atendimentos = MOCK_TECNICOS.reduce((a, t) => a + t.atendimentos30d, 0);
  return [
    `A equipe tem ${MOCK_TECNICOS.length} integrantes e acumulou ${atendimentos} atendimentos em 30 dias.`,
    "",
    `Em campo agora (${emCampo.length}):`,
    ...emCampo.map((t) => {
      const atuando = MOCK_OCORRENCIAS.filter(
        (o) =>
          o.tecnico_responsavel === t.id &&
          (o.status === "em_andamento" || o.status === "alta_prioridade"),
      );
      return `• ${t.nome} (${t.cargo}) — ${zonaNome(t.zonaBase)}${
        atuando.length ? `, atuando em ${atuando.map((o) => o.id).join(", ")}` : ""
      }`;
    }),
  ].join("\n");
}

function blocoOcorrencias(): string {
  const abertas = MOCK_OCORRENCIAS.filter((o) => o.status !== "concluido");
  const porZona = new Map<number, number>();
  for (const o of MOCK_OCORRENCIAS) {
    if (o.zona != null) porZona.set(o.zona, (porZona.get(o.zona) ?? 0) + 1);
  }
  const top = [...porZona.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    `Há ${abertas.length} ocorrências não concluídas de um total de ${MOCK_OCORRENCIAS.length} registradas.`,
    "",
    ...abertas.map(
      (o) =>
        `• ${o.id} — ${o.titulo}\n   ${zonaNome(o.zona)} · ${STATUS_OCORRENCIA_LABEL[o.status]}${
          o.tecnico_responsavel ? ` · ${tecnicoNome(o.tecnico_responsavel)} no local` : " · sem técnico designado"
        }`,
    ),
    "",
    top ? `Zona com mais registros: ${zonaNome(top[0])}, com ${top[1]} ocorrências.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function blocoFamilias(): string {
  const pessoas = MOCK_FAMILIAS.reduce((a, f) => a + f.membros.length, 0);
  const risco = MOCK_FAMILIAS.filter((f) => f.areaDeRisco);
  const atingidas = MOCK_FAMILIAS.filter((f) => f.eventosAtingida.length > 0);
  return [
    `Há ${MOCK_FAMILIAS.length} famílias cadastradas, somando ${pessoas} pessoas e ${MOCK_FAMILIAS.reduce((a, f) => a + f.animais.length, 0)} animais.`,
    "",
    `• ${risco.length} famílias em área de risco: ${risco.map((f) => f.responsavel).join(", ")}`,
    `• ${atingidas.length} atingidas pelo evento em andamento`,
    "",
    "Na priorização das rotas, as famílias em área de risco com crianças ou idosos vêm sempre primeiro.",
  ].join("\n");
}

function blocoHistoricoIA(): string {
  const aprovadas = MOCK_HIST_PREVISOES_IA.filter((p) => p.status === "aprovado");
  const descartadas = MOCK_HIST_PREVISOES_IA.filter((p) => p.status === "descartado");
  return [
    `No histórico tenho ${MOCK_HIST_PREVISOES_IA.length} previsões: ${aprovadas.length} aprovadas, ${descartadas.length} descartadas e ${MOCK_HIST_PREVISOES_IA.length - aprovadas.length - descartadas.length} pendentes.`,
    "",
    "Descartadas e o motivo:",
    ...descartadas.map((p) => `• ${p.titulo} (${p.data}) — ${p.desfecho}`),
    "",
    "Uso esses desfechos para recalibrar os pesos dos indicadores.",
  ].join("\n");
}

/* ───────── relatórios ───────── */

function relatorioSituacional(): RespostaCupula {
  const ev = MOCK_EVENTOS.find((e) => e.status === "ativo");
  const abertas = MOCK_OCORRENCIAS.filter((o) => o.status !== "concluido").length;
  const media =
    MOCK_PLUVIOMETROS.reduce((a, p) => a + p.mm24h, 0) / MOCK_PLUVIOMETROS.length;
  const risco = MOCK_FAMILIAS.filter((f) => f.areaDeRisco).length;

  return {
    relatorio: { titulo: "Relatório situacional", periodo: "Últimas 48 horas" },
    texto: [
      "1. SITUAÇÃO GERAL",
      MOCK_AI_REPORT.resumo,
      "",
      "2. NÚMEROS DO PERÍODO",
      `• Evento ativo: ${ev?.nome ?? "nenhum"}`,
      `• Ocorrências não concluídas: ${abertas}`,
      `• Chuva acumulada real (média): ${media.toFixed(1).replace(".", ",")}mm/24h`,
      `• Famílias em área de risco: ${risco}`,
      `• Previsões ativas: ${MOCK_POSSIVEIS_EVENTOS.length}`,
      "",
      "3. ZONAS CRÍTICAS",
      ...MOCK_RESUMO_ZONAS.filter((r) => r.status === "critico").map(
        (r) => `• ${zonaNome(r.zona)} — ${r.resumo}`,
      ),
      "",
      "4. RECOMENDAÇÕES",
      "• Manter as três equipes mobilizadas conforme a rota otimizada",
      "• Aprovar a previsão de deslizamento na Vila Esperança e gerar ocorrência preventiva",
      "• Reavaliar a fissura do Setor 7 após a próxima janela de chuva",
    ].join("\n"),
    fontes: ["Evento ativo", "Pluviômetros CEMADEN", "Base de zonas", "Famílias"],
  };
}

function relatorioDanos(): RespostaCupula {
  const catalogo = new Map(MOCK_DANOS_CATALOGO.map((c) => [c.id, c]));
  const linhas = MOCK_DANOS_REGISTROS.map((r) => {
    const valor = r.itens.reduce(
      (a, it) => a + (catalogo.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade,
      0,
    );
    return `• Ocorrência ${r.ocorrenciaId} — ${formatBRL(valor)} (${r.itens.reduce((a, i) => a + i.quantidade, 0)} itens), registrado por ${tecnicoNome(r.registradoPor)}`;
  });
  const total = MOCK_DANOS_REGISTROS.reduce(
    (acc, r) =>
      acc +
      r.itens.reduce(
        (a, it) => a + (catalogo.get(it.catalogoId)?.precoUnitario ?? 0) * it.quantidade,
        0,
      ),
    0,
  );

  return {
    relatorio: { titulo: "Relatório de danos", periodo: "Acumulado do evento" },
    texto: [
      "1. CUSTO POR OCORRÊNCIA",
      ...linhas,
      "",
      "2. TOTAL",
      `Valor bruto final: ${formatBRL(total)}`,
      "",
      "3. OBSERVAÇÃO",
      "Os preços vêm da base de referência de danos e podem ser atualizados na tela de Danos antes da emissão oficial.",
    ].join("\n"),
    fontes: ["Base de danos", "Registros por ocorrência"],
  };
}

/* ───────── roteador principal ───────── */

export function responderCupula(pergunta: string): RespostaCupula {
  const t = norm(pergunta);

  // relatórios
  if (inclui(t, ["relatorio", "relatório", "emitir", "documento"])) {
    if (inclui(t, ["dano", "custo", "prejuizo", "gasto", "valor"])) return relatorioDanos();
    return relatorioSituacional();
  }

  // zona específica citada pelo nome
  const zonaCitada = MOCK_ZONAS.find((z) => {
    const partes = norm(z.nome).split(/[\s—-]+/).filter((x) => x.length > 3);
    return partes.some((parte) => t.includes(parte));
  });
  if (zonaCitada && inclui(t, ["zona", "como esta", "situacao", "analise", "analisa", "risco"])) {
    return {
      texto: blocoZona(zonaCitada.id),
      fontes: ["Monitoramento por zona", "Ocorrências", "Famílias", "Pluviômetros"],
    };
  }

  // ocorrência por número
  const numero = pergunta.match(/#?\s?(9\d{3})/);
  if (numero) {
    const oc = MOCK_OCORRENCIAS.find((o) => o.id === Number(numero[1]));
    if (oc) {
      return {
        texto: [
          `Ocorrência ${oc.id} — ${oc.titulo}`,
          "",
          `Status: ${STATUS_OCORRENCIA_LABEL[oc.status]} · Categoria: ${oc.categoria}`,
          `Local: ${oc.endereco}`,
          `Responsável: ${oc.tecnico_responsavel ? tecnicoNome(oc.tecnico_responsavel) : "sem técnico designado"}`,
          `Anexos: ${oc.anexos.length}`,
          "",
          `Relato: ${oc.descricao}`,
          "",
          `Minha análise (${oc.nivel_perigo_ia ?? "—"}): ${oc.analise_ia ?? "sem análise registrada"}`,
          oc.analise_tecnico ? `\nAnálise técnica: ${oc.analise_tecnico}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        fontes: [`Ocorrência ${oc.id}`, "Análise de IA", "Vistoria técnica"],
      };
    }
  }

  if (inclui(t, ["previs", "possivel evento", "possiveis eventos", "vai acontecer", "risco futuro", "alerta"]))
    return { texto: blocoPrevisoes(), fontes: ["Previsões ativas", "Histórico de eventos"] };

  if (inclui(t, ["chuva", "chuvas", "pluvi", "meteoro", "tempo", "mm", "acumulado", "cemaden", "inmet", "cptec"]))
    return { texto: blocoChuva(), fontes: ["Pluviômetros CEMADEN", "INMET", "CPTEC"] };

  if (inclui(t, ["evento", "cupula do evento", "vinculacao", "rota"]))
    return { texto: blocoEventoAtivo(), fontes: ["Evento ativo", "Rota otimizada", "Timeline"] };

  if (inclui(t, ["dano", "custo", "prejuizo", "gasto", "quanto foi", "valor"]))
    return { texto: blocoDanos(), fontes: ["Base de danos", "Registros por ocorrência"] };

  if (inclui(t, ["equipe", "tecnico", "time", "agente", "quem esta"]))
    return { texto: blocoEquipe(), fontes: ["Cadastro da equipe", "Atendimentos"] };

  if (inclui(t, ["ocorrencia", "chamado", "registro", "aberta", "andamento"]))
    return { texto: blocoOcorrencias(), fontes: ["Central de ocorrências"] };

  if (inclui(t, ["familia", "populacao", "morador", "pessoas", "animal", "animais"]))
    return { texto: blocoFamilias(), fontes: ["Cadastro de famílias"] };

  if (inclui(t, ["historico", "descartad", "acertou", "erro", "calibr", "acuracia"]))
    return { texto: blocoHistoricoIA(), fontes: ["Histórico de previsões"] };

  if (inclui(t, ["resumo", "resumir", "panorama", "situacao geral", "como estamos", "briefing"]))
    return {
      texto: [
        MOCK_AI_REPORT.resumo,
        "",
        blocoEventoAtivo(),
      ].join("\n"),
      fontes: ["Relatório geral", "Evento ativo"],
    };

  if (inclui(t, ["oi", "ola", "bom dia", "boa tarde", "boa noite", "quem e voce", "o que voce faz", "ajuda"]))
    return {
      texto: [
        "Sou a Cúpula, a inteligência que monitora Porto Seguro em tempo real. Cruzo pluviometria, geologia, histórico de eventos e os relatos da população para antecipar o que vem.",
        "",
        "Posso ajudar com:",
        "• Resumos da situação e do evento em andamento",
        "• Detalhamento das minhas previsões e da base de cada uma",
        "• Análise de uma zona, ocorrência ou família específica",
        "• Levantamento de danos e custos",
        "• Emissão de relatórios situacionais e de danos",
        "",
        "Pergunte à vontade — ou use uma das sugestões abaixo.",
      ].join("\n"),
      fontes: [],
    };

  // fallback
  return {
    texto: [
      "Não encontrei essa informação na base que monitoro agora.",
      "",
      "Consigo responder sobre: evento ativo, previsões, chuva acumulada, zonas, ocorrências (por número, ex.: #9001), equipe, famílias, danos e histórico das minhas previsões. Também emito relatórios situacionais e de danos.",
      "",
      "Reformule com um desses temas e eu trago o detalhamento.",
    ].join("\n"),
    fontes: [],
  };
}

/* ───────── sugestões rápidas ───────── */

export const SUGESTOES_CUPULA = [
  { icon: "summarize", texto: "Resuma a situação atual" },
  { icon: "online_prediction", texto: "Quais são suas previsões ativas?" },
  { icon: "rainy", texto: "Quanto choveu nas últimas 24h?" },
  { icon: "cyclone", texto: "Como está o evento em andamento?" },
  { icon: "terrain", texto: "Analise a Vila Esperança" },
  { icon: "emergency", texto: "Quais ocorrências estão abertas?" },
  { icon: "payments", texto: "Emitir relatório de danos" },
  { icon: "description", texto: "Emitir relatório situacional" },
];
