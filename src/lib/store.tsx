"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SEED_JURISDICTIONS, WORKFLOW_PRESETS } from "./jurisdictions";
import { SEED_AGENTS, makeLead } from "./seed";
import { routeLead } from "./routing";
import { translate } from "./i18n";
import {
  clearState,
  loadState,
  saveState,
  type HeldLead,
  type HoldReason,
} from "./persistence";
import {
  FORCED_BY_SCENARIO,
  singleBrokerMunicipality,
  type ForcedResponse,
  type ScenarioKey,
} from "./scenarios";
import type {
  Agent,
  Jurisdiction,
  Lead,
  Locale,
  RoutingPlan,
  TraceEntry,
} from "./types";

export type { HeldLead, HoldReason };

/**
 * Single source of truth for the sandbox.
 *
 * Timing note: escalation is driven by ONE interval and a set of absolute
 * deadlines held in state. Nothing schedules its own setTimeout, so an
 * escalation can never race a stale timer from the previous assignment —
 * the failure mode that makes live demos embarrassing.
 */

interface Awaiting {
  lead: Lead;
  plan: RoutingPlan;
  level: number;
  agentId: string;
  assignedAt: number;
  deadline: number;
  /** Absolute time this broker will accept, or null if they will not. */
  autoAcceptAt: number | null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "awaiting"; state: Awaiting }
  | { kind: "accepted"; lead: Lead; agentId: string; level: number }
  | { kind: "held"; lead: Lead };

interface StoreValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;

  jurisdictions: Jurisdiction[];
  jurisdiction: Jurisdiction;
  setJurisdictionCode: (code: string) => void;
  addJurisdiction: (input: NewJurisdictionInput) => void;

  agents: Agent[];
  phase: Phase;
  trace: TraceEntry[];
  held: HeldLead[];
  now: number;

  slaMs: number;
  speed: number;
  setSpeed: (s: number) => void;

  municipality: string;
  setMunicipality: (m: string) => void;

  trigger: (municipality?: string) => void;
  accept: () => void;
  decline: () => void;
  reset: () => void;
  reassignHeld: (leadId: string) => void;

  /** Which panel is on screen. Lifted here so a scenario can navigate. */
  view: View;
  setView: (v: View) => void;
  jurisdictionFormOpen: boolean;
  setJurisdictionFormOpen: (open: boolean) => void;
  runScenario: (key: ScenarioKey) => void;
}

export type View = "simulator" | "jurisdictions" | "attribution";

export interface NewJurisdictionInput {
  code: string;
  name: string;
  country: "CA" | "US";
  currencyCode: string;
  commissionRate: number;
  marketCommissionRate: number;
  slaSeconds: number;
  defaultLocale: Locale;
  preset: string;
  municipalities: string[];
}

const StoreContext = createContext<StoreValue | null>(null);

const NEW_MARKET_BROKERS = ["Alex Rivera", "Jordan Mills", "Sam Okonkwo"];

/**
 * Default to the municipality with the deepest bench. A town served by a single
 * broker can never demonstrate escalation, so picking at random would routinely
 * hide the most important behaviour in the system.
 */
