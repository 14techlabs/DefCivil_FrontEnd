"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { sidebarActiveFromPathname } from "@/app/lib/navigation";
import { GardianProvider, useGardian } from "./GardianContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = sidebarActiveFromPathname(pathname);
  const { alertMode } = useGardian();

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar active={active} alertMode={alertMode} />
      <main className="ml-0 lg:ml-64 flex-1 min-h-screen">
        <Topbar />
        {children}
        <footer className="border-t border-outline-variant/30 mt-12 px-8 py-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">
        
        </footer>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <GardianProvider>
      <AppShellInner>{children}</AppShellInner>
    </GardianProvider>
  );
}
