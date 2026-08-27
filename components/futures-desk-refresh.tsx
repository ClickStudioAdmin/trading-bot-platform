"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 8_000;

export function FuturesDeskRefresh() {
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
      timer = window.setInterval(refresh, REFRESH_MS);
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
  }, [router]);

  return null;
}
