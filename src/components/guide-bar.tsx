"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Play,
  Quote,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { GUIDE_STEPS } from "@/lib/guide";
import { Button } from "./ui";

/**
 * The guided walkthrough, docked below the console.
 *
 * Each step shows the client's own sentence and puts the thing that answers it
 * one press away. His quotes render in English regardless of the interface
 * language — they are quotations attributed to him, and translating a person's
 * own words back at them defeats the entire purpose.
 */
export function GuideBar() {
  const {
    guideOpen,
    guideStep,
    guideDone,
    dismissGuide,
    goToStep,
    showStep,
    locale,
    t,
  } = useStore();

  const [collapsed, setCollapsed] = useState(false);

  if (!guideOpen) return null;

  const step = GUIDE_STEPS[guideStep];
  const done = guideDone[guideStep];
  const allDone = guideDone.every(Boolean);
  const last = guideStep === GUIDE_STEPS.length - 1;

  return (
    <section className="shrink-0 sticky bottom-0 lg:static z-10 border-t border-[var(--hairline)] bg-white animate-rise">
      {/* Progress across the six requirements */}
      <div className="flex items-center gap-2 px-4 lg:px-5 pt-2.5">
        <span className="font-mono text-2xs text-ink-400 tabular shrink-0">
          {t("guide.step", { n: guideStep + 1, total: GUIDE_STEPS.length })}
        </span>
        <ol className="flex items-center gap-1 flex-1 min-w-0">
          {GUIDE_STEPS.map((s, index) => (
            <li key={s.key} className="flex-1 min-w-0">
              <button
                onClick={() => goToStep(index)}
                title={s.quote}
                aria-current={index === guideStep}
                className={`block w-full h-1 rounded-full transition-colors duration-150 ${
                  guideDone[index]
                    ? "bg-pine-500"
                    : index === guideStep
                      ? "bg-ink-500"
                      : "bg-ink-200 hover:bg-ink-300"
                }`}
              />
            </li>
          ))}
        </ol>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="shrink-0 inline-flex items-center text-ink-400 hover:text-ink-800 transition-colors duration-150"
        >
          {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          onClick={dismissGuide}
          className="shrink-0 inline-flex items-center gap-1 text-2xs text-ink-400 hover:text-ink-800 transition-colors duration-150"
        >
          <span className="hidden sm:inline">{t("guide.skip")}</span>
          <X size={11} />
        </button>
      </div>

      {collapsed ? (
        <div className="px-4 lg:px-5 py-2 flex items-center gap-3">
          <p className="text-2xs text-ink-500 truncate flex-1 min-w-0">
            {done ? t(`guide.${step.key}.outcome`) : t(`guide.${step.key}.instruction`)}
          </p>
          {step.scenario && !done && (
            <Button variant="primary" size="sm" onClick={showStep}>
              <Play size={11} />
              {t("guide.show")}
            </Button>
          )}
        </div>
      ) : allDone ? (
        <div className="px-4 lg:px-5 py-3">
          <p className="text-sm font-medium text-pine-800">
            {t("guide.finishedTitle")}
          </p>
          <p className="text-2xs text-ink-500 mt-0.5 max-w-[80ch]">
            {t("guide.finishedBody")}
          </p>
        </div>
      ) : (
        <div className="px-4 lg:px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* His words, verbatim, never translated */}
            <div className="flex items-baseline gap-1.5">
              <Quote size={10} className="text-ink-300 shrink-0 translate-y-[2px]" />
              <span className="text-2xs uppercase tracking-[0.07em] text-ink-400 font-medium">
                {t("guide.youWrote")}
              </span>
              <span className="text-2xs text-ink-300">— {t("guide.source")}</span>
            </div>
            <p
              lang="en"
              className="text-xs text-ink-800 italic mt-1 leading-relaxed max-w-[92ch]"
            >
              “{step.quote}”
            </p>
            <p className="text-2xs text-ink-600 mt-1.5 max-w-[92ch]">
              {done ? (
                <span className="text-pine-700 inline-flex items-start gap-1.5">
                  <Check size={11} className="shrink-0 translate-y-[2px]" />
                  {t(`guide.${step.key}.outcome`)}
                </span>
              ) : (
                t(`guide.${step.key}.instruction`)
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {step.scenario && !done && (
              <Button variant="primary" size="sm" onClick={showStep}>
                <Play size={11} />
                {t("guide.show")}
              </Button>
            )}
            {done && !last && (
              <Button variant="primary" size="sm" onClick={() => goToStep(guideStep + 1)}>
                {t("guide.next")}
                <ChevronRight size={11} />
              </Button>
            )}
            {!done && !step.scenario && (
              <Button variant="secondary" size="sm" onClick={showStep}>
                {locale === "fr" ? "Aller à l'écran" : "Go to the screen"}
                <ChevronRight size={11} />
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
