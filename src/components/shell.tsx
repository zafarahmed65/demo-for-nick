"use client";

import { Radio, Globe2, BarChart3, Code2 } from "lucide-react";
import { useStore, type View } from "@/lib/store";
import { Segmented } from "./ui";
import { Simulator } from "./simulator";
import { Inspector } from "./inspector";
import { JurisdictionPanel } from "./jurisdiction-panel";
import { AttributionPanel } from "./attribution-panel";
import type { Locale } from "@/lib/types";

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
    view,
    setView,
  } = useStore();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden">
      {/* ---------- Left rail ---------- */}
      <aside className="lg:w-[248px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[var(--hairline)] flex flex-col lg:h-screen lg:overflow-y-auto scroll-slim">
        <div className="px-4 h-16 flex items-center">
          <div className="size-8 rounded-md bg-pine-600 grid place-items-center shrink-0">
            <span className="text-white text-micro font-bold tracking-tight">LE</span>
          </div>
          <div className="ml-3 min-w-0">
            <p className="text-small font-medium text-ink-900 leading-tight truncate">
              {t("app.name")}
            </p>
            <p className="text-micro text-ink-400 leading-tight truncate">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        {/* Horizontal on small screens so the rail does not push the console
            a full screen down the page on a phone. */}
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto scroll-slim lg:block lg:space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`shrink-0 lg:w-full flex items-center gap-2.5 h-9 px-3 rounded-md text-small whitespace-nowrap transition-colors duration-150 ${
                  active
                    ? "bg-ink-100 text-ink-900 font-medium"
                    : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                <Icon size={15} className={active ? "text-pine-600" : "text-ink-400"} />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 pt-4 pb-3">
          <p className="text-small text-ink-500 mb-2">{t("rail.jurisdiction")}</p>
          <div className="space-y-0.5">
            {jurisdictions.map((j) => {
              const active = j.code === jurisdiction.code;
              return (
                <button
                  key={j.code}
                  onClick={() => setJurisdictionCode(j.code)}
                  className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-small transition-colors duration-150 ${
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

        <div className="px-4 pb-4">
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

        <div className="mt-auto px-4 py-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-small text-ink-400 hover:text-ink-900 transition-colors duration-150"
          >
            <Code2 size={13} />
            {t("common.showSource")}
          </a>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 min-w-0 flex flex-col lg:h-screen">
        <header className="h-16 shrink-0 px-5 lg:px-6 flex items-center justify-between">
          <h1 className="text-title font-medium text-ink-900 truncate min-w-0">
            {t(NAV.find((n) => n.key === view)!.labelKey)}
          </h1>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="font-mono text-micro text-ink-400 tabular">
              {jurisdiction.code} · {locale.toUpperCase()}
            </span>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-4 px-5 lg:px-6 pb-5 lg:pb-6">
          <main className="flex-1 min-w-0 flex flex-col xl:min-h-0">
            {view === "simulator" && <Simulator />}
            {view === "jurisdictions" && <JurisdictionPanel />}
            {view === "attribution" && <AttributionPanel />}
          </main>

          {view === "simulator" && (
            <aside className="xl:w-[320px] shrink-0 xl:min-h-0">
              <Inspector />
            </aside>
          )}
        </div>

      </div>
    </div>
  );
}
