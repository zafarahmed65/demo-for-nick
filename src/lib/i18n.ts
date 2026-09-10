import fr from "@/locales/fr.json";
import en from "@/locales/en.json";
import type { Locale } from "./types";

/**
 * Every user-visible string lives in locales/*.json. Nothing is hard-coded in a
 * component, which is what makes adding Spanish a file rather than a refactor.
 */
const DICTIONARIES: Record<Locale, unknown> = { fr, en };

export const LOCALES: Locale[] = ["fr", "en"];

/** Resolve a dot path, with interpolation for {tokens}. */
export function translate(
  locale: Locale,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const raw = lookup(DICTIONARIES[locale], path) ?? lookup(DICTIONARIES.fr, path);
  if (typeof raw !== "string") return path;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

function lookup(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      source,
    );
}
