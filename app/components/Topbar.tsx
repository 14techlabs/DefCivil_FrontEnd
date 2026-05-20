"use client";

import { Icon, StatusDot } from "./Primitives";
import { useGardian } from "./GardianContext";

export function Topbar() {
  const { search, setSearch, alertMode } = useGardian();

  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl flex items-center justify-between px-8 h-16">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary transition-all placeholder:text-on-surface-variant/60"
            placeholder="Pesquisar zona, ocorrência, sensor..."
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low">
          <StatusDot tone={alertMode ? "error" : "secondary"} />
          <span className="font-headline uppercase tracking-mono-tight text-[10px] font-black text-primary">
            {alertMode ? "Estado de Alerta" : "Sistema Online"}
          </span>
        </div>
        <button
          type="button"
          className="relative p-2.5 rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <Icon name="notifications" className="text-on-surface-variant text-[20px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
        </button>
        <button
          type="button"
          className="p-2.5 rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <Icon name="settings" className="text-on-surface-variant text-[20px]" />
        </button>
        <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center text-white text-[11px] font-black tracking-tight">
          JD
        </div>
      </div>
    </header>
  );
}
