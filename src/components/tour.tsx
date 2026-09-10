"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Quote, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROUTE_SCRIPT, TOUR_STEPS } from "@/lib/tour";
import { Button } from "./ui";

/**
 * Anchored walkthrough.
 *
 * The bubble attaches itself to a real control rather than describing one that
 * lives somewhere else on screen — that indirection is what made the previous
 * docked guide confusing.
 *
 * There is deliberately no full-screen dim: it makes a tour feel like a nag and
 * it obscures the very thing being pointed at. The anchor gets a ring, and the
 * rest of the console stays usable.
 */

/* Portals need document.body, which does not exist during the server render.
   useSyncExternalStore is the sanctioned way to ask "am I on the client?" —
   it gives the server a different snapshot without a hydration mismatch and
   without setting state from inside an effect. */
const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

const GAP = 12;
const BUBBLE_W = 320;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readAnchor(name: string): Box | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour() {
  const {
    tourConsent,
    tourStep,
    tourDone,
    answerTour,
    setTourStep,
    endTour,
    armScript,
    setSpeed,
    t,
  } = useStore();

  const mounted = useSyncExternalStore(subscribeNothing, onClient, onServer);
  const [box, setBox] = useState<Box | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const step = TOUR_STEPS[tourStep];
  const active = tourConsent === "accepted" && Boolean(step);
  const done = active ? tourDone[tourStep] : false;

  /* Track the anchor.
     Conditional controls appear and vanish as the lead moves through its life,
     so this re-reads on scroll, on resize, and on a modest interval to catch
     an element that has just been rendered. State is only written when the
     measurement actually changed — measuring every animation frame and setting
     state each time would re-render the whole console sixty times a second. */
  useEffect(() => {
    if (!active) return;

    const sameBox = (a: Box | null, b: Box | null) =>
      a === b ||
      (a !== null &&
        b !== null &&
        Math.round(a.top) === Math.round(b.top) &&
        Math.round(a.left) === Math.round(b.left) &&
        Math.round(a.width) === Math.round(b.width) &&
        Math.round(a.height) === Math.round(b.height));

    const measure = () => {
      const primary = readAnchor(step.anchor);
      const next = primary ?? (step.fallbackAnchor ? readAnchor(step.fallbackAnchor) : null);
      const fallback = !primary && next !== null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
      setUsingFallback((prev) => (prev === fallback ? prev : fallback));
    };

    const first = requestAnimationFrame(measure);
    const id = window.setInterval(measure, 200);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(id);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, step]);

  /* A step that promises the broker will stay silent has to arm the script
     before the visitor presses the button — they press it, but the outcome is
     not left to a dice roll. The SLA is compressed too, so "watch and wait"
     costs six seconds rather than a full minute. */
  useEffect(() => {
    if (!active || !step.scripted || done) return;
    armScript(ROUTE_SCRIPT);
    setSpeed(10);
  }, [active, armScript, done, setSpeed, step]);

  /* Bring the anchor into view when a step opens. */
  useEffect(() => {
    if (!active) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, endTour]);

  const advance = useCallback(() => {
    if (tourStep >= TOUR_STEPS.length - 1) endTour();
    else setTourStep(tourStep + 1);
  }, [endTour, setTourStep, tourStep]);

  if (!mounted) return null;

  /* --- The invitation ---------------------------------------------------- */
  if (tourConsent === "unasked") {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-50 w-[330px] max-w-[calc(100vw-2.5rem)] animate-rise">
        <div className="bg-white border border-[var(--hairline)] rounded-lg shadow-[0_8px_28px_rgba(9,9,11,0.12)] p-5">
          <p className="text-title font-medium text-ink-900">
            {t("tour.inviteTitle")}
          </p>
          <p className="text-small text-ink-500 mt-1.5 leading-relaxed">
            {t("tour.inviteBody")}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Button variant="primary" onClick={() => answerTour("accepted")}>
              {t("tour.inviteYes")}
              <ArrowRight size={13} />
            </Button>
            <Button variant="ghost" onClick={() => answerTour("declined")}>
              {t("tour.inviteNo")}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!active || !box) return null;

  /* --- Placement --------------------------------------------------------- */
  const roomRight = window.innerWidth - (box.left + box.width);
  const placeRight = roomRight > BUBBLE_W + GAP * 2;
  const placeLeft = !placeRight && box.left > BUBBLE_W + GAP * 2;

  let left = box.left + box.width / 2 - BUBBLE_W / 2;
  let top = box.top + box.height + GAP;
  if (placeRight) {
    left = box.left + box.width + GAP;
    top = box.top + box.height / 2 - 70;
  } else if (placeLeft) {
    left = box.left - BUBBLE_W - GAP;
    top = box.top + box.height / 2 - 70;
  }
  // Never let the bubble leave the viewport.
  left = Math.min(Math.max(GAP, left), window.innerWidth - BUBBLE_W - GAP);
  top = Math.min(Math.max(GAP, top), window.innerHeight - 210);

  return createPortal(
    <>
      {/* Ring on the anchor. Pointer-events off so the control stays clickable. */}
      <div
        aria-hidden
        className="fixed z-40 rounded-md pointer-events-none transition-all duration-200"
        style={{
          top: box.top - 5,
          left: box.left - 5,
          width: box.width + 10,
          height: box.height + 10,
          boxShadow:
            "0 0 0 2px var(--color-pine-500), 0 0 0 7px rgba(47,129,88,0.16)",
        }}
      />

      <div
        role="dialog"
        aria-live="polite"
        className="fixed z-50 animate-rise"
        style={{ top, left, width: BUBBLE_W }}
      >
        <div className="bg-white border border-[var(--hairline)] rounded-lg shadow-[0_8px_28px_rgba(9,9,11,0.14)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-micro text-ink-400 tabular">
              {t("tour.step", { n: tourStep + 1, total: TOUR_STEPS.length })}
            </span>
            <button
              onClick={endTour}
              className="inline-flex items-center gap-1 text-micro text-ink-400 hover:text-ink-900 transition-colors duration-150"
            >
              {t("tour.skip")}
              <X size={11} />
            </button>
          </div>

          {step.quote && (
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1.5">
                <Quote size={9} className="text-ink-300 shrink-0 translate-y-[2px]" />
                <span className="text-micro text-ink-400">
                  {t("tour.youWrote")} — {t("tour.source")}
                </span>
              </div>
              {/* His words, in the language he wrote them. */}
              <p lang="en" className="text-micro text-ink-600 italic mt-1 leading-relaxed">
                “{step.quote}”
              </p>
            </div>
          )}

          <p className="text-small font-medium text-ink-900 mt-3">
            {t(`tour.${step.key}.title`)}
          </p>
          <p className="text-small text-ink-500 mt-1 leading-relaxed">
            {usingFallback ? t("tour.goThere") : t(`tour.${step.key}.body`)}
          </p>

          {done && (
            <div className="flex items-center justify-end mt-3.5">
              <Button variant="primary" size="sm" onClick={advance}>
                <Check size={12} />
                {tourStep === TOUR_STEPS.length - 1
                  ? t("tour.end")
                  : t("tour.next")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
