// DefCivil_FrontEnd/app/types/meteorologia.ts
export type PrecipLevel = "low" | "medium" | "high";

export interface MeteoOrgao {
  id: string;
  nome: string;
  fonte: string;
  atualizado: string;
  previsao: string;
  icone: string;
  chanceChuva: number | null;
  precipitacao: number | null;
  vento: number | null;
  ventoDir: string | null;
  /** false quando a fonte não respondeu. */
  temMedicao?: boolean;
  umidade: number | null;
  tempMin: number | null;
  tempMax: number | null;
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
  high: number | null;
  low: number | null;
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
    media: number | null;
    max: number | null;
    min: number | null;
    totalSensores: number;
  /** false quando não há sensor: distingue "0 mm" de "sem medição". */
  temMedicao: boolean;
    desvios: { nome: string; desvio: number }[];
  };
  condicoesAtuais: {
    location: string;
    condition: string;
    temp: number | null;
    feels: number | null;
    critical: boolean;
    updatedAt: string;
  };
  telemetria: TelemetriaItem[];
  previsao5Dias: PrevisaoDia[];
  precipitacaoSemanal: PrecipitacaoSemanal[];
  pluviometros: Pluviometro[];
  avisos?: string[];
}