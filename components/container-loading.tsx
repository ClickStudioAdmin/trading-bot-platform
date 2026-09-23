import { IconLoader } from "@/components/icons";

export function ContainerLoading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
      <IconLoader className="size-4 shrink-0 animate-spin" />
      {label}
    </p>
  );
}
