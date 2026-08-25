import type { FuturesSide } from "./model";
import { asPositiveNumber } from "./model";
import { priceForPerp } from "@/lib/exchanges/bybit/perp";
import type { BybitInstrument } from "@/lib/exchanges/bybit/universe";

export type FuturesTrailing = {
  distance: number;
  activePrice: number | null;
  peak: number | null;
};

export function parseFuturesTrailingForm(
  form: FormData,
  instrument: BybitInstrument | undefined,
): { ok: true; trailing: FuturesTrailing | null } | { ok: false; error: string } {
  const enabled =
    form.get("trailing") === "on" ||
    form.get("trailing") === "true" ||
    form.has("trailingEnabled");
  if (!enabled) {
    return { ok: true, trailing: null };
  }
  return readTrailingFromForm(form, instrument, true);
}

export function parseFuturesTrailingPatch(
  form: FormData,
  instrument: BybitInstrument | undefined,
): { ok: true; trailing: FuturesTrailing | null } | { ok: false; error: string } {
  const distanceRaw = String(form.get("trailingStop") ?? "").replace(/,/g, "").trim();
  if (distanceRaw === "") {
    return { ok: true, trailing: null };
  }
  return readTrailingFromForm(form, instrument, false);
}

function readTrailingFromForm(
  form: FormData,
  instrument: BybitInstrument | undefined,
  requireDistance: boolean,
): { ok: true; trailing: FuturesTrailing } | { ok: false; error: string } {
  const distanceRaw = parseOptionalPositive(
    form.get("trailingStop"),
    "retracement",
  );
  if (!distanceRaw.ok) {
    return distanceRaw;
  }
  if (requireDistance && distanceRaw.value === null) {
    return { ok: false, error: "Enter a trailing retracement." };
  }
  if (distanceRaw.value === null) {
    return { ok: false, error: "Enter a trailing retracement." };
  }
  const priced = priceForPerp(distanceRaw.value, instrument);
  if (!priced.ok) {
    return priced;
  }
  const activationOn =
    form.get("trailingActivation") === "on" ||
    form.get("trailingActivation") === "true";
  let activePrice: number | null = null;
  if (activationOn) {
    const activeRaw = parseOptionalPositive(
      form.get("trailingActive"),
      "activation price",
    );
    if (!activeRaw.ok) {
      return activeRaw;
    }
    if (activeRaw.value === null) {
      return { ok: false, error: "Enter an activation price." };
    }
    const activePriced = priceForPerp(activeRaw.value, instrument);
    if (!activePriced.ok) {
      return activePriced;
    }
    activePrice = activePriced.price;
  }
  return {
    ok: true,
    trailing: {
      distance: priced.price,
      activePrice,
      peak: null,
    },
  };
}

function parseOptionalPositive(
  raw: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, value: null };
  }
  const value = asPositiveNumber(text);
  if (value === null) {
    return { ok: false, error: `Enter a positive ${label}.` };
  }
  return { ok: true, value };
}

export function validateTrailingVsReference(input: {
  side: FuturesSide;
  trailing: FuturesTrailing;
  reference: number;
}): { ok: true } | { ok: false; error: string } {
  if (!(input.reference > 0)) {
    return { ok: false, error: "Need a mark or last to check the trailing stop." };
  }
  if (input.trailing.activePrice === null) {
    return { ok: true };
  }
  const ok =
    input.side === "long"
      ? input.trailing.activePrice > input.reference
      : input.trailing.activePrice < input.reference;
  if (!ok) {
    return {
      ok: false,
      error:
        input.side === "long"
          ? "Activation price must be above the current price."
          : "Activation price must be below the current price.",
    };
  }
  return { ok: true };
}

export function paperTrailingAdvance(input: {
  side: FuturesSide;
  trailing: FuturesTrailing;
  last: number;
}): { peak: number | null; hit: boolean; fillPrice: number | null } {
  if (!(input.last > 0) || !(input.trailing.distance > 0)) {
    return { peak: input.trailing.peak, hit: false, fillPrice: null };
  }
  let peak = input.trailing.peak;
  if (peak === null) {
    const armed =
      input.trailing.activePrice === null
        ? true
        : input.side === "long"
          ? input.last >= input.trailing.activePrice
          : input.last <= input.trailing.activePrice;
    if (!armed) {
      return { peak: null, hit: false, fillPrice: null };
    }
    peak = input.last;
  } else {
    peak =
      input.side === "long"
        ? Math.max(peak, input.last)
        : Math.min(peak, input.last);
  }
  const trigger =
    input.side === "long"
      ? peak - input.trailing.distance
      : peak + input.trailing.distance;
  const hit =
    input.side === "long" ? input.last <= trigger : input.last >= trigger;
  return {
    peak,
    hit,
    fillPrice: hit ? trigger : null,
  };
}

export function trailingColumns(trailing: FuturesTrailing | null | undefined) {
  if (!trailing || !(trailing.distance > 0)) {
    return {
      trailing_stop: null,
      trailing_active: null,
      trailing_peak: null,
    };
  }
  return {
    trailing_stop: trailing.distance,
    trailing_active: trailing.activePrice,
    trailing_peak: trailing.peak,
  };
}

export function trailingWorkingColumns(
  trailing: FuturesTrailing | null | undefined,
) {
  if (!trailing || !(trailing.distance > 0)) {
    return {
      trailing_stop: null,
      trailing_active: null,
    };
  }
  return {
    trailing_stop: trailing.distance,
    trailing_active: trailing.activePrice,
  };
}

export function trailingFromRow(row: {
  trailingStop: number | null;
  trailingActive: number | null;
  trailingPeak?: number | null;
}): FuturesTrailing | null {
  if (row.trailingStop === null || !(row.trailingStop > 0)) {
    return null;
  }
  return {
    distance: row.trailingStop,
    activePrice: row.trailingActive,
    peak: row.trailingPeak ?? null,
  };
}

export function trailingHasStop(
  trailing: FuturesTrailing | null | undefined,
): boolean {
  return Boolean(trailing && trailing.distance > 0);
}

export function armTrailingAt(
  trailing: FuturesTrailing | null | undefined,
  price: number,
): FuturesTrailing | null {
  if (!trailing || !(trailing.distance > 0)) {
    return null;
  }
  if (trailing.activePrice === null && price > 0) {
    return { ...trailing, peak: price };
  }
  return trailing;
}
