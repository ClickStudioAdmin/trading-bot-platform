import { ColumnHint } from "@/components/column-hint";

export function PendingStatusChip({
  label,
  hint,
}: {
  label: "Closing" | "Cancelling";
  hint: string;
}) {
  return (
    <ColumnHint
      hint={hint}
      label={
        <span className="inline-flex items-center justify-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
          {label}
        </span>
      }
    />
  );
}
