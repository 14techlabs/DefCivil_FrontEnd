"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CriticalAlertModal } from "./Modals";
import { Tweaks } from "./Tweaks";

type ToastTone = "error" | "secondary";

type ToastState = { msg: string; tone: ToastTone } | null;

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
};

const GardianContext = createContext<GardianContextValue | null>(null);

export function GardianProvider({ children }: { children: ReactNode }) {
  const [alertMode, setAlertMode] = useState(true);
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("comfortable");
  const [sidebarStyle, setSidebarStyle] = useState("light");
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_200ms_ease]">
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
