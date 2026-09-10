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
import type { ClosedLead } from "./attribution";
import { GUIDE_STEPS, type GuideFacts } from "./guide";
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
  | {
      kind: "accepted";
      lead: Lead;
      agentId: string;
      level: number;
      /** Position in this jurisdiction's configured workflow. */
      stageIndex: number;
      decisionMs: number;
      acceptedAfterMs: number;
      acceptedAt: number;
    }
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

  /** Every lead created this session, for attribution. */
  routedLeads: Lead[];
  /** Leads that reached a terminal workflow stage. */
  closings: ClosedLead[];
  advanceStage: () => void;
  closeLead: () => void;

  /* --- Guided walkthrough --- */
  guideOpen: boolean;
  guideStep: number;
  guideFacts: GuideFacts;
  /** Steps the visitor has genuinely completed, in order. */
  guideDone: boolean[];
  openGuide: () => void;
  dismissGuide: () => void;
  goToStep: (index: number) => void;
  showStep: () => void;
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
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [localeSwitched, setLocaleSwitched] = useState(false);
  const [hasReassigned, setHasReassigned] = useState(false);
  const [hasEscalated, setHasEscalated] = useState(false);
  const [locale, setLocaleRaw] = useState<Locale>("fr");
  const setLocale = useCallback((next: Locale) => {
    setLocaleRaw(next);
    setLocaleSwitched(true);
  }, []);
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
  const [routedLeads, setRoutedLeads] = useState<Lead[]>([]);
  const [closings, setClosings] = useState<ClosedLead[]>([]);
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
      if (next) setLocaleRaw(next.defaultLocale);
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
    (override?: string, keepScript = false, windowMsOverride?: number) => {
      if (!keepScript) forcedRef.current = null;
      const town = override ?? municipality;
      const lead = makeLead(jurisdiction.code, town, locale);
      const plan = routeLead(lead, jurisdiction, agents);

      // Recorded the moment it exists — a lead counts toward cost-per-lead
      // whether or not it ever closes.
      setRoutedLeads((prev) => [...prev, lead]);
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
      assignTo(lead, plan, 0, windowMsOverride ?? slaMs);
    },
    [agents, assignTo, commitPhase, jurisdiction, locale, municipality, slaMs],
  );

  const accept = useCallback(() => {
    const current = phaseRef.current;
    if (current.kind !== "awaiting") return;
    const { lead, agentId, assignedAt, level, plan } = current.state;
    const agent = agents.find((a) => a.id === agentId);
    const acceptedAfterMs = Date.now() - assignedAt;
    const elapsed = (acceptedAfterMs / 1000).toFixed(1);

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
    commitPhase({
      kind: "accepted",
      lead,
      agentId,
      level,
      stageIndex: 1, // qualification — the lead is past "new" once accepted
      decisionMs: plan.decisionMs,
      acceptedAfterMs,
      acceptedAt: Date.now(),
    });
  }, [agents, commitPhase, pushTrace]);

  /* --- Lead lifecycle ---------------------------------------------------
     Stages come from the active jurisdiction's configured workflow, so a lead
     in Ontario walks Ontario's stages. Reaching the terminal stage is what
     turns a lead into a closing, which is what moves cost-per-closing. */

  const recordClosing = useCallback(
    (phase: Extract<Phase, { kind: "accepted" }>) => {
      setClosings((prev) =>
        prev.some((c) => c.lead.id === phase.lead.id)
          ? prev
          : [
              ...prev,
              {
                lead: phase.lead,
                agentId: phase.agentId,
                level: phase.level,
                decisionMs: phase.decisionMs,
                acceptedAfterMs: phase.acceptedAfterMs,
                acceptedAt: phase.acceptedAt,
                closedAt: Date.now(),
              },
            ],
      );
    },
    [],
  );

  const advanceStage = useCallback(() => {
    const current = phaseRef.current;
    if (current.kind !== "accepted") return;
    const stages = jurisdiction.workflow;
    const next = Math.min(current.stageIndex + 1, stages.length - 1);
    if (next === current.stageIndex) return;

    pushTrace([
      {
        id: `stage-${current.lead.id}-${next}`,
        at: Date.now(),
        kind: next === stages.length - 1 ? "accept" : "resolve",
        message: {
          fr: `Étape → ${stages[next].label.fr}`,
          en: `Stage → ${stages[next].label.en}`,
        },
        annotation: { fr: `${next + 1}/${stages.length}`, en: `${next + 1}/${stages.length}` },
      },
    ]);

    const advanced = { ...current, stageIndex: next };
    if (next === stages.length - 1) recordClosing(advanced);
    commitPhase(advanced);
  }, [commitPhase, jurisdiction.workflow, pushTrace, recordClosing]);

  /** Jump straight to the terminal stage. Seven clicks is not a demo. */
  const closeLead = useCallback(() => {
    const current = phaseRef.current;
    if (current.kind !== "accepted") return;
    const stages = jurisdiction.workflow;
    const last = stages.length - 1;
    if (current.stageIndex === last) return;

    pushTrace([
      {
        id: `stage-${current.lead.id}-${last}`,
        at: Date.now(),
        kind: "accept",
        message: {
          fr: `Étape → ${stages[last].label.fr}`,
          en: `Stage → ${stages[last].label.en}`,
        },
        annotation: {
          fr: `campagne ${current.lead.campaignId}`,
          en: `campaign ${current.lead.campaignId}`,
        },
      },
    ]);

    const closed = { ...current, stageIndex: last };
    recordClosing(closed);
    commitPhase(closed);
  }, [commitPhase, jurisdiction.workflow, pushTrace, recordClosing]);

  /** Shared by an explicit decline and by an SLA breach. */
  const advance = useCallback(
    (reason: "decline" | "timeout") => {
      const current = phaseRef.current;
      if (current.kind !== "awaiting") return;

      const { lead, plan, level, agentId, deadline, assignedAt } = current.state;
      // Preserve whatever window this lead was assigned under, so a scenario's
      // compressed countdown stays compressed through every escalation.
      const windowMs = deadline - assignedAt;
      const agent = agents.find((a) => a.id === agentId);
      const nextLevel = level + 1;
      const nextAgent = plan.escalationOrder[nextLevel];
      const exhausted = !nextAgent || nextLevel > jurisdiction.escalationLevels;

      setHasEscalated(true);
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
          deadline: at + windowMs,
          autoAcceptAt: willAccept
            ? at + windowMs * (0.3 + Math.random() * 0.4)
            : null,
        },
      });
    },
    [agents, commitPhase, jurisdiction.escalationLevels, pushTrace],
  );

  const decline = useCallback(() => advance("decline"), [advance]);

  const reset = useCallback(() => {
    commitPhase({ kind: "idle" });
    setTrace([]);
    setHeld([]);
    setAgents(SEED_AGENTS);
    setRoutedLeads([]);
    setClosings([]);
    setLocaleSwitched(false);
    setHasReassigned(false);
    setHasEscalated(false);
    setGuideStep(0);
    setGuideDismissed(false);
    setMunicipalityOverride(null);
    setJurisdictions(SEED_JURISDICTIONS);
    setJurisdictionCodeRaw("QC");
    setLocaleRaw("fr");
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
        /* "Full manual override" means exactly this: an administrator can push
           a lead past the capacity cap. Licence and geography are legal and
           practical constraints and stay non-negotiable; a full desk is a
           judgement call, so it is the one rule a human may overrule. */
        const overridable = plan.candidates
          .filter(
            (c) =>
              c.reasonCode === "capacity" &&
              c.agent.languages.includes(entry.lead.locale),
          )
          .map((c) => c.agent)
          .sort((a, b) => a.activeFiles / a.capacity - b.activeFiles / b.capacity);

        if (overridable.length === 0) {
          pushTrace([
            {
              id: `re-fail-${entry.lead.id}-${Date.now()}`,
              at: Date.now(),
              kind: "hold",
              message: {
                fr: "Aucune dérogation possible — licence ou territoire manquant",
                en: "No override available — licence or territory missing",
              },
            },
          ]);
          return;
        }

        const target = overridable[0];
        pushTrace([
          {
            id: `re-override-${entry.lead.id}-${Date.now()}`,
            at: Date.now(),
            kind: "assign",
            message: {
              fr: `Dérogation manuelle → ${target.name} (plafond ${target.capacity} outrepassé)`,
              en: `Manual override → ${target.name} (cap of ${target.capacity} bypassed)`,
            },
            annotation: { fr: "admin", en: "admin" },
            agentId: target.id,
          },
        ]);
        setHeld((prev) => prev.filter((h) => h.lead.id !== leadId));
        setHasReassigned(true);
        forcedRef.current = null;
        assignTo(
          entry.lead,
          { ...plan, escalationOrder: [target] },
          0,
          slaMs,
        );
        return;
      }

      setHeld((prev) => prev.filter((h) => h.lead.id !== leadId));
      setHasReassigned(true);
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
      const scenarioSpeed = 10;
      setSpeed(scenarioSpeed);
      // setSpeed will not have been applied by the time trigger runs, so the
      // window is passed explicitly rather than read from a stale slaMs.
      const scenarioWindowMs = Math.round(
        (jurisdiction.slaSeconds * 1000) / scenarioSpeed,
      );

      if (key === "no-response") {
        forcedRef.current = FORCED_BY_SCENARIO["no-response"] ?? null;
        setMunicipalityOverride(null); // busiest town — deepest bench
        trigger(undefined, true, scenarioWindowMs);
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

  /* --- Guided walkthrough ------------------------------------------------
     Facts are derived from state the store already holds, so a step can only
     be marked done because the thing genuinely happened. */
  const guideFacts: GuideFacts = useMemo(
    () => ({
      localeSwitched,
      hasRouted: routedLeads.length > 0,
      hasEscalated,
      hasReassigned,
      hasRuntimeMarket: jurisdictions.some((j) => j.createdAtRuntime),
      hasClosing: closings.length > 0,
    }),
    [closings.length, hasEscalated, hasReassigned, jurisdictions, localeSwitched, routedLeads.length],
  );

  const guideDone = useMemo(
    () => GUIDE_STEPS.map((step) => step.isDone(guideFacts)),
    [guideFacts],
  );

  const openGuide = useCallback(() => setGuideDismissed(false), []);
  const dismissGuide = useCallback(() => setGuideDismissed(true), []);
  const goToStep = useCallback((index: number) => {
    setGuideStep(Math.max(0, Math.min(index, GUIDE_STEPS.length - 1)));
  }, []);

  /** Take the visitor to this step's view and run its scenario, if it has one. */
  const showStep = useCallback(() => {
    const step = GUIDE_STEPS[guideStep];
    if (!step) return;
    setView(step.view);
    if (step.scenario) runScenario(step.scenario);
  }, [guideStep, runScenario]);

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
    setLocaleRaw(created.defaultLocale);
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
      setLocaleRaw(stored.locale);
      setSpeed(stored.speed);
      setMunicipalityOverride(stored.municipalityOverride);
      setHeld(stored.held);
      setRoutedLeads(stored.routedLeads);
      setClosings(stored.closings);
      setGuideDismissed(stored.guideDismissed);
      setGuideStep(stored.guideStep);
      setLocaleSwitched(stored.localeSwitched);
      setHasEscalated(stored.hasEscalated);
      setHasReassigned(stored.hasReassigned);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      version: 3,
      jurisdictions,
      agents,
      jurisdictionCode,
      locale,
      speed,
      municipalityOverride,
      held,
      routedLeads,
      closings,
      guideDismissed,
      guideStep,
      localeSwitched,
      hasEscalated,
      hasReassigned,
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
    routedLeads,
    closings,
    guideDismissed,
    guideStep,
    localeSwitched,
    hasEscalated,
    hasReassigned,
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
    routedLeads,
    closings,
    advanceStage,
    closeLead,
    guideOpen: !guideDismissed,
    guideStep,
    guideFacts,
    guideDone,
    openGuide,
    dismissGuide,
    goToStep,
    showStep,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
