"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import WhiteboardCanvas, { BoardMaterial, WhiteboardRef } from "@/components/shared/WhiteboardCanvas";
import SyncedAudio from "@/components/shared/SyncedAudio";
import SyncedVideo from "@/components/shared/SyncedVideo";
import { saveSnapshot, deleteSnapshot, getSnapshotItems, renameSnapshot } from "@/app/actions/board";
import { PenLine, Globe, BookOpen, Save, Trash2, Download, Plus, ChevronRight, GitMerge, Check, Pencil, Maximize2, Minimize2 } from "lucide-react";

const EXTERNAL_BOARDS = [
  { label: "Miro",   hint: "Вставь ссылку на существующую доску Miro" },
  { label: "Другая", hint: "Любая внешняя доска с поддержкой iFrame" },
];

type Snapshot = {
  id: string;
  title: string;
  created_at: string;
  lesson_id: string | null;
  lessons?: { scheduled_at: string } | null;
};

export default function BoardView({
  studentId, materials, snapshots: initialSnapshots, todayLessonId,
}: {
  studentId: string;
  materials: BoardMaterial[];
  snapshots: Snapshot[];
  todayLessonId?: string;
}) {
  const canvasRef   = useRef<WhiteboardRef>(null);
  const canvasDivRef= useRef<HTMLDivElement>(null);

  const getViewport = useCallback(() => {
    const el = canvasDivRef.current;
    return {
      zoom:   1, panX:   0, panY:  0,
      width:  el?.offsetWidth  ?? 800,
      height: el?.offsetHeight ?? 600,
      // Real viewport is managed inside WhiteboardCanvas, we approximate here
      // The AI uses this to place items roughly in the center of screen
    };
  }, []);

  const [fullscreen, setFullscreen] = useState(false);
  const [mode,       setMode]      = useState<"builtin" | "external">("builtin");
  const [iframeUrl,  setIframeUrl] = useState("");
  const [inputUrl,   setInputUrl]  = useState("");

  // History panel
  const [showHistory,  setShowHistory]  = useState(false);
  const [snapshots,    setSnapshots]    = useState<Snapshot[]>(initialSnapshots);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [saving,       startSave]       = useTransition();
  const [saveTitle,    setSaveTitle]    = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editTitle,    setEditTitle]    = useState("");

  const handleSave = async () => {
    const items = canvasRef.current?.getItems() ?? [];
    if (items.length === 0) return;
    startSave(async () => {
      const title = saveTitle.trim() || new Date().toLocaleDateString("ru", { day: "numeric", month: "long" });
      await saveSnapshot(studentId, title, items, todayLessonId);
      setSaveTitle(""); setShowSaveForm(false);
      // Optimistic update
      setSnapshots(prev => [{
        id: crypto.randomUUID(),
        title,
        created_at: new Date().toISOString(),
        lesson_id: todayLessonId ?? null,
        lessons: null,
      }, ...prev]);
    });
  };

  const handleDelete = async (id: string) => {
    await deleteSnapshot(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleLoad = async (id: string) => {
    try {
      const items = await getSnapshotItems(id);
      canvasRef.current?.loadItems(items as Parameters<WhiteboardRef["loadItems"]>[0]);
      setShowHistory(false);
    } catch { /* snapshot data malformed — silently skip */ }
  };

  const handleMerge = async () => {
    try {
      for (const id of selected) {
        const items = await getSnapshotItems(id);
        canvasRef.current?.mergeItems(items as Parameters<WhiteboardRef["mergeItems"]>[0]);
      }
    } catch { /* partial merge on error */ }
    setSelected(new Set()); setShowHistory(false);
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    await renameSnapshot(id, editTitle.trim());
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s));
    setEditingId(null);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Переключатель */}
      <div className="flex items-center gap-2 border-b shrink-0 overflow-x-auto px-3 py-1.5"
        style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0", touchAction: "pan-x" }}>
        <button onClick={() => setMode("builtin")}
          className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg font-medium transition-all shrink-0"
          style={{ background: mode==="builtin" ? "var(--gradient-primary)" : "transparent",
                   color: mode==="builtin" ? "white" : "var(--brown-mid)" }}>
          <PenLine size={14}/> <span className="hidden sm:inline">Встроенная</span><span className="sm:hidden">Доска</span>
        </button>
        <button onClick={() => setMode("external")}
          className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg font-medium transition-all shrink-0"
          style={{ background: mode==="external" ? "var(--gradient-primary)" : "transparent",
                   color: mode==="external" ? "white" : "var(--brown-mid)" }}>
          <Globe size={14}/> <span className="hidden sm:inline">Внешняя</span><span className="sm:hidden">Внешняя</span>
        </button>

        {mode === "builtin" && <>
          <div className="w-px h-5 shrink-0" style={{ background: "var(--brown-pale)" }}/>
          {showSaveForm ? (
            <div className="flex items-center gap-2 shrink-0">
              <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                placeholder={new Date().toLocaleDateString("ru", { day: "numeric", month: "long" })}
                autoFocus
                className="text-sm px-3 py-1 rounded-lg border outline-none"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)", width: 160 }} />
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-medium text-white shrink-0"
                style={{ background: "var(--gradient-primary)", opacity: saving ? 0.6 : 1 }}>
                <Save size={13}/> {saving ? "..." : "Сохранить"}
              </button>
              <button onClick={() => setShowSaveForm(false)}
                className="text-sm px-2 py-1 rounded-lg border shrink-0"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
                ✕
              </button>
            </div>
          ) : (
            <button onClick={() => setShowSaveForm(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg font-medium border-2 hover:opacity-80 shrink-0"
              style={{ borderColor: "var(--brown-mid)", color: "var(--brown-mid)" }}>
              <Save size={13}/> <span className="hidden sm:inline">Сохранить конспект</span><span className="sm:hidden">Сохранить</span>
            </button>
          )}
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg font-medium border-2 hover:opacity-80 shrink-0"
            style={{ borderColor: showHistory ? "var(--brown-dark)" : "var(--brown-pale)",
                     color: "var(--brown-dark)", background: showHistory ? "var(--brown-pale)" : "transparent",
                     marginLeft: "auto" }}>
            <BookOpen size={13}/> <span className="hidden sm:inline">История {snapshots.length > 0 && `(${snapshots.length})`}</span>
            <span className="sm:hidden">{snapshots.length > 0 ? snapshots.length : ""}</span>
            <ChevronRight size={12} style={{ transform: showHistory ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </>}
        {!(mode === "builtin") && (
          <span className="hidden sm:inline ml-auto text-xs" style={{ color: "var(--brown-light)" }}>
            Ученик видит встроенную доску в своём кабинете
          </span>
        )}
      </div>

      {mode === "builtin" && (
        <div className={fullscreen
          ? "fixed inset-0 z-50 flex flex-col"
          : "flex flex-1 overflow-hidden"
        }>
          {/* Canvas area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div ref={canvasDivRef} className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
              <WhiteboardCanvas ref={canvasRef} roomId={studentId} role="tutor" materials={materials} />
              {/* Fullscreen toggle */}
              <button
                onClick={() => setFullscreen(v => !v)}
                className="absolute top-2 right-2 z-40 p-1.5 rounded-lg border shadow-sm pointer-events-auto"
                style={{ background: "white", borderColor: "var(--brown-pale)" }}
                title={fullscreen ? "Свернуть" : "На весь экран"}
              >
                {fullscreen ? <Minimize2 size={14} style={{ color: "var(--brown-dark)" }}/> : <Maximize2 size={14} style={{ color: "var(--brown-dark)" }}/>}
              </button>
            </div>
            <SyncedAudio roomId={studentId} role="tutor" />
            <SyncedVideo roomId={studentId} role="tutor" />
          </div>

          {/* History panel — mobile: fixed full-screen overlay, desktop: side panel */}
          {showHistory && (
            <div className="flex flex-col overflow-hidden fixed inset-0 z-50 sm:static sm:inset-auto sm:z-auto sm:shrink-0 sm:w-[280px]"
              style={{
                borderLeft: "1px solid var(--brown-pale)",
                background: "white",
              }}>
              <div className="px-4 py-3 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: "var(--brown-pale)" }}>
                <span className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>Конспекты</span>
                <div className="flex items-center gap-2">
                  {selected.size >= 2 && (
                    <button onClick={handleMerge}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium text-white"
                      style={{ background: "var(--gradient-primary)" }}>
                      <GitMerge size={12}/> Объединить ({selected.size})
                    </button>
                  )}
                  {/* Close button — visible on mobile */}
                  <button onClick={() => setShowHistory(false)}
                    className="sm:hidden p-1.5 rounded-lg border"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}
                    aria-label="Закрыть">
                    ✕
                  </button>
                </div>
              </div>

              {snapshots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-2">
                  <div className="text-3xl">📓</div>
                  <p className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>Нет конспектов</p>
                  <p className="text-xs" style={{ color: "var(--brown-light)" }}>
                    Нарисуй что-нибудь на доске и нажми «Сохранить конспект»
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {selected.size > 0 && selected.size < 2 && (
                    <div className="px-3 py-2 text-xs" style={{ color: "var(--brown-light)" }}>
                      Выбери ещё один конспект для объединения
                    </div>
                  )}
                  {snapshots.map(snap => (
                    <div key={snap.id}
                      className="border-b px-3 py-3 group"
                      style={{ borderColor: "var(--brown-pale)",
                               background: selected.has(snap.id) ? "var(--brown-pale)" : "white" }}>
                      <div className="flex items-start gap-2">
                        {/* Checkbox */}
                        <button onClick={() => toggleSelect(snap.id)}
                          className="shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                          style={{ borderColor: selected.has(snap.id) ? "var(--brown-dark)" : "var(--brown-pale)",
                                   background: selected.has(snap.id) ? "var(--brown-dark)" : "white" }}>
                          {selected.has(snap.id) && <Check size={9} color="white" strokeWidth={3}/>}
                        </button>

                        <div className="flex-1 min-w-0">
                          {editingId === snap.id ? (
                            <form onSubmit={e => { e.preventDefault(); handleRename(snap.id); }}
                              className="flex gap-1">
                              <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                className="flex-1 text-sm px-2 py-0.5 rounded border outline-none min-w-0"
                                style={{ borderColor: "var(--brown-dark)", color: "var(--brown-dark)" }} />
                              <button type="submit" className="text-xs px-1.5 py-0.5 rounded text-white shrink-0"
                                style={{ background: "var(--gradient-primary)" }}><Check size={11}/></button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium truncate" style={{ color: "var(--brown-dark)" }}>
                                {snap.title}
                              </span>
                              <button onClick={() => { setEditingId(snap.id); setEditTitle(snap.title); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                style={{ color: "var(--brown-light)" }}>
                                <Pencil size={11}/>
                              </button>
                            </div>
                          )}
                          <div className="text-xs mt-0.5" style={{ color: "var(--brown-light)" }}>
                            {snap.lessons?.scheduled_at
                              ? `Урок ${fmtDate(snap.lessons.scheduled_at)}`
                              : fmtDate(snap.created_at)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 mt-2 ml-6">
                        <button onClick={() => handleLoad(snap.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium hover:opacity-80 flex-1 justify-center"
                          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                          <Download size={11}/> Загрузить
                        </button>
                        <button onClick={() => toggleSelect(snap.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium hover:opacity-80 flex-1 justify-center"
                          style={{ borderColor: selected.has(snap.id) ? "var(--brown-dark)" : "var(--brown-pale)",
                                   color: "var(--brown-dark)",
                                   background: selected.has(snap.id) ? "var(--brown-pale)" : "transparent" }}>
                          <Plus size={11}/> Объединить
                        </button>
                        <button onClick={() => handleDelete(snap.id)}
                          className="flex items-center justify-center text-xs p-1 rounded-lg border hover:opacity-80"
                          style={{ borderColor: "#f0c0b0", color: "#c06040" }}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "external" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {!iframeUrl ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
              <p className="font-medium" style={{ color: "var(--brown-dark)" }}>Вставь ссылку на внешнюю доску</p>
              <div className="w-full max-w-lg space-y-2">
                {EXTERNAL_BOARDS.map(b => (
                  <div key={b.label} className="px-4 py-2 rounded-xl border text-sm"
                    style={{ borderColor: "var(--brown-pale)", background: "white", color: "var(--brown-dark)" }}>
                    <span className="font-medium">{b.label}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--brown-light)" }}>{b.hint}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 w-full max-w-lg">
                <input value={inputUrl} onChange={e => setInputUrl(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && inputUrl && setIframeUrl(inputUrl)}
                  placeholder="https://..."
                  className="flex-1 px-4 py-2 rounded-xl border outline-none text-sm"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }} />
                <button onClick={() => inputUrl && setIframeUrl(inputUrl)}
                  className="px-4 py-2 rounded-xl font-semibold text-white text-sm"
                  style={{ background: "var(--gradient-primary)" }}>
                  Открыть
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs"
                style={{ borderColor: "var(--brown-pale)", background: "white" }}>
                <span className="truncate flex-1" style={{ color: "var(--brown-light)" }}>{iframeUrl}</span>
                <button onClick={() => setIframeUrl("")} className="px-2 py-0.5 rounded border hover:opacity-70"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                  Сменить
                </button>
              </div>
              <iframe src={iframeUrl} className="flex-1 w-full border-0" title="Внешняя доска"
                allow="camera; microphone; fullscreen" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
