import type { Metadata } from "next";
import { CityLanding } from "@/app/components/CityLanding";

export const metadata: Metadata = {
  title: "GARDIAN — Porto Seguro-BA | Defesa Civil",
  description:
    "Informações sobre Porto Seguro, monitoramento de riscos geo-hidrológicos e serviços da Defesa Civil.",
};

export default function Home() {
  return <CityLanding />;
}
