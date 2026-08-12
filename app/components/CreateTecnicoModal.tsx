"use client";

import { useEffect, useState } from "react";
import { Btn, Icon, MetaTag } from "@/app/components/Primitives";
import { ModalShell } from "@/app/components/Modals";
import { useGardian } from "@/app/components/GardianContext";
import { api } from "@/app/services/Api";
import type { AdminUsuario } from "@/app/components/EditUserModal";

interface Props {
  open: boolean;
  defaultCargo?: number | null;
  onClose: () => void;
  onCreated: (created: AdminUsuario) => void;
}

type FormState = {
  telefone: string;
  cargo: number | "";
  username: string;
  first_name: string;
  email: string;
  password: string;
};

const EMPTY_FORM: FormState = {
  telefone: "",
  cargo: "",
  username: "",
  first_name: "",
  email: "",
  password: "",
};

const inputClass =
  "w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary outline-none";

function formatApiError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null) {
    return Object.values(detail as Record<string, unknown>)
      .flat()
      .map(String)
      .join(" ");
  }
  return "Não foi possível criar o técnico.";
}

export function CreateTecnicoModal({ open, defaultCargo, onClose, onCreated }: Props) {
  const { showToast, user } = useGardian();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      cargo: defaultCargo != null ? defaultCargo : "",
    });
    setError("");
    setSaving(false);
  }, [open, defaultCargo]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!user?.entidade) {
      setError("Sua sessão não possui entidade vinculada. Não é possível criar técnicos.");
      return;
    }

    if (!form.telefone.trim()) {
      setError("Telefone é obrigatório.");
      return;
    }
    if (!form.username.trim() || !form.email.trim()) {
      setError("Usuário e e-mail são obrigatórios.");
      return;
    }
    if (!form.password.trim()) {
      setError("Senha é obrigatória para novos técnicos.");
      return;
    }
    if (form.password.trim().length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      tipo: 2,
      telefone: form.telefone.trim(),
      nome_anonimo: null,
      entidade: user.entidade,
      cargo: form.cargo !== "" ? Number(form.cargo) : null,
      user_sys: {
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
      },
    };

    try {
      const res = await api.post<AdminUsuario>("/usuarios/", body);
      onCreated(res.data);
      showToast("Técnico criado com sucesso.");
      onClose();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null;
      setError(formatApiError(detail));
      showToast("Erro ao criar técnico.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="bg-gradient-to-br from-primary to-primary-container px-6 sm:px-8 py-5 sm:py-6 text-white relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 opacity-10">
          <Icon name="person_add" filled className="text-[160px]" />
        </div>
        <div className="relative">
          <MetaTag className="text-white/70">ADMINISTRAÇÃO · NOVOS TÉCNICOS</MetaTag>
          <h2 className="font-headline font-black text-3xl tracking-tighter mt-2">
            Criar técnico
          </h2>
          <p className="text-white/80 text-sm mt-2">
            Cadastre um usuário da equipe com acesso ao sistema e vínculo à sua entidade.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-5 flex-1 min-h-0 overflow-y-auto">
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

        <div>
          <MetaTag className="block mb-2">TELEFONE</MetaTag>
          <input
            className={inputClass}
            value={form.telefone}
            onChange={(e) => setField("telefone", e.target.value)}
            placeholder="(00) 00000-0000"
          />
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
          <MetaTag className="block mb-2">SENHA</MetaTag>
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>

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
        <Btn icon="person_add" onClick={handleCreate} disabled={saving}>
          {saving ? "Criando…" : "Criar técnico"}
        </Btn>
      </div>
    </ModalShell>
  );
}
