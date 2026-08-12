export const SCREEN_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  "ai-report": "/ai-report",
  cupula: "/cupula",
  monitoring: "/monitoring",
  geology: "/geology",
  weather: "/weather",
  occurrences: "/occurrences",
  zones: "/zones",
  "zone-detail": "/zonedetail",
  events: "/events",
  damages: "/damages",
  families: "/families",
  team: "/team",
  profile: "/profile",
  history: "/history",
  entity: "/entity",
  admin: "/admin",
};

export function screenFromPathname(pathname: string): string {
  if (pathname.startsWith("/zonedetail")) return "zone-detail";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/ai-report")) return "ai-report";
  if (pathname.startsWith("/cupula")) return "cupula";
  if (pathname.startsWith("/monitoring")) return "monitoring";
  if (pathname.startsWith("/geology")) return "geology";
  if (pathname.startsWith("/weather")) return "weather";
  if (pathname.startsWith("/occurrences")) return "occurrences";
  if (pathname.startsWith("/zones")) return "zones";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/damages")) return "damages";
  if (pathname.startsWith("/families")) return "families";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/entity")) return "entity";
  if (pathname.startsWith("/admin")) return "admin";
  return "dashboard";
}

export function sidebarActiveFromPathname(pathname: string): string {
  if (pathname.startsWith("/zonedetail")) return "zones";
  if (pathname.startsWith("/ai-report")) return "dashboard";
  return screenFromPathname(pathname);
}
