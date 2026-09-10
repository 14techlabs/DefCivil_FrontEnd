"use client";

import { useEffect, useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";

export interface AdminUsuario {
  id: number;
  user_sys: {
    id: number;
    username: string;
    first_name: string;
    email: string;
  } | null;
  telefone: string;
  nome_anonimo: string | null;
  tipo: number;
  entidade: number | null;
  cargo: number | null;
}

interface Props {
  open: boolean;
  user: AdminUsuario | null;
  onClose: () => void;
  onSaved: (updated: AdminUsuario) => void;
}

type FormState = {
  telefone: string;
  nome_anonimo: string;
  tipo: number;
  cargo: number | "";
  username: string;
  first_name: string;
  email: string;
  password: string;
};

const inputClass =
  "w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary outline-none";

export function EditUserModal({ open, user, onClose, onSaved }: Props) {
  const { showToast } = useGardian();
  const [form, setForm] = useState<FormState>({
    telefone: "",
    nome_anonimo: "",
    tipo: 1,
    cargo: "",
    username: "",
    first_name: "",
    email: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setForm({
      telefone: user.telefone ?? "",
      nome_anonimo: user.nome_anonimo ?? "",
      tipo: user.tipo,
      cargo: user.cargo ?? "",
      username: user.user_sys?.username ?? "",
      first_name: user.user_sys?.first_name ?? "",
      email: user.user_sys?.email ?? "",
      password: "",
    });
    setError("");
    setSaving(false);
  }, [open, user]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user) return;

    if (!form.telefone.trim()) {
      setError("Telefone é obrigatório.");
      return;
    }

    if (form.tipo === 2) {
      if (!form.username.trim() || !form.email.trim()) {
        setError("Técnico precisa de usuário e e-mail do sistema.");
        return;
      }
    }

    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      telefone: form.telefone.trim(),
      nome_anonimo: form.tipo === 1 ? form.nome_anonimo.trim() || null : null,
      tipo: form.tipo,
      cargo: form.tipo === 2 && form.cargo !== "" ? Number(form.cargo) : null,
      entidade: user.entidade,
    };

    if (form.tipo === 2 || user.user_sys) {
      const userSys: Record<string, string> = {
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        email: form.email.trim(),
      };
      if (form.password.trim()) {
        userSys.password = form.password.trim();
      }
      body.user_sys = userSys;
    }

    try {
      const res = await api.patch<AdminUsuario>(`/usuarios/${user.id}/`, body);
      onSaved(res.data);
      showToast("Usuário atualizado com sucesso.");
      onClose();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      const msg =
        typeof detail === "object" && detail !== null
          ? Object.values(detail as Record<string, unknown>)
              .flat()
              .map(String)
              .join(" ")
          : "Não foi possível salvar as alterações.";
      setError(msg || "Não foi possível salvar as alterações.");
      showToast("Erro ao salvar usuário.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="bg-gradient-to-br from-primary to-primary-container px-6 sm:px-8 py-5 sm:py-6 text-white relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 opacity-10">
          <Icon name="manage_accounts" filled className="text-[160px]" />
        </div>
        <div className="relative">
          <MetaTag className="text-white/70">ADMINISTRAÇÃO · USUÁRIOS</MetaTag>
          <h2 className="font-headline font-black text-3xl tracking-tighter mt-2">
            Editar usuário
          </h2>
          <p className="text-white/80 text-sm mt-2">
            Altere os dados cadastrais e o vínculo operacional deste usuário.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-5 flex-1 min-h-0 overflow-y-auto">
        <div>
          <MetaTag className="block mb-2">TIPO</MetaTag>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 1, label: "Cidadão", icon: "person" },
              { id: 2, label: "Técnico", icon: "engineering" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setField("tipo", opt.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-mono-tight transition-all ${
                  form.tipo === opt.id
                    ? "bg-gradient-to-br from-primary to-primary-container text-white shadow-ambient-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <Icon name={opt.icon} className="text-[16px]" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <MetaTag className="block mb-2">TELEFONE</MetaTag>
          <input
            className={inputClass}
            value={form.telefone}
            onChange={(e) => setField("telefone", e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        {form.tipo === 1 && (
          <div>
            <MetaTag className="block mb-2">NOME ANÔNIMO</MetaTag>
            <input
              className={inputClass}
              value={form.nome_anonimo}
              onChange={(e) => setField("nome_anonimo", e.target.value)}
              placeholder="Como o cidadão aparece no sistema"
            />
          </div>
        )}

        {form.tipo === 2 && (
          <>
            <div>
              <MetaTag className="block mb-2">CARGO</MetaTag>
              <select
                className={inputClass}
                value={form.cargo === "" ? "" : String(form.cargo)}
                onChange={(e) =>
                  setField("cargo", e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">Sem cargo</option>
                <option value="1">Coordenador</option>
                <option value="2">Supervisor</option>
                <option value="3">Técnico</option>
                <option value="4">Agente de campo</option>
                <option value="5">Voluntário</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <MetaTag className="block mb-2">USUÁRIO</MetaTag>
                <input
                  className={inputClass}
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                  placeholder="username"
                  autoComplete="off"
                />
              </div>
              <div>
                <MetaTag className="block mb-2">NOME</MetaTag>
                <input
                  className={inputClass}
                  value={form.first_name}
                  onChange={(e) => setField("first_name", e.target.value)}
                  placeholder="Nome de exibição"
                />
              </div>
            </div>

            <div>
              <MetaTag className="block mb-2">E-MAIL</MetaTag>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="email@exemplo.com"
                autoComplete="off"
              />
            </div>

            <div>
              <MetaTag className="block mb-2">NOVA SENHA (OPCIONAL)</MetaTag>
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder="Deixe em branco para manter"
                autoComplete="new-password"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-sm font-semibold text-error bg-error-container/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
      </div>

      <div className="px-6 sm:px-8 py-4 sm:py-5 border-t border-outline-variant/20 flex items-center justify-end gap-3 shrink-0 bg-white">
        <Btn variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Btn>
        <Btn icon="save" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Btn>
      </div>
    </ModalShell>
  );
}
