"use client";

import { useState } from "react";
import { Link, Check } from "lucide-react";

export default function CopyStudentLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const url = `${window.location.origin}/student/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copy}
      title="Скопировать ссылку для ученика"
      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium border transition-all hover:opacity-80"
      style={{
        borderColor: copied ? "#20a040" : "var(--brown-pale)",
        color:       copied ? "#20a040" : "var(--brown-mid)",
        background:  copied ? "#f0fff4" : "transparent",
      }}
    >
      {copied ? <Check size={14}/> : <Link size={14}/>}
      {copied ? "Скопировано!" : "Скопировать ссылку"}
    </button>
  );
}
