'use client';
import { useEffect, useRef, useState } from "react";
import { useT } from "./locale";
import { copyText } from "@/lib/clipboard";
import { OffsetIcon } from "./offset-icons";

/* The standard copy button (approved 17 Oct 2026, the receipt's order number):
   the value itself in mono on a quiet bordered chip with the copy mark after
   it, so it reads as something to tap, and a green tick for a moment once it is
   on the clipboard. History used a bare value with a faint icon that did not
   look like a button at all. Styles are .cpy in globals.css; `sm` is the size
   that sits inside a fact cell. */
export function CopyChip({ value, label, onCopied, small = false }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (value == null || value === "") return null;
  const copy = async (e) => {
    e.stopPropagation();
    if (!(await copyText(String(value)))) return;
    setDone(true);
    onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className={"cpy" + (small ? " sm" : "") + (done ? " done" : "")} aria-label={`${label || tr("Copy")}: ${value}`} title={done ? tr("Copied") : tr("Copy")}>
      <span>{value}</span>
      <OffsetIcon name={done ? "checkCircle" : "copy"} size={small ? 12 : 13} />
    </button>
  );
}
