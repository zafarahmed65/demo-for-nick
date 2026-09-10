import type { Jurisdiction } from "./types";

/**
 * Pure configuration. Zero logic lives in this file on purpose.
 *
 * Everything that differs between Quebec and Ontario — commission, workflow,
 * terminology, disclosures, language rules — is expressed here as data. The
 * routing engine, the UI and the savings math all read from these records and
 * none of them branch on a jurisdiction code. That is what makes adding a new
 * province or state a configuration change rather than a rebuild.
 */

export const QUEBEC: Jurisdiction = {
  code: "QC",
  name: { fr: "Québec", en: "Quebec" },
  country: "CA",
  currencyCode: "CAD",
  defaultLocale: "fr",
  requiredLocales: ["fr", "en"],
  commissionRate: 0.02,
  marketCommissionRate: 0.05,
  slaSeconds: 60,
  escalationLevels: 2,
  terminology: {
    agent: { fr: "courtier immobilier", en: "real estate broker" },
    agentPlural: { fr: "courtiers", en: "brokers" },
    listingAgreement: { fr: "contrat de courtage", en: "brokerage contract" },
    purchaseAgreement: { fr: "promesse d'achat", en: "promise to purchase" },
    closingOfficer: { fr: "notaire", en: "notary" },
    regulator: { fr: "OACIQ", en: "OACIQ" },
  },
  legalDisclosure: {
    fr: "Courtage immobilier encadré par l'OACIQ. Le contenu public est diffusé en français conformément à la Charte de la langue française.",
    en: "Real estate brokerage regulated by the OACIQ. Public content is published in French in accordance with the Charter of the French Language.",
  },
  workflow: [
    {
      key: "nouveau",
      label: { fr: "Nouveau lead", en: "New lead" },
      requiredDocuments: [],
    },
    {
      key: "qualification",
      label: { fr: "Qualification", en: "Qualification" },
      requiredDocuments: [],
    },
    {
      key: "evaluation",
      label: { fr: "Rendez-vous d'évaluation", en: "Valuation appointment" },
      requiredDocuments: [
        { fr: "Compte de taxes municipales", en: "Municipal tax bill" },
      ],
    },
    {
      key: "contrat-courtage",
      label: { fr: "Contrat de courtage signé", en: "Brokerage contract signed" },
      requiredDocuments: [
        { fr: "Certificat de localisation", en: "Certificate of location" },
        { fr: "Déclarations du vendeur", en: "Seller's declarations" },
      ],
    },
    {
      key: "inscription",
      label: { fr: "Inscription active", en: "Active listing" },
      requiredDocuments: [],
    },
    {
      key: "promesse",
      label: { fr: "Promesse d'achat acceptée", en: "Promise to purchase accepted" },
      requiredDocuments: [],
    },
    {
      key: "notaire",
      label: { fr: "Chez le notaire", en: "At the notary" },
      requiredDocuments: [{ fr: "Acte de vente", en: "Deed of sale" }],
    },
    {
      key: "conclue",
      label: { fr: "Transaction conclue", en: "Closed" },
      requiredDocuments: [],
    },
  ],
  municipalities: [
    "Montréal",
    "Laval",
    "Longueuil",
    "Gatineau",
    "Québec",
    "Sherbrooke",
    "Trois-Rivières",
    "Lévis",
    "Terrebonne",
    "Brossard",
  ],
};

export const ONTARIO: Jurisdiction = {
  code: "ON",
  name: { fr: "Ontario", en: "Ontario" },
  country: "CA",
  currencyCode: "CAD",
  defaultLocale: "en",
  requiredLocales: ["en", "fr"],
  commissionRate: 0.02,
  marketCommissionRate: 0.05,
  slaSeconds: 60,
  escalationLevels: 2,
  terminology: {
    agent: { fr: "agent immobilier", en: "real estate agent" },
    agentPlural: { fr: "agents", en: "agents" },
    listingAgreement: { fr: "contrat d'inscription", en: "listing agreement" },
    purchaseAgreement: { fr: "convention d'achat-vente", en: "agreement of purchase and sale" },
    closingOfficer: { fr: "avocat", en: "lawyer" },
    regulator: { fr: "RECO", en: "RECO" },
  },
  legalDisclosure: {
    fr: "Services de courtage réglementés par RECO en vertu de la Loi sur la confiance envers les services immobiliers (TRESA).",
    en: "Brokerage services regulated by RECO under the Trust in Real Estate Services Act (TRESA).",
  },
  workflow: [
    { key: "new-lead", label: { fr: "Nouveau lead", en: "New lead" }, requiredDocuments: [] },
    { key: "qualification", label: { fr: "Qualification", en: "Qualification" }, requiredDocuments: [] },
    {
      key: "listing-appointment",
      label: { fr: "Rendez-vous d'inscription", en: "Listing appointment" },
      requiredDocuments: [{ fr: "Avis d'évaluation foncière", en: "Property tax assessment" }],
    },
    {
      key: "listing-agreement",
      label: { fr: "Contrat d'inscription signé", en: "Listing agreement signed" },
      requiredDocuments: [
        { fr: "Arpentage du terrain", en: "Property survey" },
        { fr: "Déclaration d'information du vendeur", en: "Seller Property Information Statement" },
      ],
    },
    { key: "active-listing", label: { fr: "Inscription active", en: "Active listing" }, requiredDocuments: [] },
    { key: "offer-accepted", label: { fr: "Offre acceptée", en: "Offer accepted" }, requiredDocuments: [] },
    {
      key: "conditions-waived",
      label: { fr: "Conditions levées", en: "Conditions waived" },
      requiredDocuments: [{ fr: "Confirmation de financement", en: "Financing confirmation" }],
    },
    {
      key: "closed",
      label: { fr: "Transaction conclue", en: "Closed" },
      requiredDocuments: [{ fr: "État des ajustements", en: "Statement of adjustments" }],
    },
  ],
  municipalities: [
    "Toronto",
    "Ottawa",
    "Mississauga",
    "Hamilton",
    "Brampton",
    "London",
    "Markham",
    "Vaughan",
    "Kitchener",
    "Windsor",
  ],
};

export const SEED_JURISDICTIONS: Jurisdiction[] = [QUEBEC, ONTARIO];

/**
 * Stage presets offered by the "add jurisdiction" form, so a new market can be
 * stood up from the admin console without an engineer writing a migration.
 */
export const WORKFLOW_PRESETS: Record<string, { label: LocalizedLabel; stages: string[] }> = {
  "ca-standard": {
    label: { fr: "Canada — standard", en: "Canada — standard" },
    stages: ["New lead", "Qualification", "Listing appointment", "Listing agreement", "Active listing", "Offer accepted", "Conditions waived", "Closed"],
  },
  "us-standard": {
    label: { fr: "États-Unis — standard", en: "United States — standard" },
    stages: ["New lead", "Qualification", "Listing appointment", "Listing agreement", "Active listing", "Under contract", "Escrow", "Closed"],
  },
  minimal: {
    label: { fr: "Minimal — 4 étapes", en: "Minimal — 4 stages" },
    stages: ["New lead", "Qualification", "Active listing", "Closed"],
  },
};

type LocalizedLabel = { fr: string; en: string };
