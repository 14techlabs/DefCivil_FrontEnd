"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { MOCK_FORM_CONFIG } from "@/app/data/mock";
import { api } from "@/app/services/Api";
import { loadPublicFormConfig, PUBLIC_FORM_CONFIG_STORAGE_KEY } from "@/app/lib/publicFormConfig";

// mapa de seleção de local publico (sem login)
const PublicMapPicker = dynamic(
  () => import("@/app/components/PublicMapPicker").then((m) => m.PublicMapPicker),
  { ssr: false },
);

interface EventoPublico {
  id: number;
  tipo: string;
  nome: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  resumo_publico: string | null;
  recomendacoes: string[];
  zonas: number[];
}

interface EntidadePublica {
  id: number;
  nome: string;
}

interface ChecklistPublico {
  id: number;
  entidade: number;
  label: string;
  icon: string;
  ativo: boolean;
  fixo: boolean;
  ordem: number;
}

interface ReportPublicoResponse {
  entidade: EntidadePublica;
  checklist: ChecklistPublico[];
  evento_ativo: EventoPublico | null;
}

interface AnexoSelecionado {
  arquivo: File;
  nome: string;
  tamanho: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

function mensagemApi(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data;
  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    const mensagem = payload.error ?? payload.detail ?? payload.message;

    if (typeof mensagem === "string" && mensagem.trim()) return mensagem;

    for (const valor of Object.values(payload)) {
      if (typeof valor === "string" && valor.trim()) return valor;
      if (Array.isArray(valor)) {
        const textos = valor.filter((item): item is string => typeof item === "string");
        if (textos.length > 0) return textos.join(" ");
      }
    }
  }

  if (!error.response) {
    return "Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.";
  }

  if (error.response.status >= 500) {
    return "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.";
  }

  return fallback;
}

/* máscaras: aceitam apenas dígitos e formatam enquanto digita */
function mascararCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mascararTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* configuração vinda da tela de Entidade */
const CATEGORIA_INICIAL = MOCK_FORM_CONFIG.categorias.find((item) => item.ativo)?.id ?? "climatico";

function PublicReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entidadeParam = searchParams.get("entidade");
  const entidadeId = entidadeParam && /^[1-9]\d*$/.test(entidadeParam)
    ? Number(entidadeParam)
    : null;

  const [config, setConfig] = useState(loadPublicFormConfig);
  const categorias = config.categorias.filter((item) => item.ativo);
  const [entidades, setEntidades] = useState<EntidadePublica[]>([]);
  const [carregandoEntidades, setCarregandoEntidades] = useState(true);
  const [erroEntidades, setErroEntidades] = useState("");
  const [tentativaEntidades, setTentativaEntidades] = useState(0);
  const [fluxoInicial, setFluxoInicial] = useState<"atual" | "outro" | null>(null);
  const [resolvendoEntidade, setResolvendoEntidade] = useState(false);
  const [erroResolverEntidade, setErroResolverEntidade] = useState("");
  const [entidadeSelecionada, setEntidadeSelecionada] = useState<EntidadePublica | null>(null);
  const [checklist, setChecklist] = useState<ChecklistPublico[]>([]);
  const [eventoAtivo, setEventoAtivo] = useState<EventoPublico | null>(null);
  const [erroReport, setErroReport] = useState<{ entidadeId: number; mensagem: string } | null>(null);
  const [tentativaReport, setTentativaReport] = useState(0);

  useEffect(() => {
    const atualizar = (event: StorageEvent) => {
      if (event.key === PUBLIC_FORM_CONFIG_STORAGE_KEY) setConfig(loadPublicFormConfig());
    };
    const atualizarCustom = (event: Event) => {
      const detail = (event as CustomEvent<typeof config>).detail;
      setConfig(detail ?? loadPublicFormConfig());
    };
    window.addEventListener("storage", atualizar);
    window.addEventListener("gardian:public-form-config-changed", atualizarCustom);
    return () => {
      window.removeEventListener("storage", atualizar);
      window.removeEventListener("gardian:public-form-config-changed", atualizarCustom);
    };
  }, []);

  // Lista pública exibida antes do formulário.
  useEffect(() => {
    if (entidadeId !== null || fluxoInicial !== "outro") return;
    let cancelled = false;
    api
      .get<{ entidades: EntidadePublica[] }>("/entidades/listar-publicas/")
      .then((res) => {
        if (cancelled) return;
        setEntidades(res.data.entidades ?? []);
        setErroEntidades("");
      })
      .catch((error) => {
        if (!cancelled) {
          setEntidades([]);
          setErroEntidades(mensagemApi(error, "Não foi possível carregar as Defesas Civis disponíveis."));
        }
      })
      .finally(() => {
        if (!cancelled) setCarregandoEntidades(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entidadeId, fluxoInicial, tentativaEntidades]);

  // Checklist e evento pertencem à entidade indicada na URL.
  useEffect(() => {
    if (entidadeId === null) return;
    let cancelled = false;

    api
      .get<ReportPublicoResponse>(`/entidades/${entidadeId}/report/`)
      .then((res) => {
        if (cancelled) return;
        setEntidadeSelecionada(res.data.entidade);
        setChecklist((res.data.checklist ?? []).filter((item) => item.ativo));
        setEventoAtivo(res.data.evento_ativo ?? null);
        setErroReport(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setErroReport({
          entidadeId,
          mensagem: mensagemApi(error, "Não foi possível carregar o formulário desta entidade."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [entidadeId, tentativaReport]);

  const [categoria, setCategoria] = useState(CATEGORIA_INICIAL);
  const categoriaAtual = categorias.some((item) => item.id === categoria)
    ? categoria
    : categorias[0]?.id ?? "outro";
  const [descricao, setDescricao] = useState("");
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [modoLocal, setModoLocal] = useState<"endereco" | "coordenada">("endereco");
  const [endereco, setEndereco] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [contato, setContato] = useState("");
  const [cpf, setCpf] = useState("");
  const [anexos, setAnexos] = useState<AnexoSelecionado[]>([]);
  const [avisoAnexos, setAvisoAnexos] = useState<string[]>([]);
  const [geoStatus, setGeoStatus] = useState<"idle" | "carregando" | "ok" | "erro">("idle");
  const [geoBuscando, setGeoBuscando] = useState(false);
  const [geoAviso, setGeoAviso] = useState("");
  const [enderecoAviso, setEnderecoAviso] = useState("");
  const [localEntidade, setLocalEntidade] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [destino, setDestino] = useState<"atual" | "outro" | null>(() => {
    const valor = searchParams.get("destino");
    return valor === "atual" || valor === "outro" ? valor : null;
  });
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");
  const [ufDestino, setUfDestino] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cidadeAtendida, setCidadeAtendida] = useState<boolean | null>(null);
  const [ajusteManualDoMapa, setAjusteManualDoMapa] = useState(false);

  const pegarLocalizacao = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("erro");
      setGeoAviso("Seu navegador não suporta geolocalização. Marque o local no mapa.");
      return;
    }
    setGeoStatus("carregando");
    setGeoAviso("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setModoLocal("coordenada");
        setGeoStatus("ok");
      },
      (err) => {
        setGeoStatus("erro");
        const msgs: Record<number, string> = {
          1: "Acesso à localização negado. Permita no navegador e tente de novo, ou marque o ponto no mapa.",
          2: "Localização indisponível no momento. Marque o ponto no mapa.",
          3: "Tempo esgotado. Tente novamente ou marque o ponto no mapa.",
        };
        setGeoAviso(
          msgs[err.code] ?? "Não foi possível obter a localização. Marque o ponto no mapa.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (
      !entidadeSelecionada ||
      entidadeSelecionada.id !== entidadeId ||
      destino !== "atual" ||
      (lat.trim() && lng.trim())
    ) return;
    const timer = window.setTimeout(pegarLocalizacao, 0);
    return () => window.clearTimeout(timer);
  }, [pegarLocalizacao, entidadeId, entidadeSelecionada, destino, lat, lng]);

  const buscarCep = async () => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setEnderecoAviso("Informe um CEP válido com 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    setEnderecoAviso("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const dados = (await resposta.json()) as ViaCepResponse;
      if (!resposta.ok || dados.erro || !dados.localidade || !dados.uf) {
        setEnderecoAviso("CEP não encontrado. Confira os números e tente novamente.");
        setCidadeAtendida(null);
        return;
      }

      setCidadeDestino(dados.localidade);
      setUfDestino(dados.uf);
      const partes = [dados.logradouro, numero, dados.bairro, `${dados.localidade} - ${dados.uf}`]
        .filter(Boolean);
      const enderecoCompleto = partes.join(", ");
      setEndereco(enderecoCompleto);

      const geo = await api.get<{
        candidatos: { lat: number; lng: number; entidade?: string }[];
      }>("/api/geocodificar/", { params: { endereco: enderecoCompleto } });
      const candidato = geo.data.candidatos?.[0];
      if (!candidato) {
        // Um CEP pode ser válido, mas o geocodificador devolver apenas um ponto
        // aproximado fora do polígono da entidade. Nesse caso, não concluímos que
        // a cidade está sem cobertura: o cidadão confirma o ponto manualmente.
        setCidadeAtendida(true);
        setLocalEntidade("");
        setLat("");
        setLng("");
        setModoLocal("coordenada");
        setGeoStatus("idle");
        setAjusteManualDoMapa(true);
        return;
      }
      setCidadeAtendida(true);
      setAjusteManualDoMapa(false);
      setLocalEntidade(candidato.entidade ?? dados.localidade);
      setLat(String(candidato.lat));
      setLng(String(candidato.lng));
      setModoLocal("coordenada");
      setGeoStatus("ok");
    } catch {
      setEnderecoAviso("Não foi possível consultar o CEP agora. Tente novamente.");
      setCidadeAtendida(null);
    } finally {
      setBuscandoCep(false);
    }
  };

  const buscarEndereco = async () => {
    const termo = endereco.trim();
    if (termo.length < 4) {
      setEnderecoAviso("Informe um endereço com pelo menos 4 caracteres.");
      return;
    }
    setGeoBuscando(true);
    setEnderecoAviso("");
    try {
      const res = await api.get<{
        candidatos: { lat: number; lng: number; entidade?: string }[];
        aviso?: string;
      }>("/api/geocodificar/", { params: { endereco: termo } });
      const primeiro = res.data.candidatos?.[0];
      if (primeiro) {
        setLat(String(primeiro.lat));
        setLng(String(primeiro.lng));
        setModoLocal("coordenada");
        setGeoStatus("ok");
        setLocalEntidade(primeiro.entidade ?? "");
      } else {
        setLocalEntidade("");
        setEnderecoAviso(
          res.data.aviso ?? "Nenhum endereço encontrado. Marque o ponto no mapa.",
        );
      }
    } catch (error) {
      setEnderecoAviso(
        mensagemApi(error, "Não foi possível localizar o endereço. Marque o ponto no mapa."),
      );
    } finally {
      setGeoBuscando(false);
    }
  };

  const enviar = async () => {
    if (!entidadeSelecionada || entidadeSelecionada.id !== entidadeId) {
      setErro("Selecione a Defesa Civil responsável antes de enviar o registro.");
      return;
    }
    if (descricao.trim().length < config.minCaracteresDescricao) {
      setErro(
        `Descreva o que está acontecendo com pelo menos ${config.minCaracteresDescricao} caracteres.`,
      );
      return;
    }
    if (config.exigirContato && contato.replace(/\D/g, "").length < 10) {
      setErro("Informe um telefone válido (com DDD) para prosseguir.");
      return;
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      setErro("Informe um CPF válido (11 dígitos) para prosseguir.");
      return;
    }
    if (config.exigirLocalizacao && (!lat.trim() || !lng.trim())) {
      setErro("Marque o local no mapa ou use sua localização atual.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const marcacoes = checklist.filter((item) => checks[item.id]).map((item) => item.id);
      const formData = new FormData();
      formData.append("entidade_id", String(entidadeSelecionada.id));
      formData.append("descricao", descricao.trim());
      formData.append("categoria", categoriaAtual);
      formData.append("cpf", cpf.replace(/\D/g, ""));
      formData.append("contato", contato.replace(/\D/g, ""));
      formData.append("endereco", endereco.trim());
      formData.append("coordenadas", JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng) }));
      formData.append("marcacoes", JSON.stringify(marcacoes));
      formData.append("website", "");
      for (const anexo of anexos) formData.append("anexos", anexo.arquivo);

      const res = await api.post<{ protocolo: string; aviso_anexos?: string[] }>(
        "/ocorrencias/publicas/",
        formData,
      );
      setAvisoAnexos(res.data.aviso_anexos ?? []);
      setProtocolo(res.data.protocolo);
      setEnviado(true);
    } catch (error) {
      setErro(
        mensagemApi(error, "Não foi possível enviar o registro. Confira os dados e tente novamente."),
      );
    } finally {
      setEnviando(false);
    }
  };

  const trocarEntidade = () => {
    setFluxoInicial(null);
    setEntidadeSelecionada(null);
    setChecklist([]);
    setEventoAtivo(null);
    setChecks({});
    setDestino(null);
    setEndereco("");
    setLat("");
    setLng("");
    setCep("");
    setNumero("");
    setCidadeDestino("");
    setUfDestino("");
    setCidadeAtendida(null);
    setLocalEntidade("");
    setGeoStatus("idle");
    setGeoAviso("");
    setEnderecoAviso("");
    setErro("");
    router.push("/report");
  };

  const resolverEntidadeAtual = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErroResolverEntidade("Seu navegador não permite consultar a localização. Escolha uma opção da lista.");
      return;
    }

    setResolvendoEntidade(true);
    setErroResolverEntidade("");
    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        try {
          const latitude = posicao.coords.latitude.toFixed(6);
          const longitude = posicao.coords.longitude.toFixed(6);
          const resposta = await api.get<{ entidade_id: number; nome: string }>(
            "/entidades/resolver/",
            {
              params: {
                lat: latitude,
                lng: longitude,
              },
            },
          );
          setLat(latitude);
          setLng(longitude);
          setLocalEntidade(resposta.data.nome);
          setDestino("atual");
          setCidadeAtendida(true);
          setModoLocal("coordenada");
          setGeoStatus("ok");
          router.push(`/report?entidade=${resposta.data.entidade_id}&destino=atual`);
        } catch (error) {
          setErroResolverEntidade(
            mensagemApi(error, "Não foi possível identificar uma Defesa Civil para sua localização."),
          );
        } finally {
          setResolvendoEntidade(false);
        }
      },
      () => {
        setErroResolverEntidade("Não foi possível acessar sua localização. Escolha uma opção da lista.");
        setResolvendoEntidade(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  /* ───────── confirmação ───────── */
  /* ───────── canal desativado pela entidade ───────── */
  if (entidadeId === null) {
    const parametroInvalido = entidadeParam !== null;
    return (
      <main className="min-h-screen bg-surface">
        <header className="bg-gradient-to-br from-primary to-primary-container text-white">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                <Icon name="shield" filled className="text-[22px] text-white" />
              </div>
              <div>
                <p className="font-headline text-xl font-black leading-tight tracking-tight">GARDIAN</p>
                <p className="text-[10px] font-bold uppercase tracking-mono text-white/60">
                  Canal público da Defesa Civil
                </p>
              </div>
            </div>
            <h1 className="font-headline text-4xl font-black leading-tight tracking-tighter">
              Registrar uma ocorrência
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
              Primeiro, informe para quem e onde você deseja fazer o registro.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-8">
          {parametroInvalido && (
            <div role="alert" className="mb-5 rounded-xl bg-error-container p-4 text-sm font-semibold text-on-error-container">
              O endereço informado contém uma entidade inválida. Escolha uma opção abaixo.
            </div>
          )}

          {fluxoInicial === null && (
            <section className="card-tonal p-6 shadow-ambient-sm">
              <h2 className="mb-4 text-sm font-bold text-primary">A ocorrência é para quem?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setFluxoInicial("atual");
                    resolverEntidadeAtual();
                  }}
                  className="rounded-xl bg-surface-container-low p-5 text-left text-primary transition-all hover:bg-surface-container hover:shadow-ambient-sm"
                >
                  <Icon name="person_pin_circle" className="mb-3 text-[26px] text-secondary" />
                  <span className="block text-sm font-bold">Para mim, neste local</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                    Usar minha localização para encontrar automaticamente a Defesa Civil responsável.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFluxoInicial("outro")}
                  className="rounded-xl bg-surface-container-low p-5 text-left text-primary transition-all hover:bg-surface-container hover:shadow-ambient-sm"
                >
                  <Icon name="group" className="mb-3 text-[26px] text-secondary" />
                  <span className="block text-sm font-bold">Para outra pessoa ou local</span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                    Escolher a Defesa Civil e informar o endereço onde a ocorrência aconteceu.
                  </span>
                </button>
              </div>
            </section>
          )}

          {fluxoInicial === "atual" && (
            <section className="card-tonal p-8 text-center shadow-ambient-sm">
              {resolvendoEntidade ? (
                <>
                  <Icon name="progress_activity" className="mb-3 animate-spin text-[30px] text-secondary" />
                  <p className="text-sm font-semibold text-on-surface-variant">
                    Identificando a Defesa Civil da sua localização…
                  </p>
                </>
              ) : (
                <>
                  <Icon name="location_off" filled className="mb-3 text-[32px] text-error" />
                  <p role="alert" className="text-sm font-semibold text-on-surface">
                    {erroResolverEntidade || "Não foi possível identificar a área de atendimento."}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                    Você ainda pode registrar uma ocorrência para outra pessoa ou para outro local.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Btn
                      variant="secondary"
                      icon="refresh"
                      onClick={resolverEntidadeAtual}
                      disabled={resolvendoEntidade}
                    >
                      Tentar novamente
                    </Btn>
                    <Btn variant="ghost" icon="group" onClick={() => setFluxoInicial("outro")}>
                      Informar outro local
                    </Btn>
                  </div>
                </>
              )}
            </section>
          )}

          {fluxoInicial === "outro" && (
            carregandoEntidades ? (
              <div className="card-tonal p-8 text-center shadow-ambient-sm">
                <Icon name="progress_activity" className="mb-3 animate-spin text-[28px] text-secondary" />
                <p className="text-sm font-semibold text-on-surface-variant">Carregando Defesas Civis…</p>
              </div>
            ) : erroEntidades ? (
              <div className="card-tonal p-8 text-center shadow-ambient-sm">
                <Icon name="error" filled className="mb-3 text-[30px] text-error" />
                <p className="text-sm font-semibold text-on-surface">{erroEntidades}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Btn
                    variant="secondary"
                    icon="refresh"
                    onClick={() => {
                      setCarregandoEntidades(true);
                      setErroEntidades("");
                      setTentativaEntidades((valor) => valor + 1);
                    }}
                  >
                    Tentar novamente
                  </Btn>
                  <Btn variant="ghost" icon="arrow_back" onClick={() => setFluxoInicial(null)}>
                    Voltar
                  </Btn>
                </div>
              </div>
            ) : (
              <section className="card-tonal p-6 shadow-ambient-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-primary">Onde aconteceu a ocorrência?</h2>
                  <Btn variant="ghost" icon="arrow_back" onClick={() => setFluxoInicial(null)}>
                    Voltar
                  </Btn>
                </div>
                <p className="mb-4 text-xs text-on-surface-variant">
                  Escolha a Defesa Civil responsável pelo local da ocorrência.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {entidades.map((entidade) => (
                    <button
                      key={entidade.id}
                      type="button"
                      onClick={() => {
                        setDestino("outro");
                        router.push(`/report?entidade=${entidade.id}&destino=outro`);
                      }}
                      className="flex items-center gap-3 rounded-xl bg-surface-container-low p-4 text-left text-primary transition-all hover:bg-surface-container hover:shadow-ambient-sm"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                        <Icon name="account_balance" className="text-[22px] text-secondary" />
                      </span>
                      <span className="flex-1 text-sm font-bold">{entidade.nome}</span>
                      <Icon name="arrow_forward" className="text-[20px] text-on-surface-variant" />
                    </button>
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      </main>
    );
  }

  const carregandoReport = entidadeSelecionada?.id !== entidadeId && erroReport?.entidadeId !== entidadeId;
  if (carregandoReport) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="card-tonal w-full max-w-lg p-10 text-center shadow-ambient">
          <Icon name="progress_activity" className="mb-3 animate-spin text-[30px] text-secondary" />
          <p className="text-sm font-semibold text-on-surface-variant">Carregando formulário…</p>
        </div>
      </main>
    );
  }

  if (erroReport?.entidadeId === entidadeId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="card-tonal w-full max-w-lg p-10 text-center shadow-ambient">
          <Icon name="error" filled className="mb-3 text-[32px] text-error" />
          <h1 className="font-headline text-2xl font-black text-primary">Formulário indisponível</h1>
          <p className="mt-3 text-sm text-on-surface-variant">{erroReport.mensagem}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Btn
              variant="secondary"
              icon="refresh"
              onClick={() => {
                setErroReport(null);
                setTentativaReport((valor) => valor + 1);
              }}
            >
              Tentar novamente
            </Btn>
            <Btn variant="ghost" icon="arrow_back" onClick={trocarEntidade}>
              Escolher outra
            </Btn>
          </div>
        </div>
      </main>
    );
  }

  if (!config.ativo) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="card-tonal p-10 shadow-ambient max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mx-auto mb-5">
            <Icon name="pause_circle" filled className="text-on-surface-variant text-[32px]" />
          </div>
          <h1 className="font-headline font-black text-3xl tracking-tighter text-primary">
            Canal indisponível
          </h1>
          <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
            {config.mensagemDesativado}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-6">
            {entidadeSelecionada?.nome}
          </p>
          <div className="mt-5 flex justify-center">
            <Btn variant="ghost" icon="arrow_back" onClick={trocarEntidade}>
              Escolher outra Defesa Civil
            </Btn>
          </div>
        </div>
      </main>
    );
  }

  if (enviado) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="card-tonal p-10 shadow-ambient max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-5">
            <Icon name="check_circle" filled className="text-secondary text-[32px]" />
          </div>
          <h1 className="font-headline font-black text-3xl tracking-tighter text-primary">
            Registro enviado
          </h1>
          <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
            Sua ocorrência foi encaminhada à Defesa Civil e será analisada pela equipe.
            {eventoAtivo ? " Ela foi vinculada automaticamente ao evento em andamento." : ""}
          </p>
          <div className="card-recessed p-5 mt-6">
            <MetaTag className="block mb-1">PROTOCOLO</MetaTag>
            <p className="font-headline font-black text-2xl text-primary tracking-tighter">{protocolo}</p>
          </div>
          <p className="text-[12px] text-on-surface-variant mt-5">
            Em caso de risco imediato à vida, ligue <strong className="text-error">199</strong> (Defesa Civil) ou{" "}
            <strong className="text-error">193</strong> (Bombeiros).
          </p>
          {avisoAnexos.length > 0 && (
            <div role="alert" className="mt-5 rounded-xl bg-tertiary-container p-4 text-left text-sm text-on-tertiary-container">
              <p className="font-bold">A ocorrência foi registrada, mas alguns anexos não foram enviados:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {avisoAnexos.map((aviso) => <li key={aviso}>{aviso}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-6">
            <Btn
              variant="ghost"
              icon="add"
              onClick={() => {
                setEnviado(false);
                setDescricao("");
                setChecks({});
                setEndereco("");
                setLat("");
                setLng("");
                setContato("");
                setCpf("");
                setAnexos([]);
                setAvisoAnexos([]);
                setGeoStatus("idle");
                setGeoAviso("");
                setEnderecoAviso("");
                setGeoBuscando(false);
                setDestino(null);
                setCidadeAtendida(null);
                setAjusteManualDoMapa(false);
                setCep("");
                setNumero("");
                setCidadeDestino("");
                setUfDestino("");
                window.setTimeout(pegarLocalizacao, 0);
              }}
            >
              Registrar outra ocorrência
            </Btn>
          </div>
        </div>
      </main>
    );
  }

  /* ───────── formulário ───────── */
  return (
    <main className="min-h-screen bg-surface">
      {/* topo */}
      <header className="bg-gradient-to-br from-primary to-primary-container text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Icon name="shield" filled className="text-white text-[22px]" />
            </div>
            <div>
              <p className="font-headline font-black text-xl leading-tight tracking-tight">GARDIAN</p>
              <p className="text-[10px] font-bold tracking-mono text-white/60 uppercase">
                {entidadeSelecionada?.nome}
              </p>
            </div>
          </div>
          <h1 className="font-headline font-black text-4xl tracking-tighter leading-tight">
            {config.titulo}
          </h1>
          <p className="text-white/75 text-sm mt-3 max-w-xl leading-relaxed">{config.subtitulo}</p>
          <button
            type="button"
            onClick={trocarEntidade}
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-white/80 transition-colors hover:text-white"
          >
            <Icon name="swap_horiz" className="text-[17px]" />
            Trocar Defesa Civil
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {destino !== "atual" && (
        <section className="card-tonal p-6 shadow-ambient-sm">
          <div className="mb-4 flex items-center gap-3">
            <Icon name="my_location" filled className="text-[22px] text-secondary" />
            <div>
              <h2 className="text-sm font-bold text-primary">Onde aconteceu a ocorrência?</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {destino === "outro"
                  ? "Informe o endereço onde a ocorrência aconteceu."
                  : "Escolha para qual local deseja registrar."}
              </p>
            </div>
          </div>
          {destino === null && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setDestino("atual"); setCidadeAtendida(true); pegarLocalizacao(); }} className="rounded-xl bg-surface-container-low p-4 text-left text-primary transition-all hover:bg-surface-container">
              <Icon name="near_me" className="mb-2 text-[22px]" />
              <span className="block text-sm font-bold">Neste local</span>
              <span className="mt-1 block text-xs opacity-75">Usar a localização do navegador</span>
            </button>
            <button type="button" onClick={() => { setDestino("outro"); setCidadeAtendida(null); setAjusteManualDoMapa(false); }} className="rounded-xl bg-surface-container-low p-4 text-left text-primary transition-all hover:bg-surface-container">
              <Icon name="location_city" className="mb-2 text-[22px]" />
              <span className="block text-sm font-bold">Outro local ou outra pessoa</span>
              <span className="mt-1 block text-xs opacity-75">Buscar o endereço pelo CEP</span>
            </button>
          </div>
          )}
          {destino === "outro" && (
            <div className="mt-5 rounded-xl bg-surface-container-low p-4">
              <MetaTag className="mb-2 block">ENDEREÇO DA OCORRÊNCIA</MetaTag>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <input value={cep} onChange={(event) => setCep(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="CEP (8 dígitos)" inputMode="numeric" className="rounded-lg bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary" />
                <input value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="Número" className="rounded-lg bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-secondary" />
                <Btn variant="secondary" icon="search" onClick={buscarCep}>{buscandoCep ? "Buscando…" : "Buscar CEP"}</Btn>
              </div>
              {enderecoAviso && <p className="mt-2 text-xs font-bold text-error">{enderecoAviso}</p>}
              {cidadeAtendida === true && cidadeDestino && !ajusteManualDoMapa && <p className="mt-3 text-xs font-bold text-secondary">Gardian disponível em {cidadeDestino}/{ufDestino}. Confirme o ponto no mapa abaixo.</p>}
              {ajusteManualDoMapa && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-[#E6B800] bg-[#FFF4CC] p-4 text-[#4D3D00]">
                    <Icon name="edit_location" filled className="mt-0.5 shrink-0 text-[20px] text-[#8A6800]" />
                    <div>
                      <p className="text-sm font-black">Confirme o local no mapa</p>
                      <p className="mt-1 text-xs font-semibold leading-relaxed">
                        O CEP foi encontrado, mas o ponto automático não ficou preciso. Clique no mapa para marcar o local exato da ocorrência.
                      </p>
                    </div>
                  </div>
                  <PublicMapPicker
                    lat={lat}
                    lng={lng}
                    height={300}
                    entidadeId={entidadeSelecionada?.id}
                    zonasDestaqueIds={eventoAtivo?.zonas}
                    onChange={(la, ln) => {
                      setLat(la);
                      setLng(ln);
                      setModoLocal("coordenada");
                      setGeoStatus("ok");
                      setAjusteManualDoMapa(false);
                    }}
                  />
                  <p className="text-center text-xs font-semibold text-on-surface-variant">
                    O restante do formulário será liberado depois que você marcar o ponto.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
        )}

        {destino === "outro" && cidadeAtendida === false && (
          <section className="rounded-xl border-l-4 border-error bg-error-container p-6 text-on-error-container">
            <div className="mb-2 flex items-center gap-2"><Icon name="info" filled className="text-[20px]" /><h2 className="font-bold">Gardian ainda não está disponível em {cidadeDestino}/{ufDestino}</h2></div>
            <p className="text-sm leading-relaxed">Entre em contato com a Defesa Civil pelo <strong>199</strong> ou com o Corpo de Bombeiros pelo <strong>193</strong>.</p>
          </section>
        )}

        {(destino === "atual" || (destino === "outro" && cidadeAtendida === true && !ajusteManualDoMapa)) && <>
        {/* aviso do evento ativo da entidade selecionada */}
        {config.mostrarAvisoEvento &&
          eventoAtivo &&
          (eventoAtivo.resumo_publico?.trim() ||
            eventoAtivo.recomendacoes?.some((recomendacao) => recomendacao.trim())) && (
            <section className="card-tonal p-6 shadow-ambient-sm border-l-4 border-error">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="campaign" filled className="text-error text-[20px]" />
                <MetaTag className="text-error">AVISO EM ANDAMENTO · {eventoAtivo.nome.toUpperCase()}</MetaTag>
              </div>
              <p className="text-[13px] text-on-surface leading-relaxed">{eventoAtivo.resumo_publico}</p>
              <div className="mt-4 space-y-2">
                {(eventoAtivo.recomendacoes ?? []).filter((r) => r.trim()).map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon name="verified_user" filled className="text-secondary text-[16px] mt-0.5 shrink-0" />
                    <p className="text-[12px] text-on-surface-variant leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* tipo */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">1. O que está acontecendo?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex min-h-32 flex-col items-center justify-center gap-2 p-4 rounded-lg transition-all ${
                  categoriaAtual === c.id
                    ? "bg-primary text-white shadow-ambient-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="flex flex-col items-center justify-center gap-2">
                  <Icon name={c.icon} filled={categoriaAtual === c.id} className="text-[24px] leading-none" />
                  <span className="text-sm font-bold text-center leading-snug">
                    {c.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* descrição */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">2. Descreva a situação</h2>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={5}
            placeholder="Ex.: a água começou a entrar no quintal por volta das 6h e já está na altura do joelho na rua..."
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-base font-medium text-on-surface focus:ring-2 focus:ring-secondary outline-none resize-none placeholder:text-[14px] placeholder:text-on-surface-variant/75"
          />
          <p className="mt-2 text-xs font-medium text-on-surface-variant">{descricao.length} caracteres</p>
        </section>

        {/* checklist */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-1 text-sm font-bold text-primary">3. Marque o que se aplica</h2>
          <p className="mb-4 text-sm text-on-surface-variant">
            Isso ajuda a equipe a definir a prioridade do atendimento.
          </p>
          <div className="space-y-2">
            {checklist.map((c) => {
              const on = !!checks[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChecks((v) => ({ ...v, [c.id]: !v[c.id] }))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-lg text-left transition-all ${
                    on ? "bg-secondary/10 ring-1 ring-secondary/40" : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <Icon
                    name={on ? "check_box" : "check_box_outline_blank"}
                    className={`text-[20px] shrink-0 ${on ? "text-secondary" : "text-on-surface-variant"}`}
                  />
                  <Icon name={c.icon} className={`text-[18px] shrink-0 ${on ? "text-secondary" : "text-on-surface-variant"}`} />
                  <span className={`text-sm font-medium ${on ? "text-primary font-bold" : "text-on-surface"}`}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* localização */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-4 text-sm font-bold text-primary">4. Onde é?</h2>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setModoLocal("endereco")}
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                modoLocal === "endereco" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              Endereço
            </button>
            <button
              type="button"
              onClick={() => setModoLocal("coordenada")}
              className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
                modoLocal === "coordenada" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              Coordenadas
            </button>
            <Btn variant="secondary" icon="my_location" onClick={pegarLocalizacao}>
              {geoStatus === "carregando" ? "Localizando…" : "Usar minha localização"}
            </Btn>
          </div>

          {geoStatus === "ok" && (
            <Chip tone="secondary" icon="check" className="mb-3">
              LOCALIZAÇÃO CAPTURADA
            </Chip>
          )}
          {geoStatus === "erro" && (
            <>
              <Chip tone="error" icon="error" className="mb-1">
                {geoAviso || "NÃO FOI POSSÍVEL OBTER A LOCALIZAÇÃO — PREENCHA MANUALMENTE"}
              </Chip>
              <p className="text-[10px] text-on-surface-variant mb-3">
                Dica: a geolocalização precisa de HTTPS (ou localhost). Você também pode marcar
                o ponto no mapa.
              </p>
            </>
          )}

          {modoLocal === "endereco" ? (
            <div className="space-y-2">
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro e ponto de referência"
                className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Btn variant="secondary" icon="search" onClick={buscarEndereco}>
                  {geoBuscando ? "Buscando…" : "Localizar no mapa"}
                </Btn>
                {enderecoAviso && (
                  <span className="text-[11px] text-error font-bold">{enderecoAviso}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MetaTag className="block mb-1.5">LATITUDE</MetaTag>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-16.440000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px]"
                />
              </div>
              <div>
                <MetaTag className="block mb-1.5">LONGITUDE</MetaTag>
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-39.070000"
                  className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px]"
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <PublicMapPicker
              lat={lat}
              lng={lng}
              height={260}
              entidadeId={entidadeSelecionada?.id}
              zonasDestaqueIds={eventoAtivo?.zonas}
              onChange={(la, ln) => {
                setLat(la);
                setLng(ln);
                setModoLocal("coordenada");
                setGeoStatus("ok");
                setAjusteManualDoMapa(false);
              }}
            />
            <p className="text-[11px] text-on-surface-variant mt-2">
              Arraste o marcador até o local exato do ocorrido.
            </p>
            {localEntidade && (
              <p className="text-[11px] text-secondary font-bold mt-1">
                Localização em {localEntidade}
              </p>
            )}
          </div>
        </section>

        {/* anexos */}
        {config.permitirAnexos && (
          <section className="card-tonal p-6 shadow-ambient-sm">
            <h2 className="mb-1 text-sm font-bold text-primary">Fotos e vídeos (opcional)</h2>
            <p className="mb-3 text-sm text-on-surface-variant">
              Imagens ajudam a equipe a dimensionar a situação antes de chegar ao local.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg bg-surface-container-low border-2 border-dashed border-outline-variant/40 cursor-pointer hover:bg-surface-container transition-all">
              <Icon name="add_a_photo" className="text-secondary text-[24px]" />
              <span className="text-[12px] font-bold text-primary">Clique para anexar</span>
              <span className="text-[10px] text-on-surface-variant">JPG, PNG ou MP4</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const arquivos = Array.from(e.target.files ?? []).map((f) => ({
                    arquivo: f,
                    nome: f.name,
                    tamanho:
                      f.size > 1024 * 1024
                        ? `${(f.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
                        : `${Math.max(1, Math.round(f.size / 1024))} KB`,
                  }));
                  setAnexos((prev) => [...prev, ...arquivos]);
                }}
              />
            </label>

            {anexos.length > 0 && (
              <div className="space-y-2 mt-3">
                {anexos.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]"
                  >
                    <Icon name="image" className="text-secondary text-[18px]" />
                    <span className="font-bold text-primary flex-1 truncate">{a.nome}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">{a.tamanho}</span>
                    <button
                      type="button"
                      onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-md hover:bg-surface-container"
                      aria-label="Remover anexo"
                    >
                      <Icon name="close" className="text-on-surface-variant text-[16px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* contato */}
        <section className="card-tonal p-6 shadow-ambient-sm">
          <h2 className="mb-1 text-sm font-bold text-primary">
            5. Contato {config.exigirContato ? "(obrigatório)" : "(opcional)"}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">
            {config.exigirContato
              ? "Informe um telefone para que a equipe possa confirmar os detalhes do registro."
              : "O CPF é obrigatório para identificar o registro. O telefone é opcional e permite que a equipe entre em contato."}
          </p>
          <label htmlFor="report-cpf" className="mb-1.5 block text-sm font-semibold text-primary">
            CPF (obrigatório)
          </label>
          <input
            id="report-cpf"
            value={cpf}
            onChange={(e) => setCpf(mascararCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50 mb-4"
          />

          <label htmlFor="report-telefone" className="mb-1.5 block text-sm font-semibold text-primary">
            Telefone {config.exigirContato ? "(obrigatório)" : "(opcional)"}
          </label>
          <input
            id="report-telefone"
            value={contato}
            onChange={(e) => setContato(mascararTelefone(e.target.value))}
            placeholder="(73) 90000-0000"
            type="tel"
            inputMode="tel"
            maxLength={14}
            className="w-full bg-surface-container-low rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-secondary outline-none placeholder:text-[14px] placeholder:text-on-surface-variant/50"
          />
        </section>

        {erro && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2 p-4 rounded-lg bg-error-container text-on-error-container"
          >
            <Icon name="error" filled className="text-[18px]" />
            <span className="text-[13px] font-bold">{erro}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pb-12">
          <Btn variant="primary" icon="send" full onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar registro"}
          </Btn>
        </div>

        <p className="text-[13px] text-on-surface-variant text-center -mt-8 pb-8">
          Emergência com risco à vida: ligue {config.telefonesEmergencia}.
        </p>
        </>}
      </div>
    </main>
  );
}

export default function PublicReportPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="card-tonal w-full max-w-lg p-10 text-center shadow-ambient">
            <Icon name="progress_activity" className="mb-3 animate-spin text-[30px] text-secondary" />
            <p className="text-sm font-semibold text-on-surface-variant">Carregando formulário…</p>
          </div>
        </main>
      }
    >
      <PublicReportContent />
    </Suspense>
  );
}