function busiestMunicipality(
  jurisdiction: Jurisdiction,
  agents: Agent[],
): string {
  const licensed = agents.filter((a) =>
    a.jurisdictions.includes(jurisdiction.code),
  );
  let best = jurisdiction.municipalities[0] ?? "";
  let bestCount = -1;
  for (const town of jurisdiction.municipalities) {
    const count = licensed.filter(
      (a) => a.coverage.length === 0 || a.coverage.includes(town),
    ).length;
    if (count > bestCount) {
      best = town;
      bestCount = count;
    }
  }
  return best;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(SEED_JURISDICTIONS);
  const [jurisdictionCode, setJurisdictionCodeRaw] = useState("QC");
  // Quebec is the default market, so French is what renders on first paint.
  const [locale, setLocale] = useState<Locale>("fr");
  const [agents, setAgents] = useState<Agent[]>(SEED_AGENTS);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [held, setHeld] = useState<HeldLead[]>([]);
  const [speed, setSpeed] = useState(4);
  const [municipalityOverride, setMunicipalityOverride] = useState<string | null>(null);
  /* Gates the save effect. Without it the first render would immediately
     overwrite stored state with seed state, before the load has run. */
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("simulator");
  const [jurisdictionFormOpen, setJurisdictionFormOpen] = useState(false);

  /* Scenario-forced responses, indexed by escalation level. Held in a ref
     rather than state because a scenario sets it and immediately triggers a
     lead — a state update would not be visible to that same call. */
  const forcedRef = useRef<ForcedResponse[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const jurisdiction = useMemo(
    () => jurisdictions.find((j) => j.code === jurisdictionCode) ?? jurisdictions[0],
    [jurisdictions, jurisdictionCode],
  );

  const slaMs = Math.round((jurisdiction.slaSeconds * 1000) / speed);

  const municipality =
    municipalityOverride && jurisdiction.municipalities.includes(municipalityOverride)
      ? municipalityOverride
      : busiestMunicipality(jurisdiction, agents);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) =>
      translate(locale, path, vars),
    [locale],
  );

  /**
   * Phase transitions are committed through here rather than through a
   * functional setState updater. State updaters must be pure — React invokes
   * them twice in development — so pushing trace entries from inside one
   * logged every escalation and acceptance twice. Keeping the ref in sync on
   * commit also removes any window where the interval could act on a stale
   * phase between a transition and the next render.
   */
  const phaseRef = useRef<Phase>({ kind: "idle" });
  const commitPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Switching market switches the language it is legally served in. */
  const setJurisdictionCode = useCallback(
    (code: string) => {
      setJurisdictionCodeRaw(code);
      const next = jurisdictions.find((j) => j.code === code);
      if (next) setLocale(next.defaultLocale);
      setMunicipalityOverride(null);
      commitPhase({ kind: "idle" });
      setTrace([]);
    },
    [commitPhase, jurisdictions],
  );

  const pushTrace = useCallback((entries: TraceEntry[]) => {
    const batched = entries.map((entry, index) => ({ ...entry, batchIndex: index }));
    setTrace((prev) => [...prev, ...batched]);
  }, []);

  const assignTo = useCallback(
    (lead: Lead, plan: RoutingPlan, level: number, windowMs: number) => {
      const agent = plan.escalationOrder[level];
      const at = Date.now();
      const forced = forcedRef.current?.[level];
      const willAccept =
        forced === undefined ? Math.random() < agent.responsiveness : forced === "accept";
      commitPhase({
        kind: "awaiting",
        state: {
          lead,
          plan,
          level,
          agentId: agent.id,
          assignedAt: at,
          deadline: at + windowMs,
          autoAcceptAt: willAccept
            ? at + windowMs * (0.35 + Math.random() * 0.45)
            : null,
        },
      });
    },
    [commitPhase],
  );

  const trigger = useCallback(
    (override?: string, keepScript = false) => {
      if (!keepScript) forcedRef.current = null;
      const town = override ?? municipality;
      const lead = makeLead(jurisdiction.code, town, locale);
      const plan = routeLead(lead, jurisdiction, agents);

      setTrace(plan.steps.map((entry, index) => ({ ...entry, batchIndex: index })));

      if (plan.escalationOrder.length === 0) {
        // Nobody was ever eligible — a different problem from nobody replying.
        commitPhase({ kind: "held", lead });
        setHeld((prev) => [
          { lead, escalations: 0, reason: "unrouted" as HoldReason },
          ...prev,
        ]);
        return;
      }
      assignTo(lead, plan, 0, slaMs);
    },
    [agents, assignTo, commitPhase, jurisdiction, locale, municipality, slaMs],
  );

  const accept = useCallback(() => {
    const current = phaseRef.current;
    if (current.kind !== "awaiting") return;
    const { lead, agentId, assignedAt, level } = current.state;
    const agent = agents.find((a) => a.id === agentId);
    const elapsed = ((Date.now() - assignedAt) / 1000).toFixed(1);

    pushTrace([
      {
        id: `acc-${lead.id}-${level}`,
        at: Date.now(),
        kind: "accept",
        message: {
          fr: `Accepté par ${agent?.name ?? ""}`,
          en: `Accepted by ${agent?.name ?? ""}`,
        },
        annotation: { fr: `${elapsed} s`, en: `${elapsed}s` },
        agentId,
      },
    ]);
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? { ...a, activeFiles: a.activeFiles + 1, lastAssignedAt: Date.now() }
          : a,
      ),
    );
    commitPhase({ kind: "accepted", lead, agentId, level });
  }, [agents, commitPhase, pushTrace]);

  /** Shared by an explicit decline and by an SLA breach. */
  const advance = useCallback(
    (reason: "decline" | "timeout") => {
      const current = phaseRef.current;
      if (current.kind !== "awaiting") return;

      const { lead, plan, level, agentId } = current.state;
      const agent = agents.find((a) => a.id === agentId);
      const nextLevel = level + 1;
      const nextAgent = plan.escalationOrder[nextLevel];
      const exhausted = !nextAgent || nextLevel > jurisdiction.escalationLevels;

      pushTrace([
        {
          id: `esc-${lead.id}-${level}-${reason}`,
          at: Date.now(),
          kind: "escalate",
          message:
            reason === "decline"
              ? {
                  fr: `Refusé par ${agent?.name ?? ""} → réacheminement`,
                  en: `Declined by ${agent?.name ?? ""} → rerouting`,
                }
              : {
                  fr: `Sans réponse de ${agent?.name ?? ""} → escalade niveau ${nextLevel}`,
                  en: `No response from ${agent?.name ?? ""} → escalation level ${nextLevel}`,
                },
          annotation:
            reason === "timeout" ? { fr: "SLA", en: "SLA" } : undefined,
          agentId,
        },
        ...(exhausted
          ? [
              {
                id: `hold-${lead.id}`,
                at: Date.now(),
                kind: "hold" as const,
                message: {
                  fr: "Escalades épuisées → file d'attente, alerte à l'administrateur",
                  en: "Escalations exhausted → hold queue, admin alerted",
                },
              },
            ]
          : [
              {
                id: `re-${lead.id}-${nextLevel}`,
                at: Date.now(),
                kind: "assign" as const,
                message: {
                  fr: `Réattribué → ${nextAgent.name}`,
                  en: `Reassigned → ${nextAgent.name}`,
                },
                annotation: {
                  fr: `Niveau ${nextLevel}`,
                  en: `Level ${nextLevel}`,
                },
                agentId: nextAgent.id,
              },
            ]),
      ]);

      if (exhausted) {
        setHeld((prev) => [
          { lead, escalations: level + 1, reason: "exhausted" as HoldReason },
          ...prev,
        ]);
        commitPhase({ kind: "held", lead });
        return;
      }

      const at = Date.now();
      const forced = forcedRef.current?.[nextLevel];
      const willAccept =
        forced === undefined
          ? Math.random() < nextAgent.responsiveness
          : forced === "accept";
      commitPhase({
        kind: "awaiting",
        state: {
          lead,
          plan,
          level: nextLevel,
          agentId: nextAgent.id,
          assignedAt: at,
          deadline: at + slaMs,
          autoAcceptAt: willAccept
            ? at + slaMs * (0.3 + Math.random() * 0.4)
            : null,
        },
      });
    },
    [agents, commitPhase, jurisdiction.escalationLevels, pushTrace, slaMs],
  );

  const decline = useCallback(() => advance("decline"), [advance]);

  const reset = useCallback(() => {
    commitPhase({ kind: "idle" });
    setTrace([]);
    setHeld([]);
    setAgents(SEED_AGENTS);
    setMunicipalityOverride(null);
    setJurisdictions(SEED_JURISDICTIONS);
    setJurisdictionCodeRaw("QC");
    setLocale("fr");
    // Otherwise the next reload would restore what was just reset.
    clearState();
  }, [commitPhase]);

  /**
   * Manual override from the hold queue. Re-runs routing against the current
   * roster: a broker who has since freed up capacity, or a market that has
   * since gained brokers, makes the lead routable again. If nobody is eligible
   * the lead stays put — silently dropping it would be worse than holding it.
   */
  const reassignHeld = useCallback(
    (leadId: string) => {
      const entry = held.find((h) => h.lead.id === leadId);
      if (!entry) return;

      const target =
        jurisdictions.find((j) => j.code === entry.lead.jurisdictionCode) ??
        jurisdiction;
      const plan = routeLead(entry.lead, target, agents);

      setTrace(
        plan.steps.map((step, index) => ({ ...step, batchIndex: index })),
      );

      if (plan.escalationOrder.length === 0) {
        pushTrace([
          {
            id: `re-fail-${entry.lead.id}-${Date.now()}`,
            at: Date.now(),
            kind: "hold",
            message: {
              fr: "Toujours aucun courtier admissible — le lead reste en file",
              en: "Still no eligible broker — the lead stays in the queue",
            },
          },
        ]);
        return;
      }

      setHeld((prev) => prev.filter((h) => h.lead.id !== leadId));
      forcedRef.current = null;
      assignTo(entry.lead, plan, 0, slaMs);
    },
    [agents, assignTo, held, jurisdiction, jurisdictions, pushTrace, slaMs],
  );

  /**
   * Scenario setup. Each one arranges the board and stops; the visitor still
   * presses the trigger, because a demo you only watch is a slower video.
   */
  const runScenario = useCallback(
    (key: ScenarioKey) => {
      if (key === "new-market") {
        setView("jurisdictions");
        setJurisdictionFormOpen(true);
        return;
      }

      setView("simulator");
      // Compressed SLA, or the visitor waits a full minute for the payoff.
      setSpeed(10);

      if (key === "no-response") {
        forcedRef.current = FORCED_BY_SCENARIO["no-response"] ?? null;
        setMunicipalityOverride(null); // busiest town — deepest bench
        trigger(undefined, true);
        return;
      }

      // at-capacity: fill the only broker covering some town, then send a lead
      // there so the capacity cap is what stops it.
      const solo = singleBrokerMunicipality(jurisdiction, agents);
      if (!solo) return;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === solo.agent.id ? { ...a, activeFiles: a.capacity } : a,
        ),
      );
      setMunicipalityOverride(solo.town);
      forcedRef.current = null;
      // Routing must see the filled roster, so hand it the updated list.
      const filled = agents.map((a) =>
        a.id === solo.agent.id ? { ...a, activeFiles: a.capacity } : a,
      );
      const lead = makeLead(jurisdiction.code, solo.town, locale);
      const plan = routeLead(lead, jurisdiction, filled);
      setTrace(plan.steps.map((step, index) => ({ ...step, batchIndex: index })));
      commitPhase({ kind: "held", lead });
      setHeld((prev) => [
        { lead, escalations: 0, reason: "unrouted" as HoldReason },
        ...prev,
      ]);
    },
    [agents, commitPhase, jurisdiction, locale, trigger],
  );

  const addJurisdiction = useCallback((input: NewJurisdictionInput) => {
    const preset = WORKFLOW_PRESETS[input.preset] ?? WORKFLOW_PRESETS["ca-standard"];
    const created: Jurisdiction = {
      code: input.code.toUpperCase(),
      name: { fr: input.name, en: input.name },
      country: input.country,
      currencyCode: input.currencyCode,
      defaultLocale: input.defaultLocale,
      requiredLocales: [input.defaultLocale],
      commissionRate: input.commissionRate,
      marketCommissionRate: input.marketCommissionRate,
      slaSeconds: input.slaSeconds,
      escalationLevels: 2,
      terminology: {
        agent: { fr: "courtier immobilier", en: "real estate agent" },
        agentPlural: { fr: "courtiers", en: "agents" },
        listingAgreement: { fr: "contrat d'inscription", en: "listing agreement" },
        purchaseAgreement: { fr: "convention d'achat", en: "purchase agreement" },
        closingOfficer: { fr: "notaire", en: "closing agent" },
        regulator: { fr: "à configurer", en: "to configure" },
      },
      legalDisclosure: {
        fr: `Mention légale à configurer pour ${input.name}.`,
        en: `Legal disclosure to be configured for ${input.name}.`,
      },
      workflow: preset.stages.map((label, index) => ({
        key: `${input.code.toLowerCase()}-${index}`,
        label: { fr: label, en: label },
        requiredDocuments: [],
      })),
      municipalities: input.municipalities,
      createdAtRuntime: true,
    };

    // A new market needs a roster, otherwise every lead would hold-queue.
    const roster: Agent[] = NEW_MARKET_BROKERS.map((name, index) => ({
      id: `ag-${created.code.toLowerCase()}-${index}`,
      name,
      initials: name
        .split(" ")
        .map((part) => part[0])
        .join(""),
      jurisdictions: [created.code],
      coverage: [],
      languages: [input.defaultLocale],
      activeFiles: index * 2,
      capacity: 10,
      lastAssignedAt: 0,
      responsiveness: index === 0 ? 0.25 : 0.85,
    }));

    setJurisdictions((prev) => [...prev, created]);
    setAgents((prev) => [...prev, ...roster]);
    setJurisdictionCodeRaw(created.code);
    setLocale(created.defaultLocale);
    setMunicipalityOverride(null);
    commitPhase({ kind: "idle" });
    setTrace([]);
  }, [commitPhase]);

  /* --- Persistence ------------------------------------------------------
     The page is statically prerendered, so stored state cannot be read in a
     useState initializer without causing a hydration mismatch. It is read once
     here, after mount, and applied.

     set-state-in-effect exists to catch effects that cascade. This one has no
     dependencies and reads a non-reactive external store, so it runs exactly
     once per mount and cannot loop. The rule is disabled for this effect only,
     and re-enabled immediately after. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = loadState();
    if (stored) {
      setJurisdictions(stored.jurisdictions);
      setAgents(stored.agents);
      const exists = stored.jurisdictions.some(
        (j) => j.code === stored.jurisdictionCode,
      );
      setJurisdictionCodeRaw(
        exists ? stored.jurisdictionCode : stored.jurisdictions[0].code,
      );
      setLocale(stored.locale);
      setSpeed(stored.speed);
      setMunicipalityOverride(stored.municipalityOverride);
      setHeld(stored.held);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      version: 2,
      jurisdictions,
      agents,
      jurisdictionCode,
      locale,
      speed,
      municipalityOverride,
      held,
    });
  }, [
    hydrated,
    jurisdictions,
    agents,
    jurisdictionCode,
    locale,
    speed,
    municipalityOverride,
    held,
  ]);

  /* --- Document language -------------------------------------------------
     layout.tsx renders lang="fr-CA" because French is the default market, but
     the locale is client state. Assistive technology and Lighthouse both read
     this attribute, so it has to follow the active language rather than stay
     pinned to the server-rendered default. */
  useEffect(() => {
    document.documentElement.lang =
      locale === "fr" ? "fr-CA" : jurisdiction.country === "US" ? "en-US" : "en-CA";
  }, [locale, jurisdiction.country]);

  /* --- The single clock ------------------------------------------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      const current = phaseRef.current;
      if (current.kind !== "awaiting") return;
      const { autoAcceptAt, deadline } = current.state;
      if (autoAcceptAt !== null && tick >= autoAcceptAt) {
        accept();
      } else if (tick >= deadline) {
        advance("timeout");
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [accept, advance]);

  const value: StoreValue = {
    locale,
    setLocale,
    t,
    jurisdictions,
    jurisdiction,
    setJurisdictionCode,
    addJurisdiction,
    agents,
    phase,
    trace,
    held,
    now,
    slaMs,
    speed,
    setSpeed,
    municipality,
    setMunicipality: setMunicipalityOverride,
    trigger,
    accept,
    decline,
    reset,
    reassignHeld,
    view,
    setView,
    jurisdictionFormOpen,
    setJurisdictionFormOpen,
    runScenario,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
