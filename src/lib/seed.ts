import type { Agent, Campaign, Lead } from "./types";

/**
 * Seed roster. Capacity and coverage are deliberately uneven so the routing
 * trace has something real to say: one broker is at capacity and gets filtered,
 * one is slow to respond and triggers the escalation path.
 */
export const SEED_AGENTS: Agent[] = [
  {
    id: "ag-tremblay",
    name: "Marie-Claude Tremblay",
    initials: "MT",
    jurisdictions: ["QC"],
    coverage: ["Laval", "Montréal", "Terrebonne"],
    languages: ["fr", "en"],
    // Deliberately the least-loaded broker in Laval, so round-robin reaches her
    // first and her low responsiveness is what actually drives the escalation.
    activeFiles: 2,
    capacity: 12,
    lastAssignedAt: 0,
    responsiveness: 0.15,
  },
  {
    id: "ag-gagnon",
    name: "Simon Gagnon",
    initials: "SG",
    jurisdictions: ["QC"],
    coverage: ["Laval", "Longueuil", "Brossard"],
    languages: ["fr"],
    activeFiles: 4,
    capacity: 10,
    lastAssignedAt: 0,
    responsiveness: 0.9,
  },
  {
    id: "ag-bouchard",
    name: "Isabelle Bouchard",
    initials: "IB",
    jurisdictions: ["QC"],
    coverage: ["Montréal", "Laval", "Longueuil"],
    languages: ["fr", "en"],
    // At capacity on purpose: shows the capacity cap actually filtering.
    activeFiles: 12,
    capacity: 12,
    lastAssignedAt: 0,
    responsiveness: 0.8,
  },
  {
    id: "ag-dube",
    name: "Alexandre Dubé",
    initials: "AD",
    jurisdictions: ["QC"],
    coverage: ["Québec", "Lévis", "Trois-Rivières"],
    languages: ["fr"],
    activeFiles: 3,
    capacity: 10,
    lastAssignedAt: 0,
    responsiveness: 0.75,
  },
  {
    id: "ag-benali",
    name: "Nadia Benali",
    initials: "NB",
    jurisdictions: ["QC"],
    coverage: ["Montréal", "Laval", "Brossard"],
    languages: ["fr", "en"],
    activeFiles: 6,
    capacity: 12,
    lastAssignedAt: 0,
    responsiveness: 0.6,
  },
  {
    id: "ag-ouellet",
    name: "Pierre-Luc Ouellet",
    initials: "PO",
    jurisdictions: ["QC"],
    coverage: ["Gatineau", "Sherbrooke"],
    languages: ["fr"],
    activeFiles: 2,
    capacity: 8,
    lastAssignedAt: 0,
    responsiveness: 0.8,
  },
  {
    id: "ag-whitfield",
    name: "Sarah Whitfield",
    initials: "SW",
    jurisdictions: ["ON"],
    coverage: ["Toronto", "Markham", "Vaughan"],
    languages: ["en"],
    activeFiles: 2,
    capacity: 12,
    lastAssignedAt: 0,
    responsiveness: 0.3,
  },
  {
    id: "ag-okafor",
    name: "Daniel Okafor",
    initials: "DO",
    jurisdictions: ["ON"],
    coverage: ["Ottawa", "Kitchener", "Toronto"],
    languages: ["en", "fr"],
    activeFiles: 5,
    capacity: 10,
    lastAssignedAt: 0,
    responsiveness: 0.85,
  },
  {
    id: "ag-raman",
    name: "Priya Raman",
    initials: "PR",
    jurisdictions: ["ON"],
    coverage: ["Mississauga", "Brampton", "Hamilton"],
    languages: ["en"],
    activeFiles: 9,
    capacity: 12,
    lastAssignedAt: 0,
    responsiveness: 0.7,
  },
];

/**
 * Spend is real money, so cost-per-closing is the only column that matters.
 * The numbers are arranged to produce an actual insight: Meta is burning
 * ~3x the referral programme per closing despite a healthy cost-per-lead.
 */
export const SEED_CAMPAIGNS: Campaign[] = [
  {
    id: "cmp-gads-laval",
    name: "Google Ads — vendre maison Laval",
    channel: "Google Ads",
    spend: 4200,
    clicks: 1840,
    leads: 96,
    closings: 7,
  },
  {
    id: "cmp-meta-commission",
    name: "Meta — commission 2 %",
    channel: "Meta",
    spend: 2800,
    clicks: 3100,
    leads: 71,
    closings: 3,
  },
  {
    id: "cmp-gads-mtl",
    name: "Google Ads — courtier Montréal",
    channel: "Google Ads",
    spend: 6100,
    clicks: 2210,
    leads: 118,
    closings: 11,
  },
  {
    id: "cmp-referral",
    name: "Programme de référencement",
    channel: "Referral",
    spend: 900,
    clicks: 210,
    leads: 34,
    closings: 6,
  },
];

const SELLER_NAMES_QC = [
  "Julie Lachance",
  "Martin Côté",
  "Sophie Bergeron",
  "Éric Fontaine",
  "Catherine Roy",
  "Yannick Pelletier",
  "Geneviève Morin",
  "Hugo Lavoie",
];

const SELLER_NAMES_ON = [
  "James Holloway",
  "Amrita Singh",
  "Kevin Brooks",
  "Laura Mensah",
  "Tom Ridley",
  "Chen Wei",
];

const PROPERTY_VALUES = [385_000, 420_000, 450_000, 515_000, 610_000, 725_000, 890_000];

let leadCounter = 0;

/** Builds a plausible inbound lead for the given jurisdiction. */
export function makeLead(
  jurisdictionCode: string,
  municipality: string,
  locale: "fr" | "en",
): Lead {
  leadCounter += 1;
  const pool = jurisdictionCode === "ON" ? SELLER_NAMES_ON : SELLER_NAMES_QC;
  const campaign = SEED_CAMPAIGNS[leadCounter % SEED_CAMPAIGNS.length];
  return {
    id: `LD-${String(4820 + leadCounter).padStart(4, "0")}`,
    sellerName: pool[leadCounter % pool.length],
    municipality,
    jurisdictionCode,
    propertyValue: PROPERTY_VALUES[leadCounter % PROPERTY_VALUES.length],
    locale,
    campaignId: campaign.id,
    gclid: `Cj0KCQ${Math.random().toString(36).slice(2, 12)}`,
    createdAt: Date.now(),
  };
}
