import fs from "fs";

const d = JSON.parse(fs.readFileSync("tmp-nominatim.json", "utf8"));
const ring = d[0].geojson.coordinates[0];
const step = Math.max(1, Math.floor(ring.length / 120));
const simplified = ring.filter((_, i) => i % step === 0);
const bb = d[0].boundingbox;

const content = `// Contorno municipal de Porto Seguro-BA (OSM relation 362341, simplificado)
export const PORTO_SEGURO_BBOX = {
  west: ${bb[2]},
  south: ${bb[0]},
  east: ${bb[3]},
  north: ${bb[1]},
} as const;

export const PORTO_SEGURO_BOUNDARY: readonly [number, number][] = ${JSON.stringify(simplified)};
`;

fs.writeFileSync("app/data/portoSeguroBoundary.ts", content);
console.log("Wrote", simplified.length, "points");
