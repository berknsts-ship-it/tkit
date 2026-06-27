"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, X, Loader2, Plus, ImagePlus } from "lucide-react";
import type { WhiteboardRef } from "./WhiteboardCanvas";

interface Props {
  canvasRef: React.RefObject<WhiteboardRef | null>;
  getViewport: () => { zoom: number; panX: number; panY: number; width: number; height: number };
}

type DrawItem = Record<string, unknown>;

export default function BoardAI({ canvasRef, getViewport }: Props) {
  const [open,     setOpen]     = useState(false);
  const [prompt,   setPrompt]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [preview,  setPreview]  = useState<DrawItem[] | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true); setError(null); setPreview(null);
    try {
      const vp = getViewport();
      const anchor = {
        x: (vp.width  / 2 - vp.panX) / vp.zoom,
        y: (vp.height / 2 - vp.panY) / vp.zoom,
      };
      const existingCount = canvasRef.current?.getItems().length ?? 0;

      const res = await fetch("/api/board/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), anchor, existingCount }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Ошибка генерации"); return; }
      setPreview(data.items);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const addToBoard = () => {
    if (!preview) return;
    canvasRef.current?.mergeItems(preview as Parameters<WhiteboardRef["mergeItems"]>[0]);
    setPreview(null); setPrompt(""); setOpen(false);
  };

  const regenerate = () => { setPreview(null); generate(); };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg font-medium border-2 hover:opacity-80 transition-all"
        style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)", background:"white" }}
        title="ИИ-помощник: добавить задание на доску">
        <Sparkles size={14} style={{ color:"#9b59b6" }}/> ИИ
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.35)" }}
      onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setPreview(null); } }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background:"white", borderColor:"var(--brown-pale)" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor:"var(--brown-pale)", background:"#faf7ff" }}>
          <Sparkles size={16} style={{ color:"#9b59b6" }}/>
          <span className="font-semibold text-sm" style={{ color:"var(--brown-dark)" }}>
            ИИ-помощник доски
          </span>
          <button onClick={() => { setOpen(false); setPreview(null); setError(null); }}
            className="ml-auto p-1 rounded hover:opacity-60" style={{ color:"var(--brown-light)" }}>
            <X size={15}/>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Suggestions */}
          {!preview && (
            <div className="flex flex-wrap gap-1.5">
              {[
                "Подбери пару: физическая величина — единица измерения (7 пар)",
                "Сортировка: органические и неорганические вещества",
                "Расставь шаги решения квадратного уравнения по порядку",
                "Вставь пропущенное: законы Ньютона с пропусками",
                "Подбери пару: страна — столица (Европа, 8 пар)",
                "Сортировка: Past Simple vs Present Perfect (8 предложений)",
                "Расставь по хронологии: события Второй мировой войны",
                "Тест: выбери правильный ответ — типы треугольников (4 задачи)",
              ].map(s => (
                <button key={s} onClick={() => setPrompt(s)}
                  className="text-xs px-2.5 py-1 rounded-full border hover:opacity-80 transition-all text-left"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-mid)", background:"var(--brown-pale)" }}>
                  {s.length > 45 ? s.slice(0, 45) + "…" : s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 items-end">
            <textarea ref={inputRef} value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
              placeholder="Опиши что добавить на доску... (Enter — генерировать)"
              rows={3}
              className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm resize-none"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)", lineHeight:1.5 }}/>
            <button onClick={generate} disabled={loading || !prompt.trim()}
              className="shrink-0 p-2.5 rounded-xl text-white disabled:opacity-40 transition-all"
              style={{ background:"linear-gradient(135deg,#9b59b6,#6c3483)" }}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs px-3 py-2 rounded-xl" style={{ background:"#fff0f0", color:"#c0392b" }}>
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-xl border overflow-hidden"
              style={{ borderColor:"var(--brown-pale)" }}>
              <div className="px-3 py-2 border-b text-xs font-medium flex items-center justify-between"
                style={{ borderColor:"var(--brown-pale)", background:"#f8f9ff", color:"var(--brown-mid)" }}>
                <span>Предпросмотр ({preview.length} эл.)</span>
                <button onClick={regenerate} className="hover:opacity-70 flex items-center gap-1"
                  style={{ color:"var(--brown-mid)" }}>
                  <Loader2 size={10}/> ещё раз
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto p-3">
                {/* count by type */}
                {(() => {
                  const texts   = preview.filter(i => i.type === "text");
                  const frames  = preview.filter(i => i.type === "frame");
                  const shapes  = preview.filter(i => i.type === "shape");
                  const cards   = texts.filter(i => i.bgColor);
                  const plain   = texts.filter(i => !i.bgColor);
                  return (
                    <>
                      {frames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {frames.map((f, i) => (
                            <div key={i} className="px-2 py-1 rounded-lg border-2 text-xs"
                              style={{ borderColor: String(f.color ?? "#94a3b8"), background: String(f.bgColor ?? "#f1f5f9"), color:"var(--brown-dark)" }}>
                              📦 {String(f.title || "зона")}
                            </div>
                          ))}
                        </div>
                      )}
                      {cards.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {cards.map((c, i) => (
                            <div key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ background: String(c.bgColor ?? "#fef3c7"), color:"var(--brown-dark)" }}>
                              {String(c.text ?? "").slice(0, 40)}
                            </div>
                          ))}
                        </div>
                      )}
                      {plain.map((item, i) => (
                        <div key={i} className="text-xs py-0.5"
                          style={{ color:"var(--brown-dark)",
                            fontWeight: (item.bold as boolean) ? 600 : 400,
                            fontStyle:  (item.italic as boolean) ? "italic" : "normal" }}>
                          {String(item.text ?? "").slice(0, 100)}
                        </div>
                      ))}
                      {shapes.length > 0 && (
                        <div className="text-xs mt-1" style={{ color:"var(--brown-light)" }}>
                          + {shapes.length} линий/фигур
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex gap-2 px-3 py-2 border-t" style={{ borderColor:"var(--brown-pale)" }}>
                <button onClick={addToBoard}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background:"var(--gradient-primary)" }}>
                  <Plus size={14}/> Добавить на доску
                </button>
                <button onClick={() => { setPreview(null); setPrompt(""); }}
                  className="px-3 py-2 rounded-xl border text-sm"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-light)" }}>
                  Сбросить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
