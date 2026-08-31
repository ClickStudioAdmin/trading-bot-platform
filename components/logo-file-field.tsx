"use client";

import { useEffect, useRef, useState } from "react";

const fileClass =
  "w-full text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line";

export function LogoFileField({
  name,
  currentUrl = null,
  removeName,
  removeLabel = "Remove logo",
  hint,
  emptyTone = "canvas",
}: {
  name: string;
  currentUrl?: string | null;
  removeName?: string;
  removeLabel?: string;
  hint: string;
  emptyTone?: "canvas" | "raised";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blobRef = useRef<string | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  function replacePreview(next: string | null) {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
    }
    blobRef.current = next;
    setPickedUrl(next);
  }

  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
      }
    };
  }, []);

  const shown = pickedUrl ?? (remove ? null : currentUrl);
  const emptyClass =
    emptyTone === "raised" ? "bg-surface-raised" : "bg-canvas";

  return (
    <div>
      <div className="mt-1 flex items-center gap-3">
        {shown ? (
          // Local object URL or stored public mark.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-card border border-line object-cover"
          />
        ) : (
          <span
            className={`inline-flex size-14 shrink-0 items-center justify-center rounded-card border border-line text-[11px] text-ink-faint ${emptyClass}`}
          >
            None
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            className={fileClass}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file || !file.type.startsWith("image/")) {
                replacePreview(null);
                return;
              }
              setRemove(false);
              replacePreview(URL.createObjectURL(file));
            }}
          />
          <p className="mt-1 text-xs text-ink-faint">{hint}</p>
        </div>
      </div>
      {currentUrl && removeName ? (
        <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            name={removeName}
            checked={remove}
            onChange={(event) => {
              const next = event.target.checked;
              setRemove(next);
              if (next && inputRef.current) {
                inputRef.current.value = "";
                replacePreview(null);
              }
            }}
            className="mt-0.5"
          />
          {removeLabel}
        </label>
      ) : null}
    </div>
  );
}
