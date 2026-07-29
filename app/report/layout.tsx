import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Registrar ocorrência — GARDIAN",
  description: "Formulário público da Defesa Civil de Porto Seguro",
};

export default function ReportLayout({ children }: { children: ReactNode }) {
  return children;
}
