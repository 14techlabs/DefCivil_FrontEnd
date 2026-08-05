import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";
import { GardianAuthGate } from "@/app/components/GardianAuthGate";

export default function GardianLayout({ children }: { children: ReactNode }) {
  return (
    <GardianAuthGate>
      <AppShell>{children}</AppShell>
    </GardianAuthGate>
  );
}
