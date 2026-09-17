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
