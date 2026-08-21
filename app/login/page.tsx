"use client";

import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Btn, MetaTag } from "@/app/components/Primitives";
import { FormInput } from "@/app/components/Forminput";
import { isAuthenticated, setSession } from "@/app/lib/session";
import { authService } from "@/app/services/Authservice";

function LoginRedirectIfAuthed() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isAuthenticated()) {
      const next = searchParams.get("next") || "/dashboard";
      router.replace(next.startsWith("/") ? next : "/dashboard");
    }
  }, [router, searchParams]);

  return null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authService.login({ email, password });
      setSession(email || "operador");
      router.push(next.startsWith("/") ? next : "/dashboard");
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 400 || status === 401) {
        setError("E-mail ou senha inválidos.");
      } else {
        setError("Não foi possível entrar. Tente novamente em instantes.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="bg-primary text-white/80 text-[10px] font-mono uppercase tracking-mono font-bold py-2 px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <span>Gardian · Defesa Civil</span>
          <Link href="/" className="hover:text-white transition-colors">
            Voltar ao site
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="mb-6 inline-flex" aria-label="GARDIAN — Defesa Civil">
              <Image
                src="/logo/logo_preto_sem_fundo.svg"
                alt="GARDIAN — Defesa Civil"
                width={514}
                height={185}
                preload
                style={{ width: "292px", height: "auto", maxWidth: "100%" }}
              />
            </Link>
            <MetaTag className="text-secondary block mb-2">ACESSO RESTRITO</MetaTag>
            <h1 className="font-headline font-black text-3xl text-primary tracking-tighter">
              Entrar no sistema
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Ambiente operacional da Defesa Civil
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card-tonal p-8 shadow-ambient space-y-5">
            <FormInput
              label="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="username"
              placeholder="ex: operador@defesacivil.gov.br"
              disabled={loading}
            />
            <FormInput
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />

            {error && <p className="text-[12px] text-red-600 font-medium -mt-2">{error}</p>}

            <Btn type="submit" variant="primary" icon="login" full disabled={loading}>
              {loading ? "Entrando…" : "Acessar Centro de Comando"}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        </div>
      }
    >
      <LoginRedirectIfAuthed />
      <LoginForm />
    </Suspense>
  );
}
