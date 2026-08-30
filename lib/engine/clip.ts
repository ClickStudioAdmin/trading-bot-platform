export function unwindClipUsdt(
  remainingUsdt: number,
  bookUsdt: number,
  minSizeUsdt: number | null = null,
): number | null {
  if (!(remainingUsdt > 0) || !Number.isFinite(remainingUsdt)) {
    return null;
  }
  if (minSizeUsdt !== null && remainingUsdt <= minSizeUsdt) {
    return remainingUsdt;
  }
  if (!(bookUsdt > 0) || !Number.isFinite(bookUsdt)) {
    return null;
  }
  const clip = Math.min(remainingUsdt, bookUsdt);
  if (!(clip > 0)) {
    return null;
  }
  if (minSizeUsdt !== null && clip < minSizeUsdt) {
    return null;
  }
  return clip;
}
