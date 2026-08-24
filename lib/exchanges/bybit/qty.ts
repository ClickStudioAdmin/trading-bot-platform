export function stepDecimals(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) {
    return 0;
  }
  const text = step.toString();
  if (text.includes("e-")) {
    return Number(text.split("e-")[1] ?? "0");
  }
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function floorToStep(qty: number, step: number): number {
  if (!(qty > 0) || !(step > 0) || !Number.isFinite(qty) || !Number.isFinite(step)) {
    return 0;
  }
  const units = Math.floor((qty + 1e-12) / step);
  return Number((units * step).toFixed(stepDecimals(step)));
}

export function parseStep(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? "");
  return value > 0 && Number.isFinite(value) ? value : fallback;
}

export function qtyFromNotionalUsdt(input: {
  notionalUsdt: number;
  price: number;
  step: number;
  minQty: number;
}): { ok: true; qty: number; text: string } | { ok: false; error: string } {
  if (!(input.notionalUsdt > 0) || !(input.price > 0)) {
    return { ok: false, error: "Size and price must be positive." };
  }
  if (!(input.step > 0) || !(input.minQty > 0)) {
    return { ok: false, error: "That instrument has no order size step." };
  }
  const raw = input.notionalUsdt / input.price;
  const qty = floorToStep(raw, input.step);
  if (qty < input.minQty) {
    return {
      ok: false,
      error: "That size is below the exchange minimum order quantity.",
    };
  }
  return {
    ok: true,
    qty,
    text: qty.toFixed(stepDecimals(input.step)),
  };
}

export function maxStep(left: number, right: number): number {
  return left > right ? left : right;
}
