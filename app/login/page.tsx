"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { isAuthenticated, setSession } from "@/app/lib/session";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSession(email || "operador");
    router.push(next.startsWith("/") ? next : "/dashboard");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="bg-primary text-white/80 text-[10px] font-mono uppercase tracking-mono font-bold py-2 px-6">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <span>Prefeitura de Porto Seguro · Defesa Civil</span>
          <Link href="/" className="hover:text-white transition-colors">
            Voltar ao site
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Icon name="shield" filled className="text-white text-[26px]" />
              </div>
              <div className="text-left">
                <p className="font-headline font-black text-2xl text-primary tracking-tight leading-none">
                  GARDIAN
                </p>
                <p className="text-[10px] font-bold tracking-mono text-slate-500 uppercase">
                  Centro de Comando
                </p>
              </div>
            </Link>
            <MetaTag className="text-secondary block mb-2">ACESSO RESTRITO</MetaTag>
            <h1 className="font-headline font-black text-3xl text-primary tracking-tighter">
              Entrar no sistema
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Ambiente operacional da Defesa Civil · Porto Seguro-BA
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card-tonal p-8 shadow-ambient space-y-5">
            <div>
              <MetaTag className="block mb-2">Usuário ou e-mail</MetaTag>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="ex: operador.delta"
                className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
              />
            </div>
            <div>
              <MetaTag className="block mb-2">Senha</MetaTag>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60"
              />
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Use qualquer usuário e senha para acessar o ambiente de demonstração.
            </p>

            <Btn type="submit" variant="primary" icon="login" full disabled={loading}>
              {loading ? "Entrando…" : "Acessar Centro de Comando"}
            </Btn>
          </form>

          <p className="text-center text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400 mt-6">
            SENTINEL PROTOCOL · 14 TECH
          </p>
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
