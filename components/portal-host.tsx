"use client";

import { createContext, useContext, type ReactNode } from "react";

const ModalHostContext = createContext<HTMLElement | null>(null);

/** Replay fill-browser and full screen paint above the page. Menus inside this host stay on that layer. */
export function ModalHost({
  host,
  children,
}: {
  host: HTMLElement | null;
  children: ReactNode;
}) {
  return <ModalHostContext.Provider value={host}>{children}</ModalHostContext.Provider>;
}

export function useModalPortalHost(): HTMLElement | null {
  const host = useContext(ModalHostContext);
  if (typeof document === "undefined") {
    return host;
  }
  const fullscreen = document.fullscreenElement;
  if (fullscreen instanceof HTMLElement) {
    return fullscreen;
  }
  const webkit = (document as Document & { webkitFullscreenElement?: Element | null })
    .webkitFullscreenElement;
  if (webkit instanceof HTMLElement) {
    return webkit;
  }
  return host ?? document.body;
}
