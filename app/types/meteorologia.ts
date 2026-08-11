export type PrecipLevel = "low" | "medium" | "high";

export interface MeteoOrgao {
  id: string;
  nome: string;
  fonte: string;
  atualizado: string;
  previsao: string;
  icone: string;
  chanceChuva: number;
  precipitacao: number;
  vento: number;
  ventoDir: string;
  umidade: number;
  tempMin: number;
  tempMax: number;
}

export interface Pluviometro {
  codigo: string;
  nome: string;
  zona: number | null;
  mm1h: number;
  mm6h: number;
  mm12h: number;
  mm24h: number;
  status: "critico" | "atencao" | "estavel";
  ultimaLeitura: string;
}

export interface TelemetriaItem {
  label: string;
  value: string;
  icon: string;
  tone: "error" | "warning" | "secondary";
  bar?: number;
  sub?: string;
}

export interface PrevisaoDia {
  day: string;
  icon: string;
  high: number;
  low: number;
  label: string;
  color: "error" | "warning" | "secondary";
}

export interface PrecipitacaoSemanal {
  day: string;
  pct: number;
  level: PrecipLevel;
}

export interface WeatherPainel {
  atualizadoEm: string;
  local: string;
  satellite: string;
  orgaos: MeteoOrgao[];
  chuvaReal: {
    media: number;
    max: number;
    min: number;
    totalSensores: number;
    desvios: { nome: string; desvio: number }[];
  };
  condicoesAtuais: {
    location: string;
    condition: string;
    temp: number;
    feels: number;
    critical: boolean;
    updatedAt: string;
  };
  telemetria: TelemetriaItem[];
  previsao5Dias: PrevisaoDia[];
  precipitacaoSemanal: PrecipitacaoSemanal[];
  pluviometros: Pluviometro[];
  avisos?: string[];
}
