"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAuthenticated, clearSession } from "@/app/lib/session";
import { authService } from "@/app/services/Authservice";

export function GardianAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    // reseta flag de redirecionamento ao mudar de rota
    redirectingRef.current = false;

    // verifica se o usuario esta autenticado antes de redirecionar para o login
    const checkAuth = () => {
      // se ja iniciou redirecionamento nao executa novamente
      if (redirectingRef.current) return false;

      const isLogged = isAuthenticated() && authService.isAuthenticated();
      if (!isLogged) {
        redirectingRef.current = true;
        clearSession();
        const next = encodeURIComponent(pathname || "/dashboard");
        router.replace(`/login?next=${next}`);
        return false;
      }
      setAllowed(true);
      return true;
    };

    if (!checkAuth()) return;

    // sincroniza autenticacao ao focar na janela
    const handleSync = () => {
      checkAuth();
    };

    // detecta logout disparado por outra aba
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "gardian:logout_event" && e.newValue) {
        if (redirectingRef.current) return;
        redirectingRef.current = true;
        clearSession();
        router.replace("/login");
      }
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("storage", handleStorage);
    };
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
