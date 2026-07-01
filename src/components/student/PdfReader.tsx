"use client";

import { useState, useRef, useCallback } from "react";

export function PdfReader({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<unknown>(null);

  const renderPage = useCallback(async (doc: unknown, pageNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = doc as any;
    const pg = await d.getPage(pageNum);
    const scale = Math.min(2, (canvas.parentElement?.clientWidth ?? 400) / pg.getViewport({ scale: 1 }).width);
    const viewport = pg.getViewport({ scale });
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    await pg.render({ canvasContext: ctx, viewport }).promise;
  }, []);

  async function openPdf() {
    setOpen(true);
    if (docRef.current) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ url }).promise;
      docRef.current = doc;
      setTotal(doc.numPages);
      setPage(1);
      await renderPage(doc, 1);
    } catch {
      setError("Не удалось загрузить PDF. Попробуй открыть отдельно.");
    } finally {
      setLoading(false);
    }
  }

  async function goPage(delta: number) {
    if (!docRef.current) return;
    const next = Math.max(1, Math.min(total, page + delta));
    if (next === page) return;
    setPage(next);
    setLoading(true);
    await renderPage(docRef.current, next);
    setLoading(false);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <div>
      <button
        onClick={open ? handleClose : openPdf}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 active:scale-95"
        style={open
          ? { background: "var(--brown-mid)", color: "#fff" }
          : { background: "var(--brown-pale)", color: "var(--brown-dark)" }}
      >
        <span>{open ? "✕" : "📖"}</span>
        {open ? "Свернуть" : "Читать"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl overflow-hidden border" style={{ borderColor: "var(--brown-pale)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b"
            style={{ background: "var(--cream)", borderColor: "var(--brown-pale)" }}>
            <span className="text-xs font-semibold truncate max-w-[60%]" style={{ color: "var(--brown-mid)" }}>
              {title}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {total > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => goPage(-1)} disabled={page <= 1 || loading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }}>‹</button>
                  <span className="text-xs" style={{ color: "var(--brown-mid)" }}>{page} / {total}</span>
                  <button onClick={() => goPage(1)} disabled={page >= total || loading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-30"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }}>›</button>
                </div>
              )}
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold" style={{ color: "var(--brown-light)" }}>
                ↗ Скачать
              </a>
            </div>
          </div>

          {/* Canvas */}
          <div className="bg-gray-100 relative" style={{ minHeight: 300 }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-sm" style={{ color: "var(--brown-light)" }}>Загрузка...</div>
              </div>
            )}
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                <p className="text-sm" style={{ color: "var(--brown-mid)" }}>{error}</p>
                <a href={url} target="_blank" rel="noopener noreferrer" download
                  className="text-sm font-semibold px-4 py-2 rounded-xl"
                  style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                  Скачать PDF ↓
                </a>
              </div>
            ) : (
              <canvas ref={canvasRef} style={{ display: loading ? "none" : "block", width: "100%", height: "auto" }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
