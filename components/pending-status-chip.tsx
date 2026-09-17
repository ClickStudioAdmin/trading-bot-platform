import { ColumnHint } from "@/components/column-hint";
import { StatusBadge } from "@/components/table-chrome";

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
      label={<StatusBadge label={label} tone="warning" />}
    />
  );
}
