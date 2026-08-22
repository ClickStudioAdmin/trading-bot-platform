export function PageHeading({
  overline,
  title,
}: {
  overline: string;
  title: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        {overline}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}
