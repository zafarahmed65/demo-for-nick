import type {
  Agent,
  Jurisdiction,
  Lead,
  LocalizedText,
  RoutingCandidate,
  RoutingPlan,
  TraceEntry,
  TraceKind,
} from "./types";

/**
 * The routing engine.
 *
 * One pure function. No I/O, no framework, no jurisdiction hard-coded. Given a
 * lead, its jurisdiction record and the current roster, it returns the ordered
 * list of brokers to try and a human-readable trace of exactly why.
 *
 * Being pure is the point: the same function runs in the UI here, and would run
 * unchanged in a queue worker or an edge function in production. It is also
 * trivially unit-testable, which is what you want for the piece of the system
 * that decides who gets paid.
 *
 * Escalation over time is deliberately NOT in here. This function decides the
 * order; the caller owns the clock. That separation is what keeps the decision
 * logic testable without faking timers.
 */

let traceSeq = 0;

function step(
  kind: TraceKind,
  fr: string,
  en: string,
  annotation?: string | LocalizedText,
  agentId?: string,
): TraceEntry {
  traceSeq += 1;
  return {
    id: `t${traceSeq}`,
    at: Date.now(),
    kind,
    message: { fr, en },
    // A bare string is language-neutral (counts, ids, durations).
    annotation:
      typeof annotation === "string"
        ? { fr: annotation, en: annotation }
        : annotation,
    agentId,
  };
}

/**
 * French treats 0 and 1 as singular; English only 1. Getting this wrong reads
 * as machine-translated, which is fatal for a French-first Quebec product.
 */
function frPlural(n: number, singular: string, plural: string): string {
  return n > 1 ? plural : singular;
}

/** Load as a fraction of capacity. Lower is more available. */
function loadRatio(agent: Agent): number {
  return agent.capacity === 0 ? 1 : agent.activeFiles / agent.capacity;
}

