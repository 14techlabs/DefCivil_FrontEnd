"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, MetaTag, Tab } from "@/app/components/Primitives";
import { api } from "@/app/services/Api";

// --- tipos da resposta da api ---

interface Ocorrencia {
  id: number;
  entidade: number;
  zona: number | null;
  autor: number | null;
  titulo: string;
  categoria: string;
  status: string;
  coordenadas: { lat: number; lng: number } | null;
  descricao: string;
  nivel_perigo_ia: string | null;
  analise_ia: string | null;
  valido_ia: boolean;
  feito_ia: boolean;
  tecnico_responsavel: number | null;
  nivel_perigo_tecnico: string | null;
  analise_tecnico: string | null;
  valido_tecnico: boolean | null;
  created_at: string;
  anexos: unknown[];
}

interface OcorrenciaListResponse {
  ocorrencias: Ocorrencia[];
}

interface ZonaBasic {
  id: number;
  nome: string;
}

interface ZonaListResponse {
  zonas: ZonaBasic[];
}

interface UsuarioInfo {
  id: number;
  user_sys: { id: number; username: string; first_name: string; email: string } | null;
  telefone: string;
  nome_anonimo: string | null;
  tipo: number;
}

// --- helpers ---

const CATEGORIA_LABEL: Record<string, string> = {
  geologico: "Geológico",
  climatico: "Climático",
  vias_publicas: "Vias Públicas",
  produtos_perigosos: "Produtos Perigosos",
};

const CATEGORIA_ICON: Record<string, string> = {
  geologico: "terrain",
  climatico: "thunderstorm",
  vias_publicas: "directions_car",
  produtos_perigosos: "science",
};

function statusToneFor(status: string): "error" | "warning" | "secondary" {
  const s = status.toLowerCase();
  if (s === "critico" || s === "alta_prioridade" || s === "r4" || s === "r3") return "error";
  if (s === "atencao" || s === "risco_moderado" || s === "r2") return "warning";
  return "secondary";
}

function statusAccentClass(status: string): string {
  const tone = statusToneFor(status);
  if (tone === "error") return "bg-error";
  if (tone === "warning") return "bg-orange-500";
  return "bg-secondary";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase()
    .replace(/\./g, "");
}

