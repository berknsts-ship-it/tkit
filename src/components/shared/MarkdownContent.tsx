"use client";
import React from "react";

function inlineFormat(text: string): React.ReactNode {
  const re = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g;
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} style={{ background: "#f0ece4", padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", fontFamily: "monospace" }}>
              {part.slice(1, -1)}
            </code>
          );
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export default function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Empty line
    if (!trimmed) { i++; continue; }

    // Headings
    const hm = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      const cls = level === 1
        ? "text-base font-bold mt-4 mb-1.5"
        : level === 2
        ? "text-sm font-bold mt-3 mb-1"
        : "text-sm font-semibold mt-2 mb-0.5";
      nodes.push(
        <div key={i} className={cls} style={{ color: "var(--brown-dark)" }}>
          {inlineFormat(hm[2])}
        </div>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      nodes.push(<hr key={i} className="my-3" style={{ borderColor: "var(--brown-pale)" }} />);
      i++; continue;
    }

    // Table: consecutive lines starting with |
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parseRow = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
      const isSep = (l: string) => /^\|[\s\-|:]+\|$/.test(l);

      if (tableLines.length >= 2 && isSep(tableLines[1])) {
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        nodes.push(
          <div key={i} className="overflow-x-auto my-3 rounded-xl border" style={{ borderColor: "var(--brown-pale)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--brown-pale)" }}>
                  {headers.map((h, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--brown-dark)", borderBottom: "1px solid var(--brown-pale)" }}>
                      {inlineFormat(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "white" : "#fdf8f0" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2" style={{ color: "var(--brown-mid)", borderTop: ri > 0 ? "1px solid var(--brown-pale)" : undefined }}>
                        {inlineFormat(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      } else {
        tableLines.forEach((l, li) => {
          nodes.push(<p key={`${i}-${li}`} className="my-1" style={{ color: "var(--brown-mid)" }}>{inlineFormat(l)}</p>);
        });
      }
      continue;
    }

    // Bullet list
    if (/^[-*+] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+] /, ""));
        i++;
      }
      nodes.push(
        <ul key={i} className="list-disc pl-5 my-1.5 space-y-0.5" style={{ color: "var(--brown-mid)" }}>
          {items.map((it, j) => <li key={j}>{inlineFormat(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={i} className="list-decimal pl-5 my-1.5 space-y-0.5" style={{ color: "var(--brown-mid)" }}>
          {items.map((it, j) => <li key={j}>{inlineFormat(it)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraph: accumulate lines until a structural element
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || /^#{1,3} /.test(t) || t.startsWith("|") || /^[-*+] /.test(t) || /^\d+\. /.test(t) || /^---+$/.test(t)) break;
      paraLines.push(t);
      i++;
    }
    if (paraLines.length) {
      nodes.push(
        <p key={i} className="my-1.5 leading-relaxed" style={{ color: "var(--brown-mid)" }}>
          {inlineFormat(paraLines.join(" "))}
        </p>
      );
    }
  }

  return <div className="text-sm">{nodes}</div>;
}
