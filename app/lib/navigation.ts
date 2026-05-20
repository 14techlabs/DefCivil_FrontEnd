export const SCREEN_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  monitoring: "/monitoring",
  geology: "/geology",
  weather: "/weather",
  occurrences: "/occurrences",
  zones: "/zones",
  "zone-detail": "/zonedetail",
};

export function screenFromPathname(pathname: string): string {
  if (pathname.startsWith("/zonedetail")) return "zone-detail";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/monitoring")) return "monitoring";
  if (pathname.startsWith("/geology")) return "geology";
  if (pathname.startsWith("/weather")) return "weather";
  if (pathname.startsWith("/occurrences")) return "occurrences";
  if (pathname.startsWith("/zones")) return "zones";
  return "dashboard";
}

export function sidebarActiveFromPathname(pathname: string): string {
  if (pathname.startsWith("/zonedetail")) return "zones";
  return screenFromPathname(pathname);
}
