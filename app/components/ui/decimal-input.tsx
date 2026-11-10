"use client";

import React, { useState } from "react";
import { parseDecimal } from "@/lib/decimal";

type DecimalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | "";
  onValue: (v: number | "") => void;
};

/** Text input for numbers that accepts "." or "," as decimal separator; reports finite numbers live. */
export function DecimalInput({ value, onValue, onBlur, ...props }: DecimalInputProps) {
  const [draft, setDraft] = useState(String(value));
  // Resync when the draft is a complete number the parent no longer holds (changed or clamped);
  // partial states ("5,", "-", "") stay untouched.
  const parsed = parseDecimal(draft);
  if (value !== "" && Number.isFinite(parsed) && parsed !== value) setDraft(String(value));
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next.trim() === "") onValue("");
        else {
          const n = parseDecimal(next);
          if (Number.isFinite(n)) onValue(n);
        }
      }}
      onBlur={(e) => {
        setDraft(String(value));
        onBlur?.(e);
      }}
    />
  );
}
