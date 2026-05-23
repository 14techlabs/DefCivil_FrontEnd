/** Polígonos aproximados das zonas de monitoramento (Porto Seguro-BA) */
export type ZoneRing = readonly (readonly [number, number])[];

export type MonitoringZoneRing = {
  id: string;
  label: string;
  ring: ZoneRing;
};

export const MONITORING_ZONE_RINGS: MonitoringZoneRing[] = [
  {
    id: "PT-ZS-01",
    label: "Zona Sul",
    ring: [
      [-39.28, -16.42],
      [-39.26, -16.44],
      [-39.18, -16.49],
      [-39.21, -16.56],
      [-39.25, -16.55],
    ],
  },
  {
    id: "PT-ZN-02",
    label: "Vila Esperança",
    ring: [
      [-39.09, -16.43],
      [-39.06, -16.42],
      [-39.05, -16.45],
      [-39.07, -16.47],
      [-39.1, -16.46],
    ],
  },
  {
    id: "PT-MR-04",
    label: "Morro Esperança",
    ring: [
      [-39.08, -16.46],
      [-39.05, -16.45],
      [-39.04, -16.48],
      [-39.06, -16.5],
      [-39.09, -16.49],
    ],
  },
  {
    id: "PT-VA-03",
    label: "Vale das Acácias",
    ring: [
      [-39.14, -16.5],
      [-39.11, -16.49],
      [-39.1, -16.52],
      [-39.12, -16.54],
      [-39.15, -16.53],
    ],
  },
  {
    id: "PT-CI-05",
    label: "Centro Industrial",
    ring: [
      [-39.09, -16.45],
      [-39.07, -16.44],
      [-39.06, -16.46],
      [-39.08, -16.47],
      [-39.1, -16.46],
    ],
  },
  {
    id: "PT-RR-06",
    label: "Rural Norte",
    ring: [
      [-39.2, -16.42],
      [-39.15, -16.41],
      [-39.14, -16.44],
      [-39.17, -16.46],
      [-39.21, -16.45],
    ],
  },
];

export function getMonitoringZoneRing(zoneId: string) {
  return MONITORING_ZONE_RINGS.find((z) => z.id === zoneId);
}
