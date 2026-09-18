"use client";

import { FileDrop } from "@/components/file-drop";

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
  return (
    <FileDrop
      name={name}
      accept="image/png,image/jpeg,image/webp"
      hint={hint}
      preview
      currentUrl={currentUrl}
      removeName={removeName}
      removeLabel={removeLabel}
      emptyTone={emptyTone}
    />
  );
}
