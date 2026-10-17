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
   that sits inside a fact cell and `lg` the one that stands as the headline of
   a receipt, like a guest code.

   It is for values somebody quotes back to us: order numbers, codes, service
   and reference numbers. Developer copies (an API key, the base URL, a code
   sample) and share links are edge cases with their own controls (Trip,
   17 Oct 2026). `display` shows something other than what is copied, such as
   "#301" for a service number that copies as "301". */
export function CopyChip({ value, label, onCopied, small = false, size, display }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (value == null || value === "") return null;
  const sz = size || (small ? "sm" : "md");
  const shown = display ?? value;
  const copy = async (e) => {
    e.stopPropagation();
    if (!(await copyText(String(value)))) return;
    setDone(true);
    onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className={"cpy" + (sz === "md" ? "" : ` ${sz}`) + (done ? " done" : "")} aria-label={`${label || tr("Copy")}: ${shown}`} title={done ? tr("Copied") : tr("Copy")}>
      <span>{shown}</span>
      <OffsetIcon name={done ? "checkCircle" : "copy"} size={sz === "sm" ? 12 : sz === "lg" ? 20 : 13} />
    </button>
  );
}
