"use client";

import { useEffect, useState } from "react";
import { Icon, MetaTag } from "./Primitives";

export function Tweaks({
  alertMode,
  setAlertMode,
  density,
  setDensity,
  sidebarStyle,
  setSidebarStyle,
}: {
  alertMode: boolean;
  setAlertMode: (v: boolean) => void;
  density: string;
  setDensity: (v: string) => void;
  sidebarStyle: string;
  setSidebarStyle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "__activate_edit_mode") setEditMode(true);
      if (e.data?.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (!editMode) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="card-tonal shadow-ambient w-80 overflow-hidden">
          <div className="bg-primary text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-mono font-bold text-white/60">SENTINEL · TWEAKS</p>
              <h3 className="font-headline font-black text-lg tracking-tight">Tweaks</h3>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white"><Icon name="close" /></button>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <MetaTag className="block mb-2">Estado do Sistema</MetaTag>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAlertMode(false)} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${!alertMode?"bg-secondary text-white":"bg-surface-container-low text-on-surface-variant"}`}>Normal</button>
                <button onClick={() => setAlertMode(true)} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${alertMode?"bg-error text-white":"bg-surface-container-low text-on-surface-variant"}`}>Alerta</button>
              </div>
            </div>
            <div>
              <MetaTag className="block mb-2">Densidade</MetaTag>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDensity("compact")} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${density==="compact"?"bg-primary text-white":"bg-surface-container-low text-on-surface-variant"}`}>Compacta</button>
                <button onClick={() => setDensity("comfortable")} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${density==="comfortable"?"bg-primary text-white":"bg-surface-container-low text-on-surface-variant"}`}>Confortável</button>
              </div>
            </div>
            <div>
              <MetaTag className="block mb-2">Sidebar</MetaTag>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSidebarStyle("light")} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${sidebarStyle==="light"?"bg-primary text-white":"bg-surface-container-low text-on-surface-variant"}`}>Clara</button>
                <button onClick={() => setSidebarStyle("dark")} className={`py-2 rounded-md text-[10px] font-black uppercase tracking-mono-tight ${sidebarStyle==="dark"?"bg-primary text-white":"bg-surface-container-low text-on-surface-variant"}`}>Escura</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="bg-primary text-white p-4 rounded-full shadow-ambient hover:scale-105 transition-all">
          <Icon name="tune" />
        </button>
      )}
    </div>
  );
}
