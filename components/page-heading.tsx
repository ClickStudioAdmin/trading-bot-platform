export function PageHeading({
  overline,
  title,
  as = "h1",
}: {
  overline?: string;
  title: string;
  as?: "h1" | "h2";
}) {
  const Heading = as;
  return (
    <div className="mb-6">
      {overline ? (
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {overline}
        </p>
      ) : null}
      <Heading
        className={`font-semibold tracking-tight ${
          overline ? "mt-2" : ""
        } ${as === "h2" ? "text-xl" : "text-2xl"}`}
      >
        {title}
      </Heading>
    </div>
  );
}
