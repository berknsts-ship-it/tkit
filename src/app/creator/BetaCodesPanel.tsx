"use client";

import { useState } from "react";
import { generateBetaCodes, deleteBetaCode } from "@/app/actions/beta";

interface BetaCode {
  code: string;
  note: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  tutors?: { name: string | null; email: string } | null;
}

export default function BetaCodesPanel({ initial }: { initial: BetaCode[] }) {
  const [codes,   setCodes]   = useState<BetaCode[]>(initial);
  const [count,   setCount]   = useState(5);
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState<string | null>(null);

  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setGenError(null);
    const result = await generateBetaCodes(count, note || undefined);
    if ("error" in result) {
      setGenError((result as { error: string }).error);
    } else {
      const newCodes: BetaCode[] = result.codes.map(c => ({
        code: c, note: note || null, used_by: null, used_at: null,
        created_at: new Date().toISOString(), tutors: null,
      }));
      setCodes(prev => [...newCodes, ...prev]);
      setNote("");
    }
    setLoading(false);
  }

  async function handleDelete(code: string) {
    await deleteBetaCode(code);
    setCodes(prev => prev.filter(c => c.code !== code));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyAllFree() {
    const free = codes.filter(c => !c.used_by).map(c => c.code).join("\n");
    navigator.clipboard.writeText(free);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  }

  const freeCodes = codes.filter(c => !c.used_by);
  const usedCodes = codes.filter(c => c.used_by);

  const inputStyle = {
    borderColor: "var(--brown-pale)",
    background:  "var(--cream)",
    color:       "var(--brown-dark)",
  };

  return (
    <div>
      {/* Генератор */}
      <div className="rounded-xl border p-4 mb-4 flex flex-wrap items-end gap-3"
        style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
            Количество
          </label>
          <input type="number" value={count} onChange={e => setCount(Number(e.target.value))}
            min={1} max={50}
            className="w-24 px-3 py-2 rounded-lg border outline-none text-sm"
            style={inputStyle} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
            Пометка (необязательно)
          </label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="напр. «группа Telegram»"
            className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
            style={inputStyle} />
        </div>
        <button onClick={handleGenerate} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
          style={{ background: "var(--gradient-primary)", opacity: loading ? 0.7 : 1 }}>
          {loading ? "..." : "Сгенерировать"}
        </button>
        {genError && (
          <p className="w-full text-xs text-red-600">{genError}</p>
        )}
        {freeCodes.length > 0 && (
          <button onClick={copyAllFree}
            className="px-4 py-2 rounded-lg text-sm border shrink-0"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            {copied === "all" ? "✓ Скопировано" : `Копировать все (${freeCodes.length})`}
          </button>
        )}
      </div>

      {codes.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--brown-light)" }}>
          Кодов пока нет — сгенерируй первые
        </p>
      )}

      {/* Доступные коды */}
      {freeCodes.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--brown-mid)" }}>
            Доступны ({freeCodes.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {freeCodes.map(c => (
              <div key={c.code} className="flex items-center justify-between rounded-lg border px-3 py-2"
                style={{ background: "white", borderColor: "var(--brown-pale)" }}>
                <div>
                  <span className="font-mono font-semibold text-sm tracking-wider"
                    style={{ color: "var(--brown-dark)" }}>
                    {c.code}
                  </span>
                  {c.note && (
                    <span className="text-xs ml-2" style={{ color: "var(--brown-light)" }}>{c.note}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyCode(c.code)}
                    className="text-xs px-2 py-1 rounded border transition-all hover:opacity-70"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                    {copied === c.code ? "✓" : "Копировать"}
                  </button>
                  <button onClick={() => handleDelete(c.code)}
                    className="text-xs px-2 py-1 rounded border transition-all hover:opacity-70"
                    style={{ borderColor: "#fcc", color: "#c55" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Использованные коды */}
      {usedCodes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--brown-light)" }}>
            Использованы ({usedCodes.length})
          </h3>
          <div className="flex flex-col gap-1">
            {usedCodes.map(c => (
              <div key={c.code} className="flex items-center justify-between rounded-lg border px-3 py-2 opacity-60"
                style={{ background: "#f8f8f8", borderColor: "var(--brown-pale)" }}>
                <span className="font-mono text-sm tracking-wider line-through"
                  style={{ color: "var(--brown-light)" }}>
                  {c.code}
                </span>
                <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                  {c.tutors?.name ?? c.tutors?.email ?? "—"}
                  {c.used_at ? ` · ${new Date(c.used_at).toLocaleDateString("ru")}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
