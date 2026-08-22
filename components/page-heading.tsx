export function PageHeading({
  overline,
  title,
  as = "h1",
}: {
  overline?: string;
  title: string;
  as?: "h1" | "h2";
}) {
  const className = `font-semibold tracking-tight ${
    overline ? "mt-2" : ""
  } ${as === "h2" ? "text-xl" : "text-2xl"}`;

  return (
    <div className="mb-6">
      {overline ? (
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {overline}
        </p>
      ) : null}
      {as === "h2" ? (
        <h2 className={className}>{title}</h2>
      ) : (
        <h1 className={className}>{title}</h1>
      )}
    </div>
  );
}
