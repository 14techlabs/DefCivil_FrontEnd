"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Chip, Icon, KPI, MetaTag, Tab } from "@/app/components/Primitives";
import { EditUserModal, type AdminUsuario } from "@/app/components/EditUserModal";
import { CreateTecnicoModal } from "@/app/components/CreateTecnicoModal";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

const TIPO_LABEL: Record<number, string> = {
  1: "Cidadão",
  2: "Técnico",
};

const CARGO_LABEL: Record<number, string> = {
  1: "Coordenador",
  2: "Supervisor",
  3: "Técnico",
  4: "Agente de campo",
  5: "Voluntário",
};

const CARGO_TABS: { id: number | "sem"; label: string; icon: string }[] = [
  { id: 1, label: "Coordenador", icon: "military_tech" },
  { id: 2, label: "Supervisor", icon: "supervisor_account" },
  { id: 3, label: "Técnico", icon: "engineering" },
  { id: 4, label: "Agente de campo", icon: "hiking" },
  { id: 5, label: "Voluntário", icon: "volunteer_activism" },
  { id: "sem", label: "Sem cargo", icon: "help_outline" },
];

function displayName(u: AdminUsuario): string {
  return (
    u.user_sys?.first_name?.trim() ||
    u.user_sys?.username ||
    u.nome_anonimo ||
    u.telefone ||
    `Usuário #${u.id}`
  );
}

function initials(u: AdminUsuario): string {
  const name = displayName(u);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminPage() {
  const { showToast } = useGardian();

  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<1 | 2>(2);
  const [filtroCargo, setFiltroCargo] = useState<number | "sem">(1);
  const [editing, setEditing] = useState<AdminUsuario | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AdminUsuario[]>("/usuarios/");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch {
      showToast("Não foi possível carregar os usuários.", "error");
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleTipoChange = (tipo: 1 | 2) => {
    setFiltroTipo(tipo);
    if (tipo === 2) setFiltroCargo(1);
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (u.tipo !== filtroTipo) return false;
      if (filtroTipo === 2) {
        if (filtroCargo === "sem") {
          if (u.cargo != null) return false;
        } else if (u.cargo !== filtroCargo) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [
        displayName(u),
        u.telefone,
        u.user_sys?.email,
        u.user_sys?.username,
        u.nome_anonimo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [usuarios, busca, filtroTipo, filtroCargo]);

  const contagemPorCargo = useMemo(() => {
    const base = usuarios.filter((u) => u.tipo === 2);
    const counts: Record<string, number> = { sem: 0 };
    for (const id of [1, 2, 3, 4, 5]) counts[String(id)] = 0;
    for (const u of base) {
      if (u.cargo == null) counts.sem += 1;
      else counts[String(u.cargo)] = (counts[String(u.cargo)] ?? 0) + 1;
    }
    return counts;
  }, [usuarios]);

  const totalTecnicos = usuarios.filter((u) => u.tipo === 2).length;
  const totalCidadaos = usuarios.filter((u) => u.tipo === 1).length;

  const handleSaved = (updated: AdminUsuario) => {
    setUsuarios((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleCreated = (created: AdminUsuario) => {
    setUsuarios((prev) => [created, ...prev]);
    if (created.tipo === 2) {
      setFiltroTipo(2);
      setFiltroCargo(created.cargo ?? "sem");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <MetaTag className="text-secondary">ADMINISTRAÇÃO</MetaTag>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <MetaTag>{usuarios.length} USUÁRIOS</MetaTag>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary">
            Usuários
          </h1>
          <div className="flex flex-wrap gap-2">
            {filtroTipo === 2 && (
              <Btn icon="person_add" onClick={() => setShowCreate(true)}>
                Novo técnico
              </Btn>
            )}
            <Btn icon="refresh" variant="secondary" onClick={fetchUsuarios} disabled={loading}>
              Atualizar
            </Btn>
          </div>
        </div>
        <p className="text-sm text-on-surface-variant mt-3 max-w-2xl">
          Liste e edite os dados cadastrais dos usuários vinculados à sua entidade.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        <KPI
          label="Total"
          value={usuarios.length}
          icon="group"
          tone="secondary"
          sub="Na entidade atual"
        />
        <KPI
          label="Técnicos"
          value={totalTecnicos}
          icon="engineering"
          tone="secondary"
          sub="Com acesso ao sistema"
        />
        <KPI
          label="Cidadãos"
          value={totalCidadaos}
          icon="person"
          tone="secondary"
          sub="Cadastros públicos"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <MetaTag className="block mb-1.5">BUSCAR</MetaTag>
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, e-mail, telefone…"
              className="w-full bg-surface-container-low rounded-lg pl-10 pr-4 py-2.5 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary outline-none"
            />
          </div>
        </div>
        <div>
          <MetaTag className="block mb-1.5">TIPO</MetaTag>
          <div className="flex gap-2">
            {(
              [
                { id: 2 as const, label: "Técnicos" },
                { id: 1 as const, label: "Cidadãos" },
              ]
            ).map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                onClick={() => handleTipoChange(opt.id)}
                className={`px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-mono-tight transition-all ${
                  filtroTipo === opt.id
                    ? "bg-primary text-white"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtroTipo === 2 && (
        <div className="flex flex-wrap gap-2">
          {CARGO_TABS.map((tab) => {
            const count = contagemPorCargo[String(tab.id)] ?? 0;
            return (
              <Tab
                key={String(tab.id)}
                active={filtroCargo === tab.id}
                onClick={() => setFiltroCargo(tab.id)}
                icon={tab.icon}
              >
                {tab.label}
                <span
                  className={`ml-1 tabular-nums ${
                    filtroCargo === tab.id ? "text-white/80" : "text-slate-400"
                  }`}
                >
                  ({count})
                </span>
              </Tab>
            );
          })}
        </div>
      )}

      <section className="card-tonal shadow-ambient-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-on-surface-variant font-medium">
            Carregando usuários…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <Icon name="person_off" className="text-on-surface-variant text-[26px]" />
            </div>
            <p className="text-sm font-bold text-primary">Nenhum usuário encontrado</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {filtroTipo === 2
                ? "Não há técnicos neste cargo com os filtros atuais."
                : "Ajuste a busca ou o filtro de tipo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400">
                    Usuário
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400">
                    Tipo
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400">
                    Cargo
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400">
                    Contato
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400">
                    E-mail
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-mono text-slate-400 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-outline-variant/10 hover:bg-white/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-black text-primary">
                            {initials(u)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-primary truncate">
                            {displayName(u)}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono font-bold uppercase tracking-mono-tight">
                            ID {u.id}
                            {u.user_sys?.username ? ` · @${u.user_sys.username}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Chip tone={u.tipo === 2 ? "secondary" : "neutral"}>
                        {TIPO_LABEL[u.tipo] ?? `Tipo ${u.tipo}`}
                      </Chip>
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-on-surface">
                      {u.cargo != null ? CARGO_LABEL[u.cargo] ?? `Cargo ${u.cargo}` : "—"}
                    </td>
                    <td className="px-4 py-4 text-[12px] font-medium text-on-surface-variant">
                      {u.telefone || "—"}
                    </td>
                    <td className="px-4 py-4 text-[12px] font-medium text-on-surface-variant truncate max-w-[220px]">
                      {u.user_sys?.email || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Btn
                        variant="secondary"
                        icon="edit"
                        className="!py-2 !px-3"
                        onClick={() => setEditing(u)}
                      >
                        Editar
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditUserModal
        open={editing != null}
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <CreateTecnicoModal
        open={showCreate}
        defaultCargo={typeof filtroCargo === "number" ? filtroCargo : null}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
