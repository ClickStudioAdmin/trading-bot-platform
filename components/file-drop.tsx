"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AppCheck } from "@/components/app-check";

const CHOOSE_BTN =
  "mt-3 inline-flex cursor-pointer rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";

export function FileDrop({
  name,
  accept,
  hint,
  label,
  preview = false,
  currentUrl = null,
  removeName,
  removeLabel = "Remove logo",
  emptyTone = "canvas",
  onFile,
}: {
  name?: string;
  accept: string;
  hint: string;
  label?: string;
  preview?: boolean;
  currentUrl?: string | null;
  removeName?: string;
  removeLabel?: string;
  emptyTone?: "canvas" | "raised";
  onFile?: (file: File | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blobRef = useRef<string | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);
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

  function take(file: File | undefined, fromInput = false) {
    if (!file) {
      if (inputRef.current && !fromInput) {
        inputRef.current.value = "";
      }
      replacePreview(null);
      setFileName(null);
      onFile?.(undefined);
      return;
    }
    if (!fromInput && inputRef.current) {
      const data = new DataTransfer();
      data.items.add(file);
      inputRef.current.files = data.files;
    }
    setRemove(false);
    setFileName(file.name);
    if (preview && file.type.startsWith("image/")) {
      replacePreview(URL.createObjectURL(file));
    } else {
      replacePreview(null);
    }
    onFile?.(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files[0]);
  }

  const shown = pickedUrl ?? (remove ? null : currentUrl);
  const emptyClass =
    emptyTone === "raised" ? "bg-surface-raised" : "bg-canvas";

  return (
    <div>
      {label ? <p className="text-sm text-ink">{label}</p> : null}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setOver(false);
        }}
        onDrop={onDrop}
        className={`mt-1 rounded-card border border-dashed px-4 py-6 text-center ${
          over ? "border-accent bg-accent/10" : "border-line-strong bg-canvas"
        }`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            {shown ? (
              // Local object URL or stored public mark.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-card border border-line object-contain"
              />
            ) : (
              <span
                className={`inline-flex size-14 shrink-0 items-center justify-center rounded-card border border-line text-[11px] text-ink-faint ${emptyClass}`}
              >
                None
              </span>
            )}
            <p className="text-sm text-ink">
              {fileName ?? "Drop a file here"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink">{fileName ?? "Drop a file here"}</p>
        )}
        <p className="mt-1 text-hint text-ink-muted">{hint}</p>
        <label className={CHOOSE_BTN}>
          Choose file
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              take(event.target.files?.[0], true);
              if (!name) {
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      {currentUrl && removeName ? (
        <label className="mt-2 flex items-center gap-2 text-sm text-ink">
          <AppCheck
            name={removeName}
            checked={remove}
            onChange={(event) => {
              const next = event.target.checked;
              setRemove(next);
              if (next) {
                take(undefined);
              }
            }}
            className=""
          />
          {removeLabel}
        </label>
      ) : null}
    </div>
  );
}
