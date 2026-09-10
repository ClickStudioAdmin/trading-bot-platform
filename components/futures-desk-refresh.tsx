"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 8_000;
const URGENT_REFRESH_MS = 2_000;

export function FuturesDeskRefresh({ urgent = false }: { urgent?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    let timer = 0;

    function refresh() {
      if (document.hidden) {
        return;
      }
      router.refresh();
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    }

    function start() {
      stop();
      if (document.hidden) {
        return;
      }
      if (urgent) {
        refresh();
      }
      timer = window.setInterval(refresh, urgent ? URGENT_REFRESH_MS : REFRESH_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
        return;
      }
      refresh();
      start();
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, urgent]);

  return null;
}
