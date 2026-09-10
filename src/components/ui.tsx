"use client";

import type { ReactNode } from "react";

/* Shared primitives. Every surface in the app is built from these, which is
   what keeps spacing, borders and type consistent without a component library. */

export function Panel({
  title,
  meta,
  action,
  children,
  className = "",
  bodyClassName = "",
  dataTour,
}: {
  title?: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Anchor name for the walkthrough to point at. */
  dataTour?: string;
}) {
  return (
    <section
      data-tour={dataTour}
      className={`bg-white border border-[var(--hairline)] rounded-lg shadow-[var(--lift)] ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            {/* Sentence case, normal size. Uppercase micro-labels on every
                panel is what made this read as an old admin tool. */}
            <h2 className="text-small font-medium text-ink-900 whitespace-nowrap">
              {title}
            </h2>
            {meta && <span className="text-small text-ink-400 truncate">{meta}</span>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  type = "button",
  disabled,
  className = "",
  dataTour,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  /** Anchor name for the walkthrough to point at. */
  dataTour?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-sm transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-small",
    md: "h-9 px-3.5 text-small",
  };
  const variants = {
    primary:
      "bg-pine-600 text-white hover:bg-pine-700 shadow-[var(--lift)]",
    secondary:
      "bg-white text-ink-700 border border-[var(--hairline-strong)] hover:bg-ink-50 hover:text-ink-900",
    ghost: "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
    danger:
      "bg-white text-danger-700 border border-danger-200 hover:bg-danger-50",
  };
  return (
    <button
      type={type}
      data-tour={dataTour}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div className="text-small text-ink-500 mb-1.5">{label}</div>
      )}
      <div
        role="radiogroup"
        className="inline-flex w-full p-1 bg-ink-100 rounded-md gap-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              title={option.hint}
              className={`flex-1 h-7 px-2.5 text-small font-medium rounded-sm transition-all duration-150 ${
                active
                  ? "bg-white text-ink-900 shadow-[var(--lift)]"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
}) {
  const tones = {
    neutral: "bg-ink-150 text-ink-600",
    ok: "bg-ok-50 text-ok-700",
    warn: "bg-warn-50 text-warn-700",
    danger: "bg-danger-50 text-danger-700",
    accent: "bg-pine-50 text-pine-700",
  };
  return (
    <span
      className={`inline-flex items-center h-[22px] px-2 rounded-sm text-micro font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-small text-ink-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-micro text-ink-400 mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full h-9 px-3 text-small bg-white border border-[var(--hairline-strong)] rounded-sm text-ink-900 placeholder:text-ink-400 focus:border-pine-500 focus:outline-none transition-colors duration-150";

export function Avatar({
  initials,
  tone = "neutral",
}: {
  initials: string;
  tone?: "neutral" | "accent" | "warn";
}) {
  const tones = {
    neutral: "bg-ink-200 text-ink-700",
    accent: "bg-pine-600 text-white",
    warn: "bg-warn-200 text-warn-700",
  };
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 size-7 rounded-full text-micro font-semibold ${tones[tone]}`}
    >
      {initials}
    </span>
  );
}

/** Thin capacity meter. Turns amber as a broker approaches their cap. */
export function Meter({ value, max }: { value: number; max: number }) {
  const ratio = max === 0 ? 1 : Math.min(value / max, 1);
  const tone =
    ratio >= 1 ? "bg-danger-500" : ratio >= 0.75 ? "bg-warn-500" : "bg-pine-500";
  return (
    <div className="h-1.5 w-full bg-ink-150 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${tone}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
