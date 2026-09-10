"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Pause, Play, Quote, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { BEATS, BEAT_QUOTES, FLORIDA, type TourActions } from "@/lib/tour";
import { Button } from "./ui";

/**
 * The guided walkthrough.
 *
 * The visitor consents, and then the tour drives: it presses the buttons, moves
 * between screens, and narrates what just happened. Pause hands control back at
 * any point, which is the only reason driving is safe — otherwise someone who
 * wants to poke at the console is stuck watching.
 *
 * There is deliberately no full-screen dim. It makes a tour feel like a nag and
 * hides the thing being pointed at; the anchor gets a ring instead and the
 * console stays live underneath.
 */

const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/* Who this demo was built for. Shown in the invitation, because a demo made
   for one person should say so. Change this if the demo is reused. */
const CLIENT_NAME = "Nick";

const GAP = 14;
const BUBBLE_W = 340;

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

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height));

export function Tour() {
  const store = useStore();
  const {
    tourConsent,
    tourStep,
    tourFacts,
    answerTour,
    setTourStep,
    endTour,
    t,
  } = store;

  const mounted = useSyncExternalStore(subscribeNothing, onClient, onServer);
  const [box, setBox] = useState<Box | null>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const beat = BEATS[tourStep];
  const active = tourConsent === "accepted" && Boolean(beat);
  const last = tourStep >= BEATS.length - 1;

  /* Actions and facts are read through refs so the driving effect does not
     re-run — and re-fire its action — every time the store re-renders. This
     effect has no dependency array on purpose: it refreshes the refs after
     every render, and being declared before the driver it always runs first. */
  const actionsRef = useRef<TourActions | null>(null);
  const factsRef = useRef(tourFacts);
  useEffect(() => {
    actionsRef.current = {
      reset: store.reset,
      setSpeed: store.setSpeed,
      setView: store.setView,
      armScript: store.armScript,
      armEscalationWindow: store.armEscalationWindow,
      trigger: () => store.trigger(),
      accept: store.accept,
      closeLead: store.closeLead,
      triggerUnroutable: store.triggerUnroutable,
      reassignFirstHeld: () => {
        const first = store.held[0];
        if (first) store.reassignHeld(first.lead.id);
      },
      openJurisdictionForm: store.setJurisdictionFormOpen,
      createFlorida: () => store.addJurisdiction(FLORIDA),
    };
    factsRef.current = tourFacts;
  });

  const advance = useCallback(() => {
    setTourStep(tourStep + 1);
  }, [setTourStep, tourStep]);

  /* --- The driver ------------------------------------------------------- */
  useEffect(() => {
    if (!active || paused || !beat) return;

    if (beat.view) actionsRef.current?.setView(beat.view);

    let acted = false;
    const timers: number[] = [];

    if (beat.act) {
      timers.push(
        window.setTimeout(() => {
          if (acted) return;
          acted = true;
          if (actionsRef.current) beat.act!(actionsRef.current);
        }, beat.actAfter ?? 0),
      );
    }

    const started = Date.now();
    const ceiling = beat.hold ?? 0;

    // One ticker drives both the progress bar and the advance condition, so a
    // beat can never stall: `until` ends it early, `hold` is the ceiling.
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      if (ceiling > 0) setProgress(Math.min(1, elapsed / ceiling));
      const conditionMet = beat.until?.(factsRef.current) ?? false;
      if (conditionMet || (ceiling > 0 && elapsed >= ceiling)) {
        window.clearInterval(tick);
        // A short beat lets the visitor see the result before moving on.
        timers.push(window.setTimeout(advance, conditionMet ? 1400 : 0));
      }
    }, 100);
    timers.push(tick);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(tick);
    };
    // store is intentionally excluded: actions are read through a ref so that
    // a re-render cannot restart the beat and fire its action twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, tourStep]);

  /* --- Anchor tracking --------------------------------------------------- */
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const next = beat.anchor ? readAnchor(beat.anchor) : null;
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    const first = requestAnimationFrame(measure);
    const id = window.setInterval(measure, 120);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(id);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, beat]);

  useEffect(() => {
    if (!active || !beat?.anchor) return;
    document
      .querySelector<HTMLElement>(`[data-tour="${beat.anchor}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, beat]);

  useEffect(() => {
    const asking = tourConsent === "unasked";
    if (!active && !asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (asking) answerTour("declined");
      else endTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, answerTour, endTour, tourConsent]);

  const restart = useCallback(() => {
    setPaused(false);
    setTourStep(0);
  }, [setTourStep]);

  if (!mounted) return null;

  /* --- The invitation ----------------------------------------------------
     Centred and on a backdrop, deliberately. This is the one thing the visitor
     has to answer, and a card in the corner is the easiest thing on a screen to
     ignore. Escape still dismisses it, but a backdrop click does not — both
     answers are one click away, so asking for one is not unreasonable. */
  if (tourConsent === "unasked") {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-invite-title"
        className="fixed inset-0 z-50 grid place-items-center p-5"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px] animate-backdrop-in"
        />

        <div className="relative w-full max-w-[460px] animate-modal-in">
          <div className="bg-white rounded-lg shadow-[0_24px_64px_rgba(9,9,11,0.22)] p-8">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-pine-600 grid place-items-center shrink-0">
                <span className="text-white text-micro font-bold tracking-tight">
                  LE
                </span>
              </div>
              <span className="text-small text-ink-400">{t("tour.builtFor")}</span>
            </div>

            <h2
              id="tour-invite-title"
              className="text-display text-ink-900 mt-5 tracking-[-0.02em]"
            >
              {t("tour.inviteTitle", { name: CLIENT_NAME })}
            </h2>
            <p className="text-body text-ink-600 mt-2.5 leading-relaxed">
              {t("tour.inviteBody")}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mt-7">
              <Button
                variant="primary"
                onClick={() => answerTour("accepted")}
                className="h-11 px-5 text-body"
              >
                {t("tour.inviteYes")}
                <ArrowRight size={15} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => answerTour("declined")}
                className="h-11 px-4 text-body"
              >
                {t("tour.inviteNo")}
              </Button>
            </div>

            <p className="text-small text-ink-400 mt-5">{t("tour.inviteMeta")}</p>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!active) return null;

  /* --- Placement --------------------------------------------------------- */
  let left: number;
  let top: number;
  let centred = false;

  if (box) {
    const roomRight = window.innerWidth - (box.left + box.width);
    const placeRight = roomRight > BUBBLE_W + GAP * 2;
    const placeLeft = !placeRight && box.left > BUBBLE_W + GAP * 2;
    if (placeRight) {
      left = box.left + box.width + GAP;
      top = box.top + box.height / 2 - 90;
    } else if (placeLeft) {
      left = box.left - BUBBLE_W - GAP;
      top = box.top + box.height / 2 - 90;
    } else {
      left = box.left + box.width / 2 - BUBBLE_W / 2;
      top = box.top + box.height + GAP;
    }
    left = Math.min(Math.max(GAP, left), window.innerWidth - BUBBLE_W - GAP);
    top = Math.min(Math.max(GAP, top), window.innerHeight - 230);
  } else {
    // No anchor for this beat — sit in the corner rather than nowhere.
    centred = true;
    left = window.innerWidth - BUBBLE_W - 20;
    top = window.innerHeight - 240;
  }

  const quote = BEAT_QUOTES[beat.key];

  return createPortal(
    <>
      {box && (
        <div
          aria-hidden
          className="fixed z-40 rounded-md pointer-events-none"
          style={{
            top: box.top - 5,
            left: box.left - 5,
            width: box.width + 10,
            height: box.height + 10,
            boxShadow:
              "0 0 0 2px var(--color-pine-500), 0 0 0 8px rgba(47,129,88,0.15)",
            transition: "all 320ms cubic-bezier(0.22,0.61,0.36,1)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-live="polite"
        className={centred ? "fixed z-50 animate-rise" : "fixed z-50"}
        style={{
          top,
          left,
          width: BUBBLE_W,
          transition: "top 320ms cubic-bezier(0.22,0.61,0.36,1), left 320ms cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        <div className="bg-white border border-[var(--hairline)] rounded-lg shadow-[0_10px_34px_rgba(9,9,11,0.16)] overflow-hidden">
          {/* Time remaining on this beat, so the pace is never a mystery */}
          <div className="h-0.5 bg-ink-100">
            <div
              className="h-full bg-pine-500"
              style={{ width: `${progress * 100}%`, transition: "width 120ms linear" }}
            />
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-micro text-ink-400 tabular">
                {t("tour.step", { n: tourStep + 1, total: BEATS.length })}
              </span>
              <div className="flex items-center gap-1">
                {!last && (
                  <button
                    onClick={() => setPaused((v) => !v)}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-sm text-micro text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors duration-150"
                  >
                    {paused ? <Play size={11} /> : <Pause size={11} />}
                    {paused ? t("tour.resume") : t("tour.pause")}
                  </button>
                )}
                <button
                  onClick={endTour}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-sm text-micro text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-colors duration-150"
                >
                  {t("tour.skip")}
                  <X size={11} />
                </button>
              </div>
            </div>

            {quote && (
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <Quote size={9} className="text-ink-300 shrink-0 translate-y-[2px]" />
                  <span className="text-micro text-ink-400">
                    {t("tour.youWrote")} — {t("tour.source")}
                  </span>
                </div>
                {/* His words, in the language he wrote them. */}
                <p lang="en" className="text-micro text-ink-600 italic mt-1 leading-relaxed">
                  “{quote}”
                </p>
              </div>
            )}

            <p className="text-small font-medium text-ink-900 mt-3">
              {t(`tour.${beat.key}.title`)}
            </p>
            <p className="text-small text-ink-500 mt-1 leading-relaxed">
              {t(`tour.${beat.key}.body`)}
            </p>

            {last && (
              <div className="flex items-center gap-2 mt-4">
                <Button variant="primary" size="sm" onClick={endTour}>
                  {t("tour.end")}
                </Button>
                <Button variant="ghost" size="sm" onClick={restart}>
                  {t("tour.again")}
                </Button>
              </div>
            )}

            {paused && !last && (
              <p className="text-micro text-warn-700 mt-3">{t("tour.pausedNote")}</p>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