function formatCoords(
  coords: { lat: number; lng: number } | null,
): string | null {
  if (!coords) return null;
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

// --- componente ---

export default function OccurrencesPage() {

  // estado dos dados
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [zonaLookup, setZonaLookup] = useState<Map<number, string>>(new Map());
  const [usuarioLookup, setUsuarioLookup] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // estado da ui
  const [filter, setFilter] = useState("todas");
  const [selected, setSelected] = useState<number | null>(null);

  // busca ocorrencias + zonas + usuarios
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [occRes, zonRes, usuRes] = await Promise.all([
          api.get<OcorrenciaListResponse>("/ocorrencias/"),
          api.get<ZonaListResponse>("/zonas/"),
          api.get<UsuarioInfo[]>("/usuarios/"),
        ]);

        if (cancelled) return;

        const lista = occRes.data.ocorrencias;
        setOcorrencias(lista);
        if (lista.length > 0) setSelected(lista[0].id);

        // lookup de zonas
        const zLookup = new Map<number, string>();
        for (const z of zonRes.data.zonas) {
          zLookup.set(z.id, z.nome);
        }
        setZonaLookup(zLookup);

        // lookup de usuarios
        const uLookup = new Map<number, string>();
        for (const u of usuRes.data) {
          const nome =
            u.user_sys?.username ??
            u.nome_anonimo ??
            u.telefone ??
            `Usuário #${u.id}`;
          uLookup.set(u.id, nome);
        }
        setUsuarioLookup(uLookup);
      } catch {
        // falha silenciosa — estado vazio será exibido
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // agrupa categorias disponiveis a partir dos dados reais
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set(ocorrencias.map((o) => o.categoria));
    return ["todas", ...set];
  }, [ocorrencias]);

  const ocorrenciasFiltradas = useMemo(
    () =>
      filter === "todas"
        ? ocorrencias
        : ocorrencias.filter((o) => o.categoria === filter),
    [ocorrencias, filter],
  );

  const selecionada = useMemo(
    () =>
      ocorrenciasFiltradas.find((o) => o.id === selected) ??
      ocorrenciasFiltradas[0] ??
      null,
    [ocorrenciasFiltradas, selected],
  );

  // contagem por categoria para as abas
  const contagem = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ocorrencias) {
      map.set(o.categoria, (map.get(o.categoria) ?? 0) + 1);
    }
    return map;
  }, [ocorrencias]);

  // --- renderização ---

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <header className="mb-8">
          <MetaTag className="text-secondary">CENTRAL DE OCORRÊNCIAS</MetaTag>
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Ocorrências em Aberto
          </h1>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-on-surface-variant font-medium">
            Carregando ocorrências…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* cabeçalho */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">CENTRAL DE OCORRÊNCIAS</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>
            {ocorrencias.length} REGISTRO{ocorrencias.length !== 1 ? "S" : ""}
          </MetaTag>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
              Ocorrências em Aberto
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Triagem unificada · Relatos da população, sensores IoT e parceiros
              institucionais
            </p>
          </div>
          <div className="flex gap-3">
            <Btn variant="secondary" icon="filter_list">
              Filtros
            </Btn>
          </div>
        </div>
      </header>

      {/* abas de categoria */}
      {categoriasDisponiveis.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categoriasDisponiveis.map((cat) => {
            const label =
              cat === "todas"
                ? "Todas"
                : CATEGORIA_LABEL[cat] ?? cat;
            const icon = cat === "todas" ? "list" : CATEGORIA_ICON[cat] ?? "help";
            const count =
              cat === "todas" ? ocorrencias.length : contagem.get(cat) ?? 0;

            return (
              <Tab
                key={cat}
                active={filter === cat}
                onClick={() => setFilter(cat)}
                icon={icon}
              >
                {label} <span className="opacity-60">({count})</span>
              </Tab>
            );
          })}
        </div>
      )}

      {/* lista + detalhe */}
      {ocorrenciasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="search_off" className="text-on-surface-variant text-[48px] mb-4" />
          <p className="text-sm text-on-surface-variant">
            Nenhuma ocorrência encontrada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* lista */}
          <div className="col-span-12 lg:col-span-7 space-y-3">
            {ocorrenciasFiltradas.map((o) => {
              const zonaNome =
                o.zona != null ? zonaLookup.get(o.zona) ?? `#${o.zona}` : null;
              const autorNome =
                o.autor != null
                  ? usuarioLookup.get(o.autor) ?? `#${o.autor}`
                  : null;

              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={`w-full card-tonal p-6 shadow-ambient-sm text-left relative overflow-hidden hover:shadow-ambient transition-all ${
                    selected === o.id ? "ring-2 ring-secondary" : ""
                  }`}
                >
                  <span
                    className={`absolute top-0 left-0 bottom-0 w-1 ${statusAccentClass(o.status)}`}
                  />
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono uppercase tracking-mono font-bold text-slate-400">
                          #{o.id}
                        </span>
                        <Chip tone={statusToneFor(o.status)}>
                          {o.status.toUpperCase()}
                        </Chip>
                      </div>
                      <MetaTag>{formatDate(o.created_at)}</MetaTag>
                    </div>
                    <h3 className="font-headline font-bold text-lg text-primary mb-2">
                      {o.titulo}
                    </h3>
                    <div className="flex items-center gap-4 text-[11px] text-on-surface-variant flex-wrap">
                      {zonaNome && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="location_on" className="text-[14px]" />
                          {zonaNome}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Icon
                          name={
                            CATEGORIA_ICON[o.categoria] ?? "help"
                          }
                          className="text-[14px]"
                        />
                        {CATEGORIA_LABEL[o.categoria] ?? o.categoria}
                      </span>
                      {autorNome && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="person" className="text-[14px]" />
                          {autorNome}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* painel de detalhe */}
          {selecionada && (
            <aside className="col-span-12 lg:col-span-5">
              <div className="card-tonal shadow-ambient-sm sticky top-24 overflow-hidden">
                {/* cabeçalho do detalhe */}
                <div className="bg-gradient-to-br from-primary to-primary-container text-white p-6">
                  <Chip tone="primarySoft" className="!bg-white/15 !text-white">
                    {(CATEGORIA_LABEL[selecionada.categoria] ?? selecionada.categoria).toUpperCase()}
                  </Chip>
                  <h2 className="font-headline font-black text-2xl tracking-tighter mt-3">
                    {selecionada.titulo}
                  </h2>
                  {selecionada.zona != null && (
                    <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
                      <Icon name="location_on" className="text-[14px]" />
                      {zonaLookup.get(selecionada.zona) ?? `Zona #${selecionada.zona}`}
                    </p>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {/* descricao (relato) */}
                  <div>
                    <MetaTag className="block mb-2">RELATO</MetaTag>
                    <p className="text-[13px] text-on-surface leading-relaxed">
                      {selecionada.descricao}
                    </p>

                    {(selecionada.autor != null || selecionada.coordenadas) && (
                      <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-on-surface-variant">
                        {selecionada.autor != null && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="person" className="text-[14px]" />
                            {usuarioLookup.get(selecionada.autor) ??
                              `Usuário #${selecionada.autor}`}
                          </span>
                        )}
                        {selecionada.coordenadas && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="pin_drop" className="text-[14px]" />
                            {formatCoords(selecionada.coordenadas)}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 block">
                      {formatDate(selecionada.created_at)}
                    </span>
                  </div>

                  {/* analise de ia */}
                  {selecionada.feito_ia && (
                    <div className="card-recessed p-4 border-l-4 border-secondary">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="psychology"
                          filled
                          className="text-secondary text-[18px]"
                        />
                        <MetaTag className="text-secondary">
                          ANÁLISE DE IA
                        </MetaTag>
                      </div>

                      {selecionada.analise_ia && (
                        <p className="text-[13px] text-on-surface leading-relaxed mb-3">
                          {selecionada.analise_ia}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {selecionada.nivel_perigo_ia && (
                          <Chip tone={statusToneFor(selecionada.nivel_perigo_ia)}>
                            {selecionada.nivel_perigo_ia}
                          </Chip>
                        )}
                        <Chip tone={selecionada.valido_ia ? "secondary" : "warning"}>
                          {selecionada.valido_ia
                            ? "VALIDA"
                            : "INVÁLIDA"}
                        </Chip>
                      </div>
                    </div>
                  )}

                  {!selecionada.feito_ia && (
                    <div className="card-recessed p-4 border-l-4 border-outline-variant">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="psychology"
                          className="text-on-surface-variant text-[18px]"
                        />
                        <MetaTag>ANÁLISE DE IA</MetaTag>
                      </div>
                      <p className="text-[12px] text-on-surface-variant">
                        Análise de IA pendente para esta ocorrência.
                      </p>
                    </div>
                  )}

                  {/* analise tecnica */}
                  {selecionada.analise_tecnico && (
                    <div className="card-recessed p-4 border-l-4 border-primary">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon
                          name="engineering"
                          className="text-primary text-[18px]"
                        />
                        <MetaTag className="text-primary">
                          ANÁLISE TÉCNICA
                        </MetaTag>
                      </div>

                      <p className="text-[13px] text-on-surface leading-relaxed mb-3">
                        {selecionada.analise_tecnico}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {selecionada.nivel_perigo_tecnico && (
                          <Chip tone={statusToneFor(selecionada.nivel_perigo_tecnico)}>
                            {selecionada.nivel_perigo_tecnico}
                          </Chip>
                        )}
                        {selecionada.valido_tecnico != null && (
                          <Chip tone={selecionada.valido_tecnico ? "secondary" : "warning"}>
                            {selecionada.valido_tecnico
                              ? "VALIDADA"
                              : "REJEITADA"}
                          </Chip>
                        )}
                      </div>
                    </div>
                  )}

                  {/* anexos */}
                  {selecionada.anexos.length > 0 && (
                    <div>
                      <MetaTag className="block mb-2">ANEXOS</MetaTag>
                      <p className="text-[12px] text-on-surface-variant">
                        {selecionada.anexos.length} arquivo
                        {selecionada.anexos.length !== 1 ? "s" : ""} vinculado
                        {selecionada.anexos.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
