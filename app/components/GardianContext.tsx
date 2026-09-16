"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CriticalAlertModal } from "./Modals";
import { Tweaks } from "./Tweaks";
import { api } from "@/app/services/Api";
import { authService } from "@/app/services/Authservice";
import { clearSession, broadcastLogout } from "@/app/lib/session";

type ToastTone = "error" | "secondary";

type ToastState = { msg: string; tone: ToastTone } | null;

export interface UserData {
  id: number;
  user_sys: {
    id: number;
    username: string;
    first_name: string;
    email: string;
  } | null;
  telefone: string;
  nome_anonimo: string | null;
  tipo: number;
  entidade: number | null;
  cargo: number | null;
  cargo_label?: string | null;
  matricula?: string | null;
  zona_base?: number | null;
  status_campo?: string | null;
  status_campo_label?: string | null;
}

type GardianContextValue = {
  alertMode: boolean;
  setAlertMode: (value: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  density: string;
  setDensity: (value: string) => void;
  sidebarStyle: string;
  setSidebarStyle: (value: string) => void;
  showToast: (msg: string, tone?: ToastTone) => void;
  emitCriticalAlert: () => void;
  user: UserData | null;
  logout: () => void;
};

const GardianContext = createContext<GardianContextValue | null>(null);

const CACHED_USER_KEY = "gardian:cached_user";

let mePromise: Promise<UserData | null> | null = null;

function getCachedUser(): UserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(u: UserData | null) {
  if (typeof window === "undefined") return;
  try {
    if (u) {
      sessionStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    } else {
      sessionStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignora erro caso sessionstorage esteja indisponivel
  }
}

export function GardianProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [alertMode, setAlertMode] = useState(true);
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [sidebarStyle, setSidebarStyle] = useState("light");
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [user, setUser] = useState<UserData | null>(() => getCachedUser());

  // busca dados do usuario autenticado no mount com deduplicacao de promessa
  useEffect(() => {
    if (!authService.getAccessToken()) return;

    if (!mePromise) {
      mePromise = api
        .get<{ usuario: UserData }>("/acess/me/")
        .then((res) => {
          const u = res.data.usuario;
          setCachedUser(u);
          return u;
        })
        .catch(() => null)
        .finally(() => {
          mePromise = null;
        });
    }

    let cancelled = false;
    mePromise.then((userData) => {
      if (!cancelled && userData) {
        setUser(userData);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => setShowAlertModal(true);
    window.addEventListener("gardian:emit-alert", open);
    return () => window.removeEventListener("gardian:emit-alert", open);
  }, []);

  const showToast = useCallback((msg: string, tone: ToastTone = "secondary") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const emitCriticalAlert = useCallback(() => {
    window.dispatchEvent(new CustomEvent("gardian:emit-alert"));
  }, []);

  const logout = useCallback(() => {
    // limpa estado de autenticacao no cliente
    authService.logout();
    clearSession();
    broadcastLogout();
    setCachedUser(null);
    setUser(null);
    // redireciona para o login
    router.replace("/login");
  }, [router]);

  const value: GardianContextValue = {
    alertMode,
    setAlertMode,
    search,
    setSearch,
    density,
    setDensity,
    sidebarStyle,
    setSidebarStyle,
    showToast,
    emitCriticalAlert,
    user,
    logout,
  };

  return (
    <GardianContext.Provider value={value}>
      {children}

      <CriticalAlertModal
        open={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        onConfirm={(d) => {
          setShowAlertModal(false);
          setAlertMode(true);
          showToast(
            `Alerta ${d.severity} emitido para ${d.channels.length} canais`,
            "error",
          );
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-[fadeIn_200ms_ease]">
          <div
            className={`px-5 py-3 rounded-lg shadow-ambient flex items-center gap-3 ${
              toast.tone === "error" ? "bg-error text-white" : "bg-secondary text-white"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="text-sm font-bold">{toast.msg}</span>
          </div>
        </div>
      )}

      <Tweaks
        alertMode={alertMode}
        setAlertMode={setAlertMode}
        density={density}
        setDensity={setDensity}
        sidebarStyle={sidebarStyle}
        setSidebarStyle={setSidebarStyle}
      />
    </GardianContext.Provider>
  );
}

export function useGardian() {
  const ctx = useContext(GardianContext);
  if (!ctx) {
    throw new Error("useGardian deve ser usado dentro de GardianProvider");
  }
  return ctx;
}