export function routeLead(
  lead: Lead,
  jurisdiction: Jurisdiction,
  agents: Agent[],
): RoutingPlan {
  const started = performance.now();
  const steps: TraceEntry[] = [];

  const money = formatMoney(lead.propertyValue, jurisdiction, lead.locale);
  steps.push(
    step(
      "intake",
      `Lead reçu — ${lead.municipality} · ${money}`,
      `Lead received — ${lead.municipality} · ${money}`,
      lead.id,
    ),
  );

  steps.push(
    step(
      "resolve",
      `Juridiction → ${jurisdiction.code} · commission ${formatRate(jurisdiction.commissionRate, "fr")} · SLA ${jurisdiction.slaSeconds} s`,
      `Jurisdiction → ${jurisdiction.code} · commission ${formatRate(jurisdiction.commissionRate, "en")} · SLA ${jurisdiction.slaSeconds}s`,
    ),
  );

  // Every agent starts eligible and is knocked out by a named rule, so the
  // trace can explain each exclusion rather than just showing a survivor list.
  const candidates: RoutingCandidate[] = agents.map((agent) => ({
    agent,
    eligible: true,
  }));

  const knockOut = (
    predicate: (agent: Agent) => boolean,
    fr: string,
    en: string,
  ) => {
    for (const candidate of candidates) {
      if (candidate.eligible && predicate(candidate.agent)) {
        candidate.eligible = false;
        candidate.reason = { fr, en };
      }
    }
  };

  // 1 — Licensing. A broker may only take leads in a jurisdiction they hold a
  //     licence in. This is a legal constraint, so it is applied first.
  knockOut(
    (a) => !a.jurisdictions.includes(jurisdiction.code),
    `Non licencié en ${jurisdiction.code}`,
    `Not licensed in ${jurisdiction.code}`,
  );
  const licensed = countEligible(candidates);
  steps.push(
    step(
      "filter",
      `Filtre licence → ${licensed} ${frPlural(licensed, jurisdiction.terminology.agent.fr, jurisdiction.terminology.agentPlural.fr)} ${frPlural(licensed, "licencié", "licenciés")}`,
      `Licence filter → ${licensed} licensed ${licensed === 1 ? jurisdiction.terminology.agent.en : jurisdiction.terminology.agentPlural.en}`,
      `${licensed}/${agents.length}`,
    ),
  );

  // 2 — Geography. Empty coverage means the whole jurisdiction.
  const beforeGeo = countEligible(candidates);
  knockOut(
    (a) => a.coverage.length > 0 && !a.coverage.includes(lead.municipality),
    `Ne couvre pas ${lead.municipality}`,
    `Does not cover ${lead.municipality}`,
  );
  const covering = countEligible(candidates);
  const geoDropped = beforeGeo - covering;
  steps.push(
    step(
      "filter",
      `Filtre géographique → ${covering} ${frPlural(covering, "couvre", "couvrent")} ${lead.municipality}`,
      `Geography filter → ${covering} cover${covering === 1 ? "s" : ""} ${lead.municipality}`,
      geoDropped > 0 ? `−${geoDropped}` : undefined,
    ),
  );

  // 3 — Capacity. A broker at their cap is protected from more work, which is
  //     what stops the "top performer gets buried" failure mode.
  const beforeCap = countEligible(candidates);
  knockOut(
    (a) => a.activeFiles >= a.capacity,
    "Capacité atteinte",
    "At capacity",
  );
  const capExcluded = beforeCap - countEligible(candidates);
  steps.push(
    step(
      "filter",
      capExcluded > 0
        ? `Filtre capacité → ${capExcluded} exclu${capExcluded > 1 ? "s" : ""} (dossiers actifs au maximum)`
        : "Filtre capacité → aucun exclu",
      capExcluded > 0
        ? `Capacity filter → ${capExcluded} excluded (active files at cap)`
        : "Capacity filter → none excluded",
      {
        fr: `${countEligible(candidates)} ${frPlural(countEligible(candidates), "restant", "restants")}`,
        en: `${countEligible(candidates)} remaining`,
      },
    ),
  );

  // 4 — Language. The seller is served in the language they arrived in. In
  //     Quebec this is not a nicety, it is the default obligation.
  const beforeLang = countEligible(candidates);
  knockOut(
    (a) => !a.languages.includes(lead.locale),
    `Ne sert pas en ${lead.locale.toUpperCase()}`,
    `Does not serve in ${lead.locale.toUpperCase()}`,
  );
  const speaking = countEligible(candidates);
  const langDropped = beforeLang - speaking;
  steps.push(
    step(
      "filter",
      `Filtre linguistique (${lead.locale.toUpperCase()}) → ${speaking} ${frPlural(speaking, "admissible", "admissibles")}`,
      `Language filter (${lead.locale.toUpperCase()}) → ${speaking} eligible`,
      langDropped > 0 ? `−${langDropped}` : undefined,
    ),
  );

  // 5 — Rank. Round-robin on last assignment keeps distribution fair; load
  //     ratio breaks ties so the least-busy eligible broker wins.
  const escalationOrder = candidates
    .filter((c) => c.eligible)
    .map((c) => c.agent)
    .sort((a, b) => {
      if (a.lastAssignedAt !== b.lastAssignedAt) {
        return a.lastAssignedAt - b.lastAssignedAt;
      }
      return loadRatio(a) - loadRatio(b);
    });

  const decisionMs = performance.now() - started;

  if (escalationOrder.length === 0) {
    steps.push(
      step(
        "hold",
        "Aucun courtier admissible → file d'attente",
        "No eligible broker → hold queue",
      ),
    );
    return { candidates, escalationOrder, steps, decisionMs };
  }

  steps.push(
    step(
      "assign",
      `Rotation équitable → ${escalationOrder[0].name}`,
      `Round-robin → ${escalationOrder[0].name}`,
      {
        fr: `décision ${decisionMs.toFixed(1)} ms`,
        en: `decision ${decisionMs.toFixed(1)} ms`,
      },
      escalationOrder[0].id,
    ),
  );

  return { candidates, escalationOrder, steps, decisionMs };
}

function countEligible(candidates: RoutingCandidate[]): number {
  return candidates.filter((c) => c.eligible).length;
}

/* ------------------------------------------------------------------
   Formatting helpers. Locale-aware because "450 000 $" and "$450,000"
   are both correct and neither is correct in the other market.
   ------------------------------------------------------------------ */

export function formatMoney(
  value: number,
  jurisdiction: Jurisdiction,
  locale: "fr" | "en",
): string {
  const tag = locale === "fr" ? "fr-CA" : jurisdiction.country === "US" ? "en-US" : "en-CA";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: jurisdiction.currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRate(rate: number, locale: "fr" | "en"): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    style: "percent",
    minimumFractionDigits: rate * 100 % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(rate);
}
