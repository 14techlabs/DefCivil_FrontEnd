"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GARDIAN_DATA } from "@/app/data/gardian";
import { SCREEN_ROUTES } from "@/app/lib/navigation";
import { Icon } from "./Primitives";
import { useGardian } from "./GardianContext";

export function Sidebar({
  active,
  alertMode,
}: {
  active: string;
  alertMode: boolean;
}) {
  const { user, logout } = useGardian();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const displayName = user?.user_sys?.username
    ?? user?.nome_anonimo
    ?? "Operador";

  const displayRole = user?.tipo === 2
    ? "Técnico"
    : user?.tipo === 1
      ? "Cidadão"
      : "";

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 z-40 bg-surface-container-low pl-4 pr-0 py-8 gap-2">
      <div className="px-4 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Icon name="shield" filled className="text-white text-[22px]" />
          </div>
          <div>
            <h1 className="font-headline font-black text-xl text-primary leading-tight tracking-tight">
              GARDIAN
            </h1>
            <p className="text-[10px] font-bold tracking-mono text-slate-500 uppercase mt-0.5">
              Civil Defense
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 pr-4">
        {GARDIAN_DATA.NAV.map((item) => {
          const isActive = active === item.id;
          const href = SCREEN_ROUTES[item.id] ?? "/dashboard";
          return (
            <Link
              key={item.id}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-l-lg text-sm font-semibold tracking-tight transition-all w-full text-left ${
                isActive
                  ? "bg-white text-secondary shadow-[0_8px_24px_-8px_rgba(0,106,96,0.20)]"
                  : "text-on-surface-variant hover:text-primary hover:translate-x-1"
              }`}
              style={
                isActive
                  ? {
                      boxShadow:
                        "inset 2px 0 0 #006A60, 0 8px 24px -8px rgba(0,106,96,0.2)",
                    }
                  : undefined
              }
            >
              <Icon name={item.icon} filled={isActive} className="text-[22px]" />
              {item.label}
              {item.id === "occurrences" && alertMode && (
                <span className="ml-auto text-[10px] font-black bg-error text-white px-1.5 py-0.5 rounded">
                  5
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 mt-2 mb-2">
        {/* <button
          type="button"
          onClick={emitCriticalAlert}
          className={`w-full py-3 rounded-lg text-[11px] font-black uppercase tracking-mono-tight text-white transition-all ${
            alertMode
              ? "bg-gradient-to-br from-error to-[#93000a] shadow-[0_12px_24px_-6px_rgba(186,26,26,0.4)] animate-alert-pulse"
              : "bg-gradient-to-br from-error to-[#93000a] hover:shadow-ambient"
          }`}
        >
          Emitir Alerta Crítico
        </button> */}
      </div>

      <div className="px-4 mt-auto relative" ref={menuRef}>
        <div className="p-3 rounded-xl bg-surface-container-highest/60 flex items-center gap-3 hover:bg-surface-container-highest transition-colors duration-150">
          <div className="w-9 h-9 rounded-md bg-primary-container flex items-center justify-center">
            <Icon name="person" className="text-white text-sm" />
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold truncate text-primary">{displayName}</p>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-mono-tight">
              {displayRole || "Sessão ativa"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`shrink-0 p-1.5 rounded-lg transition-all duration-150 ${
              menuOpen
                ? "bg-surface-container text-secondary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-90"
            }`}
            aria-label="Opções da sessão"
          >
            <Icon name="more_vert" className="text-on-surface-variant text-[18px]" />
          </button>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 rounded-xl bg-white shadow-ambient border border-outline-variant/20 overflow-hidden animate-[fadeIn_150ms_ease]">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-error transition-all duration-150 hover:bg-error-container/20 hover:pl-5 active:bg-error-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
            >
              <Icon name="logout" className="text-[18px]" />
              Encerrar sessão
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
