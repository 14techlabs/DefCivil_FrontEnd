export const SESSION_KEY = "gardian:session";

export function setSession(email?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ at: Date.now(), email: email ?? "operador" }),
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) !== null;
}
