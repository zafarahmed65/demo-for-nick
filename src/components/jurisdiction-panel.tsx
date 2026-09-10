"use client";

import { useState } from "react";
import { Plus, Check, FileText, Sparkles } from "lucide-react";
import { useStore, type NewJurisdictionInput } from "@/lib/store";
import { WORKFLOW_PRESETS } from "@/lib/jurisdictions";
import { formatMoney, formatRate } from "@/lib/routing";
import { Panel, Button, Badge, Field, inputClass } from "./ui";
import type { Locale } from "@/lib/types";

const SAMPLE_PROPERTY = 500_000;

export function JurisdictionPanel() {
  const {
    jurisdictions,
    jurisdiction,
    setJurisdictionCode,
    addJurisdiction,
    locale,
    t,
    jurisdictionFormOpen: adding,
    setJurisdictionFormOpen: setAdding,
  } = useStore();

  const savings =
    SAMPLE_PROPERTY * jurisdiction.marketCommissionRate -
    SAMPLE_PROPERTY * jurisdiction.commissionRate;

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-y-auto scroll-slim pr-0.5">
      <Panel
        title={t("jur.title")}
        action={
          <Button
            size="sm"
            variant={adding ? "secondary" : "primary"}
            onClick={() => setAdding(!adding)}
            dataTour="add-jurisdiction"
          >
            <Plus size={12} />
            {adding ? t("jur.cancel") : t("jur.add")}
          </Button>
        }
      >
        <p className="px-5 pb-4 text-small text-ink-500 leading-relaxed max-w-[76ch]">
          {t("jur.lede")}
        </p>

        {adding && (
          <AddJurisdictionForm
            onCancel={() => setAdding(false)}
            onCreate={(input) => {
              addJurisdiction(input);
              setAdding(false);
            }}
          />
        )}

        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 border-t border-[var(--hairline)]">
          {jurisdictions.map((j) => {
            const active = j.code === jurisdiction.code;
            return (
              <li
                key={j.code}
                className="bg-white border-b border-r border-[var(--hairline)]"
              >
                <button
                  onClick={() => setJurisdictionCode(j.code)}
                  className={`w-full text-left px-4 py-3 transition-colors duration-150 ${
                    active ? "bg-pine-50" : "hover:bg-ink-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-micro font-semibold px-1.5 h-[18px] inline-flex items-center rounded-xs ${
                        active
                          ? "bg-pine-600 text-white"
                          : "bg-ink-150 text-ink-600"
                      }`}
                    >
                      {j.code}
                    </span>
                    <span className="text-small font-medium text-ink-900 truncate">
                      {j.name[locale]}
                    </span>
                    {active && <Check size={12} className="text-pine-600 ml-auto" />}
                  </div>
                  <dl className="mt-2 space-y-0.5">
                    <Row
                      label={t("jur.commission")}
                      value={formatRate(j.commissionRate, locale)}
                      accent
                    />
                    <Row
                      label={t("jur.marketRate")}
                      value={formatRate(j.marketCommissionRate, locale)}
                    />
                    <Row label={t("jur.sla")} value={`${j.slaSeconds}s`} />
                    <Row
                      label={t("jur.workflow")}
                      value={`${j.workflow.length} ${t("jur.stages")}`}
                    />
                  </dl>
                  {j.createdAtRuntime && (
                    <div className="mt-2">
                      <Badge tone="accent">
                        <Sparkles size={9} className="mr-1" />
                        {t("jur.runtime")}
                      </Badge>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title={t("jur.workflow")} meta={jurisdiction.code}>
          <ol className="divide-y divide-[var(--hairline)]">
            {jurisdiction.workflow.map((stage, index) => (
              <li key={stage.key} className="px-5 py-2.5 flex items-start gap-3">
                <span className="font-mono text-micro text-ink-400 tabular pt-[3px] w-4 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-small text-ink-800">{stage.label[locale]}</p>
                  {stage.requiredDocuments.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {stage.requiredDocuments.map((doc) => (
                        <li
                          key={doc.en}
                          className="flex items-center gap-1.5 text-micro text-ink-500"
                        >
                          <FileText size={10} className="shrink-0 text-ink-400" />
                          {doc[locale]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title={t("jur.terminology")}>
            <dl className="divide-y divide-[var(--hairline)]">
              {Object.entries(jurisdiction.terminology).map(([key, text]) => (
                <div key={key} className="px-5 py-2 flex items-baseline gap-3">
                  <dt className="font-mono text-micro text-ink-400 w-[124px] shrink-0">
                    {key}
                  </dt>
                  <dd className="text-small text-ink-800">{text[locale]}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title={t("jur.seller")}>
            <div className="px-5 pb-5">
              <p className="text-micro text-ink-500">
                {t("jur.savingsOn")}{" "}
                <span className="font-mono tabular text-ink-700">
                  {formatMoney(SAMPLE_PROPERTY, jurisdiction, locale)}
                </span>
              </p>
              <p className="text-display font-mono tabular text-pine-700 mt-1 tracking-tight">
                {formatMoney(savings, jurisdiction, locale)}
              </p>
              <div className="flex gap-4 mt-2">
                <Stat
                  label={t("jur.marketRate")}
                  value={formatMoney(
                    SAMPLE_PROPERTY * jurisdiction.marketCommissionRate,
                    jurisdiction,
                    locale,
                  )}
                />
                <Stat
                  label={t("jur.commission")}
                  value={formatMoney(
                    SAMPLE_PROPERTY * jurisdiction.commissionRate,
                    jurisdiction,
                    locale,
                  )}
                  accent
                />
              </div>
            </div>
          </Panel>

          <Panel title={t("jur.disclosure")}>
            <p className="px-5 pb-5 text-small text-ink-500 leading-relaxed">
              {jurisdiction.legalDisclosure[locale]}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-micro text-ink-400">{label}</dt>
      <dd
        className={`font-mono text-micro tabular ${
          accent ? "text-pine-700 font-medium" : "text-ink-600"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-micro text-ink-400">{label}</p>
      <p
        className={`font-mono text-small tabular ${
          accent ? "text-pine-700" : "text-ink-600 line-through decoration-ink-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------
   The form that proves the point: a new market with no code change.
   ------------------------------------------------------------------ */
function AddJurisdictionForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: NewJurisdictionInput) => void;
  onCancel: () => void;
}) {
  const { t } = useStore();
  const [code, setCode] = useState("FL");
  const [name, setName] = useState("Florida");
  const [country, setCountry] = useState<"CA" | "US">("US");
  const [commission, setCommission] = useState("1.5");
  const [market, setMarket] = useState("6");
  const [sla, setSla] = useState("60");
  const [defaultLocale, setDefaultLocale] = useState<Locale>("en");
  const [preset, setPreset] = useState("us-standard");
  const [municipalities, setMunicipalities] = useState(
    "Miami, Orlando, Tampa, Jacksonville",
  );

  return (
    <form
      className="px-5 pb-5 animate-rise"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({
          code: code.trim() || "XX",
          name: name.trim() || "New market",
          country,
          currencyCode: country === "US" ? "USD" : "CAD",
          commissionRate: Number(commission) / 100,
          marketCommissionRate: Number(market) / 100,
          slaSeconds: Number(sla) || 60,
          defaultLocale,
          preset,
          municipalities: municipalities
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label={t("jur.code")}>
          <input
            className={inputClass}
            value={code}
            maxLength={3}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </Field>
        <Field label={t("jur.name")}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("jur.country")}>
          <select
            className={inputClass}
            value={country}
            onChange={(e) => setCountry(e.target.value as "CA" | "US")}
          >
            <option value="CA">Canada (CAD)</option>
            <option value="US">United States (USD)</option>
          </select>
        </Field>
        <Field label={t("jur.defaultLocale")}>
          <select
            className={inputClass}
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as Locale)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={`${t("jur.commission")} (%)`}>
          <input
            className={inputClass}
            value={commission}
            inputMode="decimal"
            onChange={(e) => setCommission(e.target.value)}
          />
        </Field>
        <Field label={`${t("jur.marketRate")} (%)`}>
          <input
            className={inputClass}
            value={market}
            inputMode="decimal"
            onChange={(e) => setMarket(e.target.value)}
          />
        </Field>
        <Field label={t("jur.sla")}>
          <input
            className={inputClass}
            value={sla}
            inputMode="numeric"
            onChange={(e) => setSla(e.target.value)}
          />
        </Field>
        <Field label={t("jur.workflow")}>
          <select
            className={inputClass}
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            {Object.entries(WORKFLOW_PRESETS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label.en} ({value.stages.length})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label={t("jur.municipalities")} hint={t("jur.municipalitiesHint")}>
          <input
            className={inputClass}
            value={municipalities}
            onChange={(e) => setMunicipalities(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-2 mt-3">
        <Button type="submit" variant="primary">
          <Check size={12} />
          {t("jur.create")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("jur.cancel")}
        </Button>
      </div>
    </form>
  );
}
