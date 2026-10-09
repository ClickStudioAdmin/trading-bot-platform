const BACKTEST_FAILURE_MAX = 180;

/** Short reason safe to store on the run and show in the variant list. */
export function backtestFailureMessage(cause: unknown): string {
  const raw =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";
  const line = (raw.split(/[\r\n]/, 1)[0] ?? "").replace(/\s+/g, " ").trim();
  if (!line) {
    return "Replay failed.";
  }
  if (line.length <= BACKTEST_FAILURE_MAX) {
    return line;
  }
  return `${line.slice(0, BACKTEST_FAILURE_MAX - 1)}…`;
}
