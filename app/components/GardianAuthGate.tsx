"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isAuthenticated } from "@/app/lib/session";

export function GardianAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }
    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-sm text-on-surface-variant font-medium">Verificando sessão…</p>
      </div>
    );
  }

  return <>{children}</>;
}
