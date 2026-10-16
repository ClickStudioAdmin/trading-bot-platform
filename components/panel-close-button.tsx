import { IconClose } from "@/components/icons";

export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <IconClose size={14} className="size-3.5" />
    </button>
  );
}

/**
 * First-line spacer for copy that sits beside `PanelCloseButton`.
 * `panel` matches an anchored confirm (`p-3`). `modal` matches a dialog title (`p-5`).
 */
export function PanelCloseReserve({
  size = "panel",
}: {
  size?: "panel" | "modal";
}) {
  return (
    <span
      aria-hidden
      className={
        size === "modal"
          ? "float-right ml-2 h-4 w-4"
          : "float-right ml-2 h-5 w-6"
      }
    />
  );
}
