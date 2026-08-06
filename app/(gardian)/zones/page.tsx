"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";
import { useAppNavigation } from "@/app/lib/useAppNavigation";
import { CreateZoneModal } from "@/app/components/CreateZoneModal";

interface Zona {
  id: number;
  nome: string;
  descricao: string;
  tipo: "urbana" | "rural";
  status: "critico" | "atencao" | "estavel";
}

const STATUS_LABEL: Record<string, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  estavel: "Estável",
};

const TIPO_LABEL: Record<string, string> = {
  urbana: "Urbana",
  rural: "Rural",
};

export default function ZonesPage() {
  const { openZone } = useAppNavigation();
  const router = useRouter();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchZonas = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    api
      .get<{ zonas: Zona[] }>("/zonas/")
      .then((res) => {
        if (!cancelled) setZonas(res.data.zonas);
      })
      .catch(() => {
        if (!cancelled) {
          setZonas([]);
          setLoadError("Não foi possível carregar as zonas.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchZonas(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchZonas]);

  const filtered = zonas
    .filter((z) => {
      const searchTerm = search.trim().toLocaleLowerCase("pt-BR");
      const matchesStatus = statusFilter === "todos" || z.status === statusFilter;
      const matchesType = typeFilter === "todos" || z.tipo === typeFilter;
      const matchesSearch =
        !searchTerm ||
        [
          String(z.id),
          z.nome,
          z.descricao,
          STATUS_LABEL[z.status] ?? z.status,
          TIPO_LABEL[z.tipo] ?? z.tipo,
        ].some((value) => value.toLocaleLowerCase("pt-BR").includes(searchTerm));
      return matchesStatus && matchesType && matchesSearch;
    })
    .sort((a, b) => a.id - b.id);

  const toneFor = (s: string) =>
    s === "critico" ? "error" : s === "atencao" ? "warning" : "secondary";

  const accentFor = (s: string) =>
    s === "critico" ? "bg-error" : s === "atencao" ? "bg-orange-500" : "bg-secondary";

  const statusOptions = [
    { id: "todos", label: "Todos", count: zonas.length },
    { id: "critico", label: "Críticas", count: zonas.filter((z) => z.status === "critico").length },
    { id: "atencao", label: "Atenção", count: zonas.filter((z) => z.status === "atencao").length },
    { id: "estavel", label: "Estáveis", count: zonas.filter((z) => z.status === "estavel").length },
  ];

  const typeOptions = [
    { id: "todos", label: "Todos", count: zonas.length },
    { id: "urbana", label: "Urbanas", count: zonas.filter((z) => z.tipo === "urbana").length },
    { id: "rural", label: "Rurais", count: zonas.filter((z) => z.tipo === "rural").length },
  ];

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">Carregando zonas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag>
            {zonas.length} ZONAS ·{" "}
            {zonas.filter((z) => z.status === "critico").length} EM ALERTA
          </MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Gerenciamento de Zonas
            </h1>
            { /*
            <p className="text-sm text-on-surface-variant mt-2">
              Mapeamento territorial completo · Defesa Civil · Distritos urbanos e rural
              </p>
             */ }
          </div>
          <div className="flex gap-3">
            <Btn variant="primary" icon="add" onClick={() => setShowCreateModal(true)}>
              Nova Zona
            </Btn>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="rounded-xl border border-error/20 bg-error-container p-5">
          <div className="flex items-center gap-3">
            <Icon name="error" filled className="text-[22px] text-error" />
            <p className="text-sm font-medium text-on-error-container">{loadError}</p>
          </div>
        </div>
      )}

      {/* Filtros de zona */}
      <section className="flex flex-col gap-4 rounded-xl bg-surface-container-low p-4">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-on-surface-variant"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por nome, descrição, tipo, status ou número da zona..."
            aria-label="Pesquisar zonas"
            className="w-full rounded-lg border-none bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-primary placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-mono text-slate-400">Status</p>
              <div className="flex max-w-full gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por status">
                {statusOptions.map((option) => {
                  const active = statusFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(option.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${active
                        ? "bg-primary text-white"
                        : "bg-white text-on-surface-variant hover:text-primary"
                        }`}
                    >
                      {option.label}
                      <span className={active ? "text-white/60" : "text-slate-400"}>{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-mono text-slate-400">Tipo</p>
              <div className="flex max-w-full gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por tipo">
                {typeOptions.map((option) => {
                  const active = typeFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTypeFilter(option.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${active
                        ? "bg-primary text-white"
                        : "bg-white text-on-surface-variant hover:text-primary"
                        }`}
                    >
                      {option.label}
                      <span className={active ? "text-white/60" : "text-slate-400"}>{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <span className="shrink-0 text-[10px] font-bold uppercase tracking-mono-tight text-on-surface-variant">
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </section>

      {/* Zone cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((z) => (
          <button
            key={z.id}
            onClick={() => openZone(String(z.id))}
            className="card-tonal min-h-[280px] p-7 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            <span className={`absolute top-0 left-0 right-0 h-1 ${accentFor(z.status)}`} />
            <div className="flex items-start justify-between mb-7 mt-1">
              <Chip tone={toneFor(z.status)}>{STATUS_LABEL[z.status]}</Chip>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${z.status === "critico"
                  ? "bg-error/10 text-error"
                  : z.status === "atencao"
                    ? "bg-orange-500/10 text-orange-500"
                    : "bg-secondary/10 text-secondary"
                  }`}
              >
                <Icon
                  name={
                    z.status === "critico"
                      ? "warning"
                      : z.status === "atencao"
                        ? "trending_up"
                        : "check_circle"
                  }
                  filled
                  className="text-[20px]"
                />
              </span>
            </div>

            <h3 className="font-headline font-black text-2xl text-primary tracking-tight transition-colors group-hover:text-secondary">
              {z.nome}
            </h3>

            {z.descricao && (
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed line-clamp-2">
                {z.descricao}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-4 border-t border-outline-variant/25 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant">
                  <Icon
                    name={z.tipo === "urbana" ? "location_city" : "landscape"}
                    className="text-[20px]"
                  />
                </span>
                <div className="min-w-0">
                  <MetaTag className="block mb-0.5">Tipo</MetaTag>
                  <p className="truncate text-sm font-bold text-primary">
                    {TIPO_LABEL[z.tipo] ?? z.tipo}
                  </p>
                </div>
              </div>

              <span className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-mono-tight text-white shadow-sm transition-all duration-300 group-hover:bg-secondary group-hover:pr-3">
                Detalhes
                <Icon
                  name="arrow_forward"
                  className="text-[16px] transition-transform duration-300 group-hover:translate-x-1"
                />
              </span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading && !loadError && (
        <div className="text-center py-20">
          <Icon name="search_off" className="text-on-surface-variant text-[48px] mb-4" />
          <p className="text-sm text-on-surface-variant">Nenhuma zona encontrada para este filtro.</p>
        </div>
      )}

      <CreateZoneModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(zoneId) => {
          setShowCreateModal(false);
          fetchZonas();
          router.push(`/zonedetail?zone=${zoneId}`);
        }}
      />
    </div>
  );
}
