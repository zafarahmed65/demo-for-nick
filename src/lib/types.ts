/**
 * Domain model for the lead engine.
 *
 * The important idea: a Jurisdiction is DATA, not code. Commission rates,
 * workflow stages, terminology, legal disclosures and language rules all
 * live on the jurisdiction record. Adding Ontario — or Florida — is a row,
 * not a deploy. Nothing in this file or in routing.ts hard-codes "QC".
 */

export type Locale = "fr" | "en";

/** Any user-visible string is localized. Nothing is hard-coded to one language. */
export type LocalizedText = Record<Locale, string>;

export interface WorkflowStage {
  key: string;
  label: LocalizedText;
  /** Documents the seller must supply before this stage can close. */
  requiredDocuments: LocalizedText[];
}

export interface Jurisdiction {
  code: string;
  name: LocalizedText;
  country: "CA" | "US";
  currencyCode: string;
  /** Locale the public experience renders in by default, before any toggle. */
  defaultLocale: Locale;
  /** Locales that are legally required to exist for public content. */
  requiredLocales: Locale[];
  /** Our discount commission, e.g. 0.02 = 2%. */
  commissionRate: number;
  /** Prevailing local rate, used for the savings comparison. */
  marketCommissionRate: number;
  /** Speed-to-lead target. An agent must accept inside this window. */
  slaSeconds: number;
  /** How many times we reassign before the lead goes to the hold queue. */
  escalationLevels: number;
  terminology: Record<string, LocalizedText>;
  legalDisclosure: LocalizedText;
  workflow: WorkflowStage[];
  municipalities: string[];
  /** Set on jurisdictions created at runtime through the admin form. */
  createdAtRuntime?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  initials: string;
  /** Jurisdiction codes this agent is licensed in. */
  jurisdictions: string[];
  /** Municipalities served. Empty array means the whole jurisdiction. */
  coverage: string[];
  languages: Locale[];
  activeFiles: number;
  capacity: number;
  /** Epoch ms of last assignment — drives round-robin fairness. */
  lastAssignedAt: number;
  /** Demo-only: likelihood this agent accepts before the SLA expires. */
  responsiveness: number;
}

export interface Lead {
  id: string;
  sellerName: string;
  municipality: string;
  jurisdictionCode: string;
  propertyValue: number;
  locale: Locale;
  campaignId: string;
  gclid: string;
  createdAt: number;
}

export type TraceKind =
  | "intake"
  | "resolve"
  | "filter"
  | "assign"
  | "waiting"
  | "escalate"
  | "accept"
  | "hold";

export interface TraceEntry {
  id: string;
  at: number;
  kind: TraceKind;
  message: LocalizedText;
  /** Right-aligned annotation: elapsed time, counts, agent name. */
  annotation?: string;
  agentId?: string;
}

export interface RoutingCandidate {
  agent: Agent;
  eligible: boolean;
  /** Why this agent was filtered out, if they were. */
  reason?: LocalizedText;
}

export interface RoutingPlan {
  candidates: RoutingCandidate[];
  /** Eligible agents in the exact order we will try them. */
  escalationOrder: Agent[];
  steps: TraceEntry[];
  /** Wall-clock cost of the routing decision itself. */
  decisionMs: number;
}

export type LeadStatus =
  | "routing"
  | "awaiting"
  | "accepted"
  | "held";

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  spend: number;
  clicks: number;
  leads: number;
  closings: number;
}

export interface AttributionTouch {
  label: LocalizedText;
  detail: string;
  at: string;
}
