import type { Agent, Jurisdiction, Lead, Locale } from "./types";

/**
 * Local persistence for the sandbox.
 *
 * What is stored is the operator's *configuration* — the markets they created,
 * the roster and its accumulated load, and their view settings. What is
 * deliberately not stored is anything mid-flight: a restored countdown would
 * come back with an expired deadline and escalate the instant the page loaded,
 * which is worse than starting from a clean slate.
 *
 * Every access is guarded. A private window, blocked site data, or a quota
 * error must degrade to seed state rather than take the page down.
 */

const KEY = "lead-engine.v1";

export interface HeldLead {
  lead: Lead;
  escalations: number;
}

export interface PersistedState {
  version: 1;
  jurisdictions: Jurisdiction[];
  agents: Agent[];
  jurisdictionCode: string;
  locale: Locale;
  speed: number;
  municipalityOverride: string | null;
  held: HeldLead[];
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    // Unreadable or corrupt storage is not an error worth surfacing; the
    // caller simply falls back to seed data.
    return null;
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled. Losing persistence is acceptable;
    // breaking the page is not.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do.
  }
}

/**
 * Shape check rather than trust. Stored data may predate a code change, so
 * anything that does not match the current version is discarded instead of
 * being migrated — this is a sandbox, and a clean reset is the right outcome.
 */
function isValid(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PersistedState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.jurisdictions) &&
    candidate.jurisdictions.length > 0 &&
    Array.isArray(candidate.agents) &&
    Array.isArray(candidate.held) &&
    typeof candidate.jurisdictionCode === "string" &&
    (candidate.locale === "fr" || candidate.locale === "en") &&
    typeof candidate.speed === "number"
  );
}
