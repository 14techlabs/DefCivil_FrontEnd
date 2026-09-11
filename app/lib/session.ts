import Cookies from "js-cookie";

export const SESSION_KEY = "gardian:session";

export function setSession(email?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("sigac:isLoggingOut");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ at: Date.now(), email: email ?? "operador" }),
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("sigac:isLoggingOut");
  Cookies.remove("token", { path: "/" });
  Cookies.remove("refresh_token", { path: "/" });
  Cookies.remove("token");
  Cookies.remove("refresh_token");
}

export function broadcastLogout() {
  if (typeof window === "undefined") return;
  try {
    // notifica outras abas sobre o encerramento da sessao
    localStorage.setItem("gardian:logout_event", Date.now().toString());
  } catch {
    // ignora erro se localstorage estiver inacessivel
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const token = Cookies.get("token");
  if (!token) {
    if (sessionStorage.getItem(SESSION_KEY) !== null) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    return false;
  }
  if (sessionStorage.getItem(SESSION_KEY) === null) {
    setSession();
  }
  return true;
}



