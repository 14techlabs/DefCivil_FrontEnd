"use client";

import { Fragment, type ReactNode } from "react";

export type ChipTone =
  | "neutral"
  | "secondary"
  | "warning"
  | "error"
  | "primary"
  | "primarySoft"
  | "info";

export type BarTone = "secondary" | "warning" | "error" | "primary";

type BtnVariant = "primary" | "secondary" | "danger" | "success" | "ghost" | "ghostDark";

export function Icon({
  name,
  className = "",
  filled = false,
  weight,
  style,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: number;
  style?: React.CSSProperties;
}) {
  const iconStyle: React.CSSProperties = { ...style };
  if (filled || weight) {
    const w = weight ?? (filled ? 500 : 400);
    iconStyle.fontVariationSettings = `'FILL' ${filled ? 1 : 0}, 'wght' ${w}, 'GRAD' 0, 'opsz' 24`;
  }
  return (
    <span className={`material-symbols-outlined ${className}`} style={iconStyle}>
      {name}
    </span>
  );
}

export function StatusDot({
  tone = "secondary",
  live = true,
  className = "",
}: {
  tone?: ChipTone | "neutral";
  live?: boolean;
  className?: string;
}) {
  const colors: Record<string, string> = {
    secondary: "bg-secondary",
    warning: "bg-orange-500",
    error: "bg-error",
    neutral: "bg-slate-400",
  };
  const color = colors[tone] ?? colors.secondary;
  return (
    <span className={`relative inline-flex w-2 h-2 ${className}`}>
      {live && (
        <span className={`absolute inset-0 rounded-full ${color} opacity-50 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full w-2 h-2 ${color}`} />
    </span>
  );
}

export function Chip({
  tone = "neutral",
  children,
  className = "",
  icon,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
  icon?: string;
}) {
  const tones: Record<ChipTone, string> = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    secondary: "bg-secondary/10 text-secondary",
    warning: "bg-orange-100 text-orange-700",
    error: "bg-error-container text-on-error-container",
    primary: "bg-primary text-white",
    primarySoft: "bg-primary/8 text-primary",
    info: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-mono-tight ${tones[tone]} ${className}`}
    >
      {icon && <Icon name={icon} className="text-[12px]" />}
      {children}
    </span>
  );
}

export function MetaTag({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] font-mono tracking-mono uppercase font-bold text-slate-400 ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  overline,
  title,
  action,
  className = "",
}: {
  overline?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-6 ${className}`}>
      <div>
        {overline && (
          <MetaTag className="block mb-2 text-secondary">{overline}</MetaTag>
        )}
        <h3 className="font-headline font-black text-2xl tracking-tighter text-primary">
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}

export function Btn({
  variant = "primary",
  icon,
  iconRight,
  children,
  className = "",
  onClick,
  disabled,
  full,
  type = "button",
}: {
  variant?: BtnVariant;
  icon?: string;
  iconRight?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-mono-tight px-5 py-3 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const variants: Record<BtnVariant, string> = {
    primary:
      "bg-gradient-to-br from-primary to-primary-container text-white hover:shadow-ambient hover:-translate-y-px active:translate-y-0",
    secondary:
      "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
    danger:
      "bg-gradient-to-br from-error to-[#93000a] text-white hover:shadow-ambient hover:-translate-y-px",
    success:
      "bg-gradient-to-br from-secondary to-[#005048] text-white hover:shadow-ambient hover:-translate-y-px",
    ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container-high",
    ghostDark: "bg-white/5 text-white/80 hover:bg-white/10 backdrop-blur-md",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {icon && <Icon name={icon} className="text-[16px]" />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} className="text-[16px]" />}
    </button>
  );
}

export function Tab({
  active,
  children,
  onClick,
  icon,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-mono-tight transition-all ${
        active
          ? "bg-primary text-white shadow-ambient-sm"
          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
      }`}
    >
      {icon && <Icon name={icon} className="text-[16px]" />}
      {children}
    </button>
  );
}

export function KPI({
  label,
  value,
  unit,
  tone = "primary",
  icon,
  sub,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "primary" | "error" | "warning" | "secondary";
  icon?: string;
  sub?: string;
}) {
  const tones: Record<string, { dot: string; value: string }> = {
    primary: { dot: "bg-secondary", value: "text-primary" },
    error: { dot: "bg-error", value: "text-primary" },
    warning: { dot: "bg-orange-500", value: "text-primary" },
    secondary: { dot: "bg-secondary", value: "text-primary" },
  };
  const t = tones[tone] ?? tones.primary;
  return (
    <div className="card-tonal p-6 shadow-ambient-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
          <MetaTag>{label}</MetaTag>
        </div>
        {icon && (
          <Icon
            name={icon}
            className={`text-[20px] ${tone === "error" ? "text-error" : tone === "warning" ? "text-orange-500" : "text-secondary"}`}
          />
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-headline font-black text-5xl tracking-tighter ${t.value}`}>
            {value}
          </span>
          {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
        </div>
        {sub && (
          <p className="text-[11px] text-on-surface-variant mt-1 font-medium">{sub}</p>
        )}
      </div>
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  tone = "secondary",
  className = "",
}: {
  value: number;
  max?: number;
  tone?: BarTone;
  className?: string;
}) {
  const tones: Record<BarTone, string> = {
    secondary: "bg-secondary",
    warning: "bg-orange-500",
    error: "bg-error",
    primary: "bg-primary",
  };
  return (
    <div
      className={`w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full ${tones[tone]} transition-all duration-500`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; active?: boolean }[] }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="w-1 h-1 rounded-full bg-outline-variant" />}
          <MetaTag className={item.active ? "text-secondary" : ""}>{item.label}</MetaTag>
        </Fragment>
      ))}
    </div>
  );
}

export function Empty({
  icon = "inbox",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center mb-4">
        <Icon name={icon} className="text-2xl text-on-surface-variant" />
      </div>
      <p className="font-headline font-bold text-primary text-base">{title}</p>
      {subtitle && (
        <p className="text-xs text-on-surface-variant mt-1 max-w-xs">{subtitle}</p>
      )}
    </div>
  );
}
