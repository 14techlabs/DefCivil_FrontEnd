"use client";

import { Icon } from "./Primitives";

// A stylized topographic / radar map placeholder. Click polygons to select zones.
export function MapPlaceholder({
  variant = "topo",
  height = 500,
  selectedZone,
  onSelectZone,
  showZones = true,
  alertMode,
}: {
  variant?: "topo" | "dark" | "radar";
  height?: number;
  selectedZone?: string;
  onSelectZone?: (id: string) => void;
  showZones?: boolean;
  alertMode?: boolean;
}) {

  // Polygon shapes for each zone, hand-tuned coordinates over a 1000x600 viewport
  const polygons = [
    { id: "PT-ZS-01", points: "120,180 280,150 340,260 280,380 140,360 80,280", label: "Porto Seguro - Bahia Sul", status: "critico" },
    { id: "PT-ZN-02", points: "360,90 520,80 560,180 480,240 380,210", label: "Vila Esperança", status: "critico" },
    { id: "PT-MR-04", points: "560,260 720,240 760,360 660,420 580,360", label: "Morro Esperança", status: "critico" },
    { id: "PT-VA-03", points: "300,400 480,380 520,490 380,520 280,470", label: "Vale das Acácias", status: "atencao" },
    { id: "PT-CI-05", points: "600,100 760,90 820,200 720,210", label: "Centro Industrial", status: "estavel" },
    { id: "PT-RR-06", points: "780,300 920,280 940,440 820,460 760,400", label: "Rural Norte", status: "estavel" },
  ];

  const fills: Record<
    "critico" | "atencao" | "estavel",
    { fill: string; stroke: string; text: string }
  > = {
    critico: { fill: "rgba(186,26,26,0.42)", stroke: "#BA1A1A", text: "#fff" },
    atencao: { fill: "rgba(194,87,11,0.40)", stroke: "#C2570B", text: "#fff" },
    estavel: { fill: "rgba(0,106,96,0.30)", stroke: "#006A60", text: "#fff" },
  };

  const isDark = variant === "dark" || variant === "radar";

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${isDark ? "bg-primary" : "topo-bg"}`}
      style={{ minHeight: height }}
    >
      {/* Background texture layer */}
      {variant === "topo" && (
        <div className="absolute inset-0 grid-bg opacity-50" />
      )}
      {variant === "dark" && (
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at 30% 50%, rgba(0,106,96,0.08) 0%, transparent 50%), linear-gradient(135deg, #051125 0%, #0a1a33 100%)"
        }} />
      )}
      {variant === "radar" && <div className="absolute inset-0 radar-bg" />}

      {/* Topo contour lines */}
      {variant === "topo" && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
          {[...Array(8)].map((_, i) => (
            <ellipse key={i} cx="500" cy="300" rx={150 + i*60} ry={80 + i*40}
              fill="none" stroke="rgba(91,99,112,0.10)" strokeWidth="1" />
          ))}
          {[...Array(6)].map((_, i) => (
            <path key={`r${i}`} d={`M${100+i*150},0 Q${200+i*150},300 ${50+i*150},600`}
              fill="none" stroke="rgba(91,99,112,0.08)" strokeWidth="1.5" />
          ))}
        </svg>
      )}

      {/* River */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
        <path d="M0,420 C200,400 350,460 500,440 C650,420 800,480 1000,460"
          fill="none" stroke={isDark ? "rgba(140,245,228,0.30)" : "rgba(0,106,96,0.30)"} strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* Zones */}
      {showZones && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
          {polygons.map(poly => {
            const f = fills[poly.status as keyof typeof fills];
            const isSel = selectedZone === poly.id;
            return (
              <g key={poly.id} className="cursor-pointer" onClick={() => onSelectZone && onSelectZone(poly.id)}>
                <polygon
                  points={poly.points}
                  fill={f.fill}
                  stroke={f.stroke}
                  strokeWidth={isSel ? "3" : "1.5"}
                  strokeDasharray={poly.status === "critico" ? "0" : "4 3"}
                  className="transition-all hover:opacity-80"
                  style={isSel ? { filter: "drop-shadow(0 0 12px rgba(0,106,96,0.6))" } : {}}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Labels overlay (HTML for crisp text) */}
      {showZones && (
        <div className="absolute inset-0 pointer-events-none">
          {polygons.map(poly => {
            // approximate centroid by averaging
            const pts = poly.points.split(" ").map(p => p.split(",").map(Number));
            const cx = pts.reduce((a,p) => a + p[0], 0) / pts.length;
            const cy = pts.reduce((a,p) => a + p[1], 0) / pts.length;
            const f = fills[poly.status as keyof typeof fills];
            return (
              <div key={poly.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${cx/10}%`, top: `${cy/600*100}%` }}>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-mono-tight rounded"
                  style={{ background: f.stroke, color: "#fff" }}>
                  {poly.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {["layers", "add", "remove", "my_location"].map(ic => (
          <button key={ic} className={`h-9 w-9 rounded-md flex items-center justify-center transition-all ${
            isDark ? "bg-white/10 backdrop-blur-md text-white hover:bg-white/20" : "bg-white shadow-ambient-sm text-on-surface-variant hover:bg-surface-container-high"
          }`}>
            <Icon name={ic} className="text-[18px]" />
          </button>
        ))}
      </div>

      {/* Telemetry tag (top-left) */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-10">
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-mono-tight flex items-center gap-2 ${
          isDark ? "bg-secondary text-white" : "bg-primary text-white"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-live-dot" />
          Telemetria em Tempo Real
        </div>
      </div>

      {/* Coords (bottom-left) */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className={`px-3 py-2 rounded-md flex items-center gap-3 ${
          isDark ? "bg-white/8 backdrop-blur-md text-white/80" : "bg-white/90 backdrop-blur-md text-on-surface"
        }`}>
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-mono opacity-60">Coord</p>
            <p className="text-[10px] font-mono font-bold">22.50° S, 43.18° W</p>
          </div>
          <div className={`h-6 w-px ${isDark ? "bg-white/20" : "bg-outline-variant/40"}`} />
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-mono opacity-60">Escala</p>
            <p className="text-[10px] font-mono font-bold">1:50,000</p>
          </div>
        </div>
      </div>

      {/* Legend (bottom-right) */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className={`p-3 rounded-md ${isDark ? "bg-primary-container/80 backdrop-blur-md" : "bg-white/95 backdrop-blur-md shadow-ambient-sm"}`}>
          <p className={`text-[9px] font-black uppercase tracking-mono mb-2 ${isDark ? "text-white/60" : "text-on-surface-variant"}`}>Legenda</p>
          <div className="space-y-1.5">
            {[
              { c: "#BA1A1A", l: "Crítico" },
              { c: "#C2570B", l: "Atenção" },
              { c: "#006A60", l: "Estável" },
            ].map(item => (
              <div key={item.l} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.c }} />
                <span className={`text-[10px] font-bold ${isDark ? "text-white/90" : "text-on-surface"}`}>{item.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical alert ribbon */}
      {alertMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="px-6 py-3 rounded-lg bg-error/95 backdrop-blur-md shadow-ambient flex items-center gap-3">
            <Icon name="warning" filled className="text-white" />
            <span className="font-headline text-white font-black text-sm uppercase tracking-mono-tight">Nível Crítico Detectado</span>
          </div>
        </div>
      )}
    </div>
  );
}
