import type { Metadata } from "next";
import { CityLanding } from "@/app/components/CityLanding";

export const metadata: Metadata = {
  title: "GARDIAN | Defesa Civil",
  description:
    "Informações sobre a Defesa Civil, monitoramento de riscos geo-hidrológicos e serviços da Defesa Civil.",
};

export default function Home() {
  return <CityLanding />;
}
