"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { revealAccountNav } from "@/components/account-sidenav";
import {
  completePlatformTour,
  setPlatformTourStep,
  skipPlatformTour,
} from "@/lib/onboarding/actions";
import {
  pickTourTarget,
  placeTourCard,
  type TourCardPlace,
  type TourStep,
} from "@/lib/onboarding/model";

const ACCOUNT_NAV_TARGETS = new Set(["overview", "manage-desks", "templates"]);
const CARD_ESTIMATE = { width: 352, height: 196 };

export function PlatformTour({
  steps,
  initialStep,
}: {
  steps: TourStep[];
  initialStep: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialStep, 0), Math.max(steps.length - 1, 0)),
  );
  const [spot, setSpot] = useState<{
    id: string;
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [cardSize, setCardSize] = useState(CARD_ESTIMATE);
  const [hidden, setHidden] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const box = spot && step && spot.id === step.id ? spot : null;

  useEffect(() => {
    if (!step) {
      return;
    }
    const current = `${pathname}${search.toString() ? `?${search.toString()}` : ""}`;
    if (!samePlace(step.href, current)) {
      router.push(step.href);
    }
  }, [pathname, router, search, step]);

  useEffect(() => {
    if (!step) {
      return;
    }
    let frame = 0;
    let tries = 0;
    const measure = () => {
      if (ACCOUNT_NAV_TARGETS.has(step.target)) {
        revealAccountNav();
      }
      const target = findTourTarget(step.target);
      const waitingForNav =
        ACCOUNT_NAV_TARGETS.has(step.target) && !target?.closest("aside");
      if ((!target || waitingForNav) && tries < 20) {
        tries += 1;
        frame = window.setTimeout(measure, 50);
        return;
      }
      if (!target) {
        setSpot(null);
        return;
      }
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const rect = target.getBoundingClientRect();
      setSpot({
        id: step.id,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    measure();
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [pathname, search, step]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const rect = card.getBoundingClientRect();
    setCardSize((current) => {
      if (
        Math.abs(current.width - rect.width) < 1 &&
        Math.abs(current.height - rect.height) < 1
      ) {
        return current;
      }
      return { width: rect.width, height: rect.height };
    });
  }, [box, index, step]);

  if (hidden || !step) {
    return null;
  }

  const place: TourCardPlace | null = box
    ? placeTourCard({
        target: box,
        card: cardSize,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
    : null;

  return (
    <div className="fixed inset-0 z-[100]">
      <TourDim box={box} />
      {place ? <TourArrow place={place} /> : null}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-tour-title"
        className="absolute z-10 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-4"
        style={
          place
            ? { top: place.top, left: place.left }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
          {index + 1} of {steps.length}
        </p>
        <h2 id="platform-tour-title" className="mt-1 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
        {box ? null : (
          <p className="mt-2 text-hint text-ink-faint">
            Look for {step.title} in the navigation.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {index > 0 ? (
            <button
              type="button"
              className="rounded-control px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              onClick={() => {
                const next = index - 1;
                setIndex(next);
                void setPlatformTourStep(next);
              }}
            >
              Back
            </button>
          ) : null}
          {index < steps.length - 1 ? (
            <button
              type="button"
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
              onClick={() => {
                const next = index + 1;
                setIndex(next);
                void setPlatformTourStep(next);
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
              onClick={() => {
                setHidden(true);
                void completePlatformTour();
              }}
            >
              Done
            </button>
          )}
          <button
            type="button"
            className="rounded-control px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            onClick={() => {
              setHidden(true);
              void skipPlatformTour();
            }}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

function TourDim({
  box,
}: {
  box: { top: number; left: number; width: number; height: number } | null;
}) {
  const hole = box
    ? {
        x: box.left - 6,
        y: box.top - 6,
        width: box.width + 12,
        height: box.height + 12,
      }
    : null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <mask id="platform-tour-dim">
          <rect width="100%" height="100%" fill="white" />
          {hole ? (
            <rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx="8"
              fill="black"
            />
          ) : null}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.62)"
        mask="url(#platform-tour-dim)"
      />
      {hole ? (
        <rect
          x={hole.x}
          y={hole.y}
          width={hole.width}
          height={hole.height}
          rx="8"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}

function TourArrow({ place }: { place: TourCardPlace }) {
  const pad = 28;
  const minX = Math.min(place.arrowFrom.x, place.arrowTo.x) - pad;
  const minY = Math.min(place.arrowFrom.y, place.arrowTo.y) - pad;
  const width = Math.abs(place.arrowFrom.x - place.arrowTo.x) + pad * 2;
  const height = Math.abs(place.arrowFrom.y - place.arrowTo.y) + pad * 2;
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed overflow-visible"
      style={{ left: minX, top: minY, width, height }}
    >
      <defs>
        <marker
          id="platform-tour-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--color-accent)" />
        </marker>
      </defs>
      <line
        x1={place.arrowFrom.x - minX}
        y1={place.arrowFrom.y - minY}
        x2={place.arrowTo.x - minX}
        y2={place.arrowTo.y - minY}
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        markerEnd="url(#platform-tour-arrow)"
      />
    </svg>
  );
}

function findTourTarget(id: string): HTMLElement | null {
  const nodes = [
    ...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`),
  ].flatMap((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 8 || rect.height <= 8) {
      return [];
    }
    return [
      {
        node,
        area: rect.width * rect.height,
        inAside: Boolean(node.closest("aside")),
      },
    ];
  });
  return pickTourTarget(nodes)?.node ?? null;
}

function samePlace(href: string, current: string): boolean {
  const expected = new URL(href, "http://local");
  const actual = new URL(current, "http://local");
  if (expected.pathname !== actual.pathname) {
    return false;
  }
  for (const [key, value] of expected.searchParams) {
    if (actual.searchParams.get(key) !== value) {
      return false;
    }
  }
  return true;
}
