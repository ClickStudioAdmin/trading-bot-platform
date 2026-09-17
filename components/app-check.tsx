"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { IconCheck } from "@/components/icons";

const BOX =
  "flex size-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface-raised text-canvas peer-checked:border-accent peer-checked:bg-accent peer-checked:[&_svg]:opacity-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-40";

const RADIO =
  "flex size-5 items-center justify-center rounded-full border border-line-strong bg-surface-raised peer-checked:border-accent peer-checked:[&_span]:opacity-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-40";

export function AppCheck({
  name,
  value,
  checked,
  defaultChecked,
  disabled,
  onChange,
  indeterminate = false,
  className = "mt-0.5",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string | number;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <span className={`inline-flex shrink-0 ${className}`.trim()}>
      <input
        ref={ref}
        type="checkbox"
        name={name}
        value={value != null ? String(value) : undefined}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span aria-hidden className={BOX}>
        <IconCheck size={12} className="size-3 opacity-0" />
      </span>
    </span>
  );
}

export function AppRadio({
  name,
  value,
  checked,
  defaultChecked,
  disabled,
  onChange,
  className = "mt-0.5",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  "aria-label"?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "name" | "value">) {
  return (
    <span className={`inline-flex shrink-0 ${className}`.trim()}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span aria-hidden className={RADIO}>
        <span className="size-2 rounded-full bg-accent opacity-0" />
      </span>
    </span>
  );
}
