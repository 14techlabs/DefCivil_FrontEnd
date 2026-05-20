"use client";

import { useRouter } from "next/navigation";
import { SCREEN_ROUTES } from "./navigation";

export function useAppNavigation() {
  const router = useRouter();

  const go = (screen: string) => {
    const route = SCREEN_ROUTES[screen];
    if (route) router.push(route);
  };

  const openZone = (zoneId: string) => {
    router.push(`/zonedetail?zone=${encodeURIComponent(zoneId)}`);
  };

  return { go, openZone, router };
}
