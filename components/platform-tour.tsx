"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  completePlatformTour,
  setPlatformTourStep,
  skipPlatformTour,
} from "@/lib/onboarding/actions";
import type { TourStep } from "@/lib/onboarding/model";

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
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [hidden, setHidden] = useState(false);
  const step = steps[index];

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
      const target = findTourTarget(step.target);
      if (!target && tries < 20) {
        tries += 1;
        frame = window.setTimeout(measure, 50);
        return;
      }
      if (!target) {
        setBox(null);
        return;
      }
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const rect = target.getBoundingClientRect();
      setBox({
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

  if (hidden || !step) {
    return null;
  }

  const cardStyle = box
    ? {
        top: Math.min(box.top + box.height + 12, window.innerHeight - 220),
        left: Math.min(Math.max(16, box.left), window.innerWidth - 340),
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <div className="fixed inset-0 z-[70]">
      {box ? (
        <div
          className="pointer-events-none fixed rounded-card ring-2 ring-accent"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-tour-title"
        className="absolute w-[min(22rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-4"
        style={cardStyle}
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

function findTourTarget(id: string): HTMLElement | null {
  const nodes = [
    ...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`),
  ];
  return (
    nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    }) ?? null
  );
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
