"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  size?: "sm" | "lg";
  onCopied?: () => void;
};

export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className = "", size = "sm", onCopied }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for insecure contexts / older WebViews.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    onCopied?.();
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }, [text, onCopied]);

  const pad = size === "lg" ? "px-5 py-3 text-base" : "px-3 py-1.5 text-sm";
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.97] ${pad} ${className}`}
      data-copied={copied ? "true" : "false"}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
