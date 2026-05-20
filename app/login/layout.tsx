import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Entrar — GARDIAN",
  description: "Acesso ao centro de comando da Defesa Civil",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
