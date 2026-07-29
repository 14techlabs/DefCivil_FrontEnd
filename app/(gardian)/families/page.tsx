"use client";

import { useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, SectionHeader } from "@/app/components/Primitives";
import { useGardian } from "@/app/components/GardianContext";
import {
  MOCK_FAMILIAS,
  MOCK_EVENTOS,
  MOCK_OCORRENCIAS,
  MOCK_ZONAS,
  googleMapsUrl,
  zonaNome,
  type MockFamilia,
} from "@/app/data/mock";

export default function FamiliesPage() {
  const { showToast } = useGardian();

  const [familias, setFamilias] = useState<MockFamilia[]>(MOCK_FAMILIAS);
  const [filtroZona, setFiltroZona] = useState<number | "todas">("todas");
  const [selectedId, setSelectedId] = useState<number>(MOCK_FAMILIAS[0]?.id ?? 0);

  // form de vínculo
  const [novoMembro, setNovoMembro] = useState({ nome: "", idade: "", parentesco: "" });
  const [novoAnimal, setNovoAnimal] = useState({ nome: "", especie: "" });

  const filtradas = useMemo(
    () => (filtroZona === "todas" ? familias : familias.filter((f) => f.zona === filtroZona)),
    [familias, filtroZona],
  );

  const familia = useMemo(
    () => familias.find((f) => f.id === selectedId) ?? filtradas[0] ?? familias[0],
    [familias, filtradas, selectedId],
  );

  const totalPessoas = familias.reduce((a, f) => a + f.membros.length, 0);
  const totalAnimais = familias.reduce((a, f) => a + f.animais.length, 0);
  const emRisco = familias.filter((f) => f.areaDeRisco).length;

  const vincularMembro = () => {
    const idade = parseInt(novoMembro.idade, 10);
    if (!novoMembro.nome.trim() || isNaN(idade) || !novoMembro.parentesco.trim()) {
      showToast("Preencha nome, idade e parentesco.", "error");
      return;
    }
    setFamilias((prev) =>
      prev.map((f) =>
        f.id === familia.id
          ? { ...f, membros: [...f.membros, { nome: novoMembro.nome.trim(), idade, parentesco: novoMembro.parentesco.trim() }] }
          : f,
      ),
    );
    setNovoMembro({ nome: "", idade: "", parentesco: "" });
    showToast("Membro vinculado à família.");
  };

  const vincularAnimal = () => {
    if (!novoAnimal.nome.trim() || !novoAnimal.especie.trim()) {
      showToast("Preencha nome e espécie do animal.", "error");
      return;
    }
    setFamilias((prev) =>
      prev.map((f) =>
        f.id === familia.id
          ? { ...f, animais: [...f.animais, { nome: novoAnimal.nome.trim(), especie: novoAnimal.especie.trim() }] }
          : f,
      ),
    );
    setNovoAnimal({ nome: "", especie: "" });
    showToast("Animal vinculado à família.");
  };

  if (!familia) return null;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">POPULAÇÃO CADASTRADA</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{familias.length} FAMÍLIAS</MetaTag>
        </div>
        <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
          Gerenciamento das Famílias
        </h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI label="Famílias" value={familias.length} icon="family_restroom" tone="secondary" sub={`${totalPessoas} pessoas cadastradas`} />
        <KPI label="Em Área de Risco" value={emRisco} icon="warning" tone={emRisco > 0 ? "error" : "secondary"} sub="Prioridade em eventos" />
        <KPI label="Atingidas por Eventos" value={familias.filter((f) => f.eventosAtingida.length > 0).length} icon="cyclone" tone="warning" sub="No evento ativo" />
        <KPI label="Animais" value={totalAnimais} icon="pets" tone="secondary" sub="Vinculados às famílias" />
      </div>

      {/* filtro por zona */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltroZona("todas")}
          className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
            filtroZona === "todas" ? "bg-primary text-white shadow-ambient-sm" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          Todas as zonas
        </button>
        {MOCK_ZONAS.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => setFiltroZona(z.id)}
            className={`px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
              filtroZona === z.id ? "bg-primary text-white shadow-ambient-sm" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {z.nome} ({familias.filter((f) => f.zona === z.id).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Lista de famílias */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          {filtradas.length === 0 && (
            <p className="text-[12px] text-on-surface-variant italic">Nenhuma família nesta zona.</p>
          )}
          {filtradas.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`w-full card-tonal p-5 shadow-ambient-sm text-left relative overflow-hidden transition-all hover:shadow-ambient ${
                familia.id === f.id ? "ring-2 ring-secondary" : ""
              }`}
            >
              <span className={`absolute top-0 left-0 bottom-0 w-1 ${f.areaDeRisco ? "bg-error" : "bg-secondary"}`} />
              <div className="pl-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[14px] font-bold text-primary">{f.responsavel}</p>
                  {f.areaDeRisco && <Chip tone="error">ÁREA DE RISCO</Chip>}
                </div>
                <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                  <Icon name="location_on" className="text-[14px]" /> {f.endereco}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] font-mono font-bold uppercase tracking-mono text-slate-400">
                  <span>{zonaNome(f.zona)}</span>
                  <span>·</span>
                  <span>{f.membros.length} MEMBROS</span>
                  <span>·</span>
                  <span>{f.ocorrencias.length} OCORRÊNCIAS</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detalhe da família */}
        <aside className="col-span-12 lg:col-span-7">
          <div className="card-tonal shadow-ambient-sm overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary-container text-white p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Chip tone="primarySoft" className="!bg-white/15 !text-white">FAMÍLIA #{familia.id}</Chip>
                  <h2 className="font-headline font-black text-2xl tracking-tighter mt-3">{familia.responsavel}</h2>
                  <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
                    <Icon name="location_on" className="text-[14px]" /> {familia.endereco} · {zonaNome(familia.zona)}
                  </p>
                  <p className="text-white/70 text-xs mt-1 flex items-center gap-1.5">
                    <Icon name="call" className="text-[14px]" /> {familia.telefone}
                  </p>
                </div>
                <a
                  href={googleMapsUrl(familia.coordenadas)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-mono-tight hover:bg-white/20 transition-all shrink-0"
                >
                  <Icon name="map" className="text-[16px]" /> Localização
                </a>
              </div>
            </div>

            <div className="p-7 space-y-6">
              {/* Eventos que atingiram */}
              {familia.eventosAtingida.length > 0 && (
                <div className="card-recessed p-4 border-l-4 border-error">
                  <MetaTag className="block mb-2 text-error">ATINGIDA POR EVENTOS</MetaTag>
                  {familia.eventosAtingida.map((eid) => {
                    const ev = MOCK_EVENTOS.find((e) => e.id === eid);
                    return (
                      <p key={eid} className="text-[12px] font-bold text-primary flex items-center gap-2">
                        <Icon name="cyclone" className="text-error text-[16px]" /> {ev?.nome ?? `Evento #${eid}`}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Ocorrências da família */}
              <div>
                <MetaTag className="block mb-3">OCORRÊNCIAS DA FAMÍLIA ({familia.ocorrencias.length})</MetaTag>
                {familia.ocorrencias.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant italic">Nenhuma ocorrência registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {familia.ocorrencias.map((oid) => {
                      const oc = MOCK_OCORRENCIAS.find((o) => o.id === oid);
                      return (
                        <div key={oid} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                          <Icon name="emergency" className="text-error text-[16px]" />
                          <span className="font-bold text-primary">#{oid}</span>
                          <span className="text-on-surface truncate">{oc?.titulo ?? "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Membros + vínculo */}
              <div>
                <MetaTag className="block mb-3">MEMBROS ({familia.membros.length})</MetaTag>
                <div className="space-y-2 mb-3">
                  {familia.membros.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                      <div className="w-8 h-8 rounded-md bg-primary-container/20 flex items-center justify-center">
                        <Icon name="person" className="text-primary text-[16px]" />
                      </div>
                      <span className="font-bold text-primary flex-1">{m.nome}</span>
                      <span className="text-on-surface-variant">{m.idade} anos</span>
                      <Chip tone="neutral">{m.parentesco}</Chip>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_auto] gap-2">
                  <input
                    value={novoMembro.nome}
                    onChange={(e) => setNovoMembro((v) => ({ ...v, nome: e.target.value }))}
                    placeholder="Nome"
                    className="bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <input
                    value={novoMembro.idade}
                    onChange={(e) => setNovoMembro((v) => ({ ...v, idade: e.target.value }))}
                    placeholder="Idade"
                    className="bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <input
                    value={novoMembro.parentesco}
                    onChange={(e) => setNovoMembro((v) => ({ ...v, parentesco: e.target.value }))}
                    placeholder="Parentesco"
                    className="bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <Btn variant="secondary" icon="person_add" onClick={vincularMembro}>
                    Vincular
                  </Btn>
                </div>
              </div>

              {/* Animais + vínculo */}
              <div>
                <MetaTag className="block mb-3">ANIMAIS ({familia.animais.length})</MetaTag>
                <div className="space-y-2 mb-3">
                  {familia.animais.length === 0 && (
                    <p className="text-[12px] text-on-surface-variant italic">Nenhum animal vinculado.</p>
                  )}
                  {familia.animais.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low text-[12px]">
                      <div className="w-8 h-8 rounded-md bg-secondary/10 flex items-center justify-center">
                        <Icon name="pets" className="text-secondary text-[16px]" />
                      </div>
                      <span className="font-bold text-primary flex-1">{a.nome}</span>
                      <Chip tone="secondary">{a.especie}</Chip>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={novoAnimal.nome}
                    onChange={(e) => setNovoAnimal((v) => ({ ...v, nome: e.target.value }))}
                    placeholder="Nome do animal"
                    className="bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <input
                    value={novoAnimal.especie}
                    onChange={(e) => setNovoAnimal((v) => ({ ...v, especie: e.target.value }))}
                    placeholder="Espécie"
                    className="bg-surface-container-low rounded-lg px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-secondary outline-none"
                  />
                  <Btn variant="secondary" icon="add" onClick={vincularAnimal}>
                    Vincular
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
