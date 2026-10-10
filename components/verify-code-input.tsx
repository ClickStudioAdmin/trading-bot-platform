"use client";

import { useState } from "react";
import { clampVerifyCodeDigits } from "@/lib/auth/verify-code-digits";

export function VerifyCodeInput({ className }: { className: string }) {
  const [code, setCode] = useState("");

  return (
    <input
      id="code"
      name="code"
      value={code}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      autoFocus
      required
      maxLength={6}
      className={className}
      onChange={(event) => setCode(clampVerifyCodeDigits(event.target.value))}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text");
        const el = event.currentTarget;
        const start = el.selectionStart ?? code.length;
        const end = el.selectionEnd ?? start;
        const proposed = code.slice(0, start) + text + code.slice(end);
        setCode(clampVerifyCodeDigits(proposed));
      }}
    />
  );
}
