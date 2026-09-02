"use client";

import { useEffect } from "react";

export function HashScroll() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) {
      return;
    }
    function go() {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }
    go();
    const timer = window.setTimeout(go, 80);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
