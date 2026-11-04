"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import a from "./admin.module.css";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className ?? `${a.btn} ${a.btnSm}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={15} />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
