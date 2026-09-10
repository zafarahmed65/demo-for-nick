"use client";

import { useState } from "react";
import { Radio, Globe2, BarChart3, Code2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatRate } from "@/lib/routing";
import { Segmented } from "./ui";
import { Simulator } from "./simulator";
import { Inspector } from "./inspector";
import { JurisdictionPanel } from "./jurisdiction-panel";
import { AttributionPanel } from "./attribution-panel";
import type { Locale } from "@/lib/types";

type View = "simulator" | "jurisdictions" | "attribution";

const REPO_URL = "https://github.com/zafarahmed65/nick-demo";

const NAV: { key: View; icon: typeof Radio; labelKey: string }[] = [
  { key: "simulator", icon: Radio, labelKey: "nav.simulator" },
  { key: "jurisdictions", icon: Globe2, labelKey: "nav.jurisdictions" },
  { key: "attribution", icon: BarChart3, labelKey: "nav.attribution" },
];

export function Shell() {
  const {
    t,
    locale,
    setLocale,
    jurisdiction,
    jurisdictions,
    setJurisdictionCode,
  } = useStore();
  const [view, setView] = useState<View>("simulator");

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden">
      {/* ---------- Left rail ---------- */}
      <aside className="lg:w-[228px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[var(--hairline)] flex flex-col lg:h-screen lg:overflow-y-auto scroll-slim">
        <div className="px-4 h-14 flex items-center border-b border-[var(--hairline)]">
          <div className="size-6 rounded-sm bg-pine-700 grid place-items-center shrink-0">
            <span className="text-white text-2xs font-bold tracking-tight">LE</span>
          </div>
          <div className="ml-2.5 min-w-0">
            <p className="text-xs font-medium text-ink-900 leading-tight truncate">
              {t("app.name")}
            </p>
            <p className="text-2xs text-ink-400 leading-tight truncate">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        {/* Horizontal on small screens so the rail does not push the console
            a full screen down the page on a phone. */}
        <nav className="p-2 border-b border-[var(--hairline)] flex gap-1 overflow-x-auto scroll-slim lg:block">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`shrink-0 lg:w-full flex items-center gap-2.5 h-8 px-2.5 lg:px-2 rounded-sm text-xs whitespace-nowrap transition-colors duration-150 ${
                  active
                    ? "bg-pine-50 text-pine-800 font-medium"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`}
              >
                <Icon size={14} className={active ? "text-pine-600" : "text-ink-400"} />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-b border-[var(--hairline)]">
          <p className="text-2xs uppercase tracking-[0.07em] text-ink-500 mb-1.5 font-medium">
            {t("rail.jurisdiction")}
          </p>
          <div className="space-y-0.5">
            {jurisdictions.map((j) => {
              const active = j.code === jurisdiction.code;
              return (
                <button
                  key={j.code}
                  onClick={() => setJurisdictionCode(j.code)}
                  className={`w-full flex items-center gap-2 h-7 px-1.5 rounded-xs text-2xs transition-colors duration-150 ${
                    active
                      ? "bg-ink-900 text-white"
                      : "text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  <span
                    className={`font-mono font-semibold ${
                      active ? "text-white" : "text-ink-400"
                    }`}
                  >
                    {j.code}
                  </span>
                  <span className="truncate">{j.name[locale]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-b border-[var(--hairline)]">
          <Segmented<Locale>
            label={t("rail.language")}
            value={locale}
            onChange={setLocale}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
          />
        </div>

        <dl className="hidden lg:block p-3 space-y-1.5 border-b border-[var(--hairline)]">
          <RailStat
            label={t("rail.commission")}
            value={formatRate(jurisdiction.commissionRate, locale)}
            accent
          />
          <RailStat
            label={t("rail.market")}
            value={formatRate(jurisdiction.marketCommissionRate, locale)}
          />
          <RailStat label={t("rail.sla")} value={`${jurisdiction.slaSeconds}s`} />
        </dl>

        <div className="px-3 pb-3 pt-0 lg:p-3 mt-auto">
          <p className="hidden lg:block text-2xs text-ink-400 leading-relaxed">
            {jurisdiction.legalDisclosure[locale]}
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-2xs text-ink-500 hover:text-ink-900 transition-colors duration-150"
          >
            <Code2 size={11} />
            {t("common.showSource")}
          </a>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 min-w-0 flex flex-col lg:h-screen">
        <header className="h-14 shrink-0 px-4 lg:px-5 flex items-center justify-between border-b border-[var(--hairline)] bg-white/60 backdrop-blur-sm">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-ink-900 truncate">
              {t(NAV.find((n) => n.key === view)!.labelKey)}
            </h1>
            <p className="text-2xs text-ink-400 truncate">{t("app.context")}</p>
          </div>
          <span className="font-mono text-2xs text-ink-400 tabular shrink-0 ml-3">
            {jurisdiction.code} · {locale.toUpperCase()}
          </span>
        </header>

        <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-3 p-3 lg:p-4">
          <main className="flex-1 min-w-0 flex flex-col min-h-0">
            {view === "simulator" && <Simulator />}
            {view === "jurisdictions" && <JurisdictionPanel />}
            {view === "attribution" && <AttributionPanel />}
          </main>

          {view === "simulator" && (
            <aside className="xl:w-[292px] shrink-0 min-h-0">
              <Inspector />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function RailStat({
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
      <dt className="text-2xs text-ink-400">{label}</dt>
      <dd
        className={`font-mono text-2xs tabular ${
          accent ? "text-pine-700 font-medium" : "text-ink-600"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
