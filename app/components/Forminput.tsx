"use client";

import { MetaTag } from "@/app/components/Primitives";

interface FormInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
}

export function FormInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  disabled,
}: FormInputProps) {
  return (
    <div>
      <MetaTag className="block mb-2">{label}</MetaTag>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/60 disabled:opacity-60"
      />
      {error && <p className="text-[11px] text-red-600 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}