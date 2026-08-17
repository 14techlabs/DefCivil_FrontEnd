import { MOCK_FORM_CONFIG, type ConfigFormulario } from "@/app/data/mock";

export const PUBLIC_FORM_CONFIG_STORAGE_KEY = "gardian:public-form-config:v1";

export function loadPublicFormConfig(): ConfigFormulario {
  if (typeof window === "undefined") return MOCK_FORM_CONFIG;
  try {
    const saved = window.localStorage.getItem(PUBLIC_FORM_CONFIG_STORAGE_KEY);
    if (!saved) return MOCK_FORM_CONFIG;
    const parsed = JSON.parse(saved) as Partial<ConfigFormulario>;
    if (!Array.isArray(parsed.categorias) || !Array.isArray(parsed.checklist)) {
      return MOCK_FORM_CONFIG;
    }
    return { ...MOCK_FORM_CONFIG, ...parsed };
  } catch {
    return MOCK_FORM_CONFIG;
  }
}

export function savePublicFormConfig(config: ConfigFormulario): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PUBLIC_FORM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("gardian:public-form-config-changed", { detail: config }));
}
