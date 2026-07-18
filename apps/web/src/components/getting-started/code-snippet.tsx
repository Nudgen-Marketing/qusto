"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeSnippet({
  code,
  label,
  language
}: {
  readonly code: string;
  readonly label: string;
  readonly language: string;
}) {
  const [status, setStatus] = useState<"Copied" | "Copy failed">();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("Copied");
    } catch {
      setStatus("Copy failed");
    }
  }

  return (
    <div className="code-snippet">
      <div className="code-snippet-toolbar">
        <span>{language}</span>
        <button aria-label={label} onClick={() => void copy()} type="button">
          {status === "Copied" ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {status === "Copied"
            ? "Copied"
            : status === "Copy failed"
              ? "Retry copy"
              : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
      {status === undefined ? null : (
        <span className="visually-hidden" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
