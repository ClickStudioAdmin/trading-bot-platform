"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useThemePreviewPortalClass } from "@/components/theme-scheme-preview";

export function AnchoredPanel({
  open,
  onClose,
  buttonRef,
  width = 320,
  className = "p-3",
  children,
}: {
  open: boolean;
  onClose: () => void;
  buttonRef: RefObject<HTMLElement | null>;
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const previewClass = useThemePreviewPortalClass();
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const button = buttonRef.current;
      if (!button) {
        return;
      }
      const rect = button.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 280;
      const left = Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      );
      const below = rect.bottom + 8;
      const top =
        below + height > window.innerHeight - 8
          ? Math.max(8, rect.top - height - 8)
          : below;
      setCoords({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [buttonRef, open, width]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [buttonRef, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-50 overflow-hidden whitespace-normal rounded-card border border-line bg-surface text-ink ${previewClass}`.trim()}
      style={{ top: coords.top, left: coords.left, width }}
    >
      <div className={`relative ${className}`.trim()}>{children}</div>
    </div>,
    document.body,
  );
}
