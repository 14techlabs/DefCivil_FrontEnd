const labels: Record<string, string> = {
  produtos_perigosos: "Produtos Perigosos",
  vias_publicas: "Vias Públicas",
  meteorologico: "Meteorológico",
  geologico: "Geológico",
  climatico: "Climático",
  desabamento: "Desabamento",
  deslizamento: "Deslizamento",
  queda_de_barreira: "Queda de Barreira",
  erosao: "Erosão",
  incendio: "Incêndio",
  alagamento: "Alagamento",
  inundacao: "Inundação",
  mitigacao: "Mitigação",
  em_analise: "Em Análise",
  em_andamento: "Em Andamento",
  alta_prioridade: "Alta Prioridade",
  concluido: "Concluído",
  concluida: "Concluída",
  atencao: "Atenção",
  critico: "Crítico",
  pessoas_risco: "Pessoas em Área de Risco",
  zona_alto_indice: "Zona de Alto Índice",
  demais: "Demais Ocorrências",
};

/** Formata códigos para apresentação, sem alterar os valores enviados à API. */
export function reportLabel(value: string): string {
  return labels[value.toLocaleLowerCase("pt-BR")]
    ?? value.replaceAll("_", " ").replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toLocaleUpperCase("pt-BR"));
}

/** Corrige códigos conhecidos dentro de títulos, preservando o restante do texto. */
export function reportTitle(value: string): string {
  return value.replace(/[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)*/gu, token => {
    const key = token.toLocaleLowerCase("pt-BR");
    return labels[key] ?? (token.includes("_") ? reportLabel(token) : token);
  });
}

/** Em texto livre, substitui apenas códigos conhecidos com separadores. */
export function reportText(value: string): string {
  return value.replace(/[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+/gu,
    token => labels[token.toLocaleLowerCase("pt-BR")] ?? token);
}
