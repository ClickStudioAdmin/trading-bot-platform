import Link from "next/link";

export function SiteLogo({
  compact = false,
  linked = true,
  href = "/",
  name = "Trading Bot Platform",
  logoUrl = null,
}: {
  compact?: boolean;
  linked?: boolean;
  href?: string;
  name?: string;
  logoUrl?: string | null;
}) {
  const mark = (
    <>
      {logoUrl ? (
        // Public Storage mark from Admin Settings.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-8 w-auto max-w-[9rem] shrink-0 object-contain"
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-accent-strong">
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 text-ink"
            aria-hidden="true"
          >
            <path
              d="M4 13.5h5.5L12 6.5h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 13.5c2.2 0 3.3-2.4 5.5-2.4S12 6.5 16 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </span>
      )}
      {compact ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold tracking-tight">
            {name}
          </span>
          <span className="block text-[11px] text-ink-muted">
            Trading Bots
          </span>
        </span>
      )}
    </>
  );

  if (!linked) {
    return (
      <div className="flex min-w-0 shrink-0 items-center gap-2.5 text-ink">
        {mark}
      </div>
    );
  }

  return (
    <Link href={href} className="flex min-w-0 shrink-0 items-center gap-2.5 text-ink">
      {mark}
    </Link>
  );
}
