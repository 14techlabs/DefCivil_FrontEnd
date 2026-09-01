// DefCivil_FrontEnd/app/components/AddressLocationField.tsx
"use client";

import { useCallback, useState } from "react";
import { Btn, Chip, Icon, MetaTag } from "@/app/components/Primitives";
import { CoordsPickerMap } from "@/app/components/CoordsPickerMap";
import { api } from "@/app/services/Api";

/**
 * Endereço + mapa + zona, em um bloco só.
 *
 * Usado no cadastro e na edição de família. Ficou como componente próprio
 * porque as duas telas precisam do mesmo comportamento: digitar o endereço,
 * escolher entre os resultados, e ver a zona resultante antes de salvar.
 *
 * A zona vem SEMPRE do backend (`/familias/zona-do-ponto/`), nunca calculada
 * aqui. É a mesma regra usada no `save()` do model, então o que a tela mostra
 * é o que será gravado.
 */

type Candidato = {
  endereco: string;
  lat: number;
  lng: number;
  zona: number | null;
  zona_nome: string | null;
};

interface Props {
  endereco: string;
  onEnderecoChange: (v: string) => void;
  lat: string;
  lng: string;
  onCoordChange: (lat: string, lng: string) => void;
  /** Zona detectada para a coordenada atual (o pai guarda para exibir). */
  zonaNome: string | null;
  onZonaChange: (nome: string | null) => void;
  height?: number;
}

const CAMPO =
  "w-full min-w-0 bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none";

export function AddressLocationField({
  endereco,
  onEnderecoChange,
  lat,
  lng,
  onCoordChange,
  zonaNome,
  onZonaChange,
  height = 240,
}: Props) {
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const coordOk =
    lat.trim() !== "" && lng.trim() !== "" && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));

  /** Consulta a zona da coordenada atual — sempre no backend. */
  const detectarZona = useCallback(
    async (novaLat: string, novaLng: string) => {
      try {
        const res = await api.get<{ zona_nome: string | null }>(
          `/familias/zona-do-ponto/?lat=${novaLat}&lng=${novaLng}`,
        );
        onZonaChange(res.data.zona_nome);
      } catch {
        onZonaChange(null);
      }
    },
    [onZonaChange],
  );

  /**
   * Busca por botão/Enter, não a cada tecla: o Nominatim limita a 1
   * requisição por segundo e digitação contínua estouraria o limite.
   */
  const buscarEndereco = async () => {
    if (endereco.trim().length < 4) {
      setAviso("Digite um endereço mais completo para buscar.");
      return;
    }
    setBuscando(true);
    setAviso(null);
    try {
      const res = await api.get<{ candidatos: Candidato[]; aviso?: string }>(
        `/familias/geocodificar/?endereco=${encodeURIComponent(endereco.trim())}`,
      );
      const lista = res.data.candidatos ?? [];
      setCandidatos(lista);
      if (lista.length === 0) {
        setAviso(res.data.aviso ?? "Nenhum endereço encontrado. Marque o ponto no mapa.");
      } else {
        // Um único resultado não exige escolha — aplica direto.
        if (lista.length === 1) aplicar(lista[0]);
      }
    } catch {
      setAviso("Não foi possível buscar o endereço. Marque o ponto no mapa.");
    } finally {
      setBuscando(false);
    }
  };

  const aplicar = (c: Candidato) => {
    onCoordChange(String(c.lat), String(c.lng));
    onZonaChange(c.zona_nome);
    setCandidatos(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <MetaTag className="block mb-1.5">ENDEREÇO</MetaTag>
        <div className="flex gap-2">
          <input
            value={endereco}
            onChange={(e) => onEnderecoChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscarEndereco();
              }
            }}
            placeholder="Rua, número, bairro"
            className={CAMPO}
          />
          <Btn
            variant="secondary"
            icon="search"
            onClick={buscarEndereco}
            disabled={buscando}
            className="shrink-0"
          >
            {buscando ? "Buscando…" : "Localizar"}
          </Btn>
        </div>
      </div>

      {candidatos && candidatos.length > 1 && (
        <div className="card-recessed p-3 space-y-1.5">
          <MetaTag className="block">
            {candidatos.length} RESULTADOS — ESCOLHA O CORRETO
          </MetaTag>
          {candidatos.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => aplicar(c)}
              className="w-full flex items-start gap-2 p-2.5 rounded-md bg-surface-container-low hover:bg-secondary/8 text-left"
            >
              <Icon name="place" className="text-secondary text-[16px] mt-0.5" />
              <span className="flex-1 text-[11px] text-on-surface leading-snug">
                {c.endereco}
              </span>
              <Chip tone={c.zona_nome ? "secondary" : "neutral"}>
                {c.zona_nome ?? "FORA DE ZONA"}
              </Chip>
            </button>
          ))}
        </div>
      )}

      {aviso && (
        <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
          <Icon name="info" className="text-[14px]" /> {aviso}
        </p>
      )}

      <div>
        <MetaTag className="block mb-1.5">LOCALIZAÇÃO NO MAPA *</MetaTag>
        <p className="text-[11px] text-on-surface-variant mb-2">
          Ajuste o marcador se a busca não acertar o ponto exato. A zona é
          determinada por qual polígono contém este ponto.
        </p>
        <CoordsPickerMap
          lat={lat}
          lng={lng}
          onChange={(novaLat, novaLng) => {
            onCoordChange(novaLat, novaLng);
            void detectarZona(novaLat, novaLng);
          }}
          height={height}
        />
        <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
          {coordOk ? (
            <p className="text-[11px] font-mono text-on-surface-variant">
              {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
            </p>
          ) : (
            <p className="text-[11px] text-on-surface-variant italic">
              Nenhum ponto marcado.
            </p>
          )}
          {coordOk && (
            <Chip tone={zonaNome ? "secondary" : "warning"}>
              {zonaNome ? `ZONA: ${zonaNome}` : "FORA DAS ZONAS CADASTRADAS"}
            </Chip>
          )}
        </div>
      </div>
    </div>
  );
}