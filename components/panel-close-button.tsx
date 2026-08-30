export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="size-3.5"
      >
        <path
          d="M4 4l8 8M12 4l-8 8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
