"use client";

import React, { useState } from "react";
import { parseDecimal } from "@/lib/decimal";

type DecimalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | "";
  onValue: (v: number | "") => void;
};

/**
 * Draft state of a decimal text field that accepts "." or "," as separator: reports finite numbers live,
 * keeps partial states ("5,", "-", "") and resyncs when the parent changes or clamps the value.
 * Spread the result on any text input (plain <input> or the styled ui/Input).
 */
export function useDecimalDraft(value: number | "", onValue: (v: number | "") => void) {
  const [draft, setDraft] = useState(String(value));
  const parsed = parseDecimal(draft);
  if (value !== "" && Number.isFinite(parsed) && parsed !== value) setDraft(String(value));
  return {
    type: "text" as const,
    inputMode: "decimal" as const,
    autoComplete: "off",
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraft(next);
      if (next.trim() === "") onValue("");
      else {
        const n = parseDecimal(next);
        if (Number.isFinite(n)) onValue(n);
      }
    },
    onBlur: () => setDraft(String(value)),
  };
}

/** Text input for numbers that accepts "." or "," as decimal separator; reports finite numbers live. */
export function DecimalInput({ value, onValue, onBlur, ...props }: DecimalInputProps) {
  const draft = useDecimalDraft(value, onValue);
  return (
    <input
      {...props}
      {...draft}
      onBlur={(e) => {
        draft.onBlur();
        onBlur?.(e);
      }}
    />
  );
}
