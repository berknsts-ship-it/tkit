"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addCard, deleteCard, assignDeck, deleteDeck, bulkAddCards } from "@/app/actions/trainer";
import { Trash2, Plus, Play, Users, ChevronDown, ChevronUp, Sparkles, Check as CheckIcon } from "lucide-react";

type Card = { id: string; type: string; front: string; back: string; options: string[] | null };
type Student = { id: string; name: string };
type ProgressRow = { student_id: string; card_id: string; correct_count: number; incorrect_count: number };

const TYPE_LABELS: Record<string, string> = {
  flashcard:  "Карточка",
  match:      "Сопоставление",
  definition: "Определение (тест)",
};

const TYPE_HINTS: Record<string, string> = {
  flashcard:  "Лицо: вопрос / термин. Оборот: ответ / определение.",
  match:      "Добавьте несколько пар. Ученик соединит левое с правым.",
  definition: "Термин → правильное определение. Неверные варианты: по одному в строке (или оставьте пустым — возьмём из других карточек).",
};

export default function DeckEditor({
  deckId, deckTitle, cards, students, assigned, progress,
}: {
  deckId: string;
  deckTitle: string;
  cards: Card[];
  students: Student[];
  assigned: string[];
  progress: ProgressRow[];
}) {
  const [type,    setType]    = useState<"flashcard" | "match" | "definition">("flashcard");
  const [front,   setFront]   = useState("");
  const [back,    setBack]    = useState("");
  const [options, setOptions] = useState("");
  const [addErr,  setAddErr]  = useState<string | null>(null);
  const [adding,  startAdd]   = useTransition();
  const [deleting, startDel]  = useTransition();
  const [selection, setSel]   = useState<Set<string>>(new Set(assigned));
  const [saving,  startSave]  = useTransition();
  const [saved,   setSaved]   = useState(false);
  const [showProg, setShowProg] = useState(false);

  // AI generation state
  const [showAi,     setShowAi]     = useState(false);
  const [aiPrompt,   setAiPrompt]   = useState("");
  const [aiType,     setAiType]     = useState("");
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiError,    setAiError]    = useState<string | null>(null);
  type AiCard = { type: string; front: string; back: string; options: string[] };
  const [aiCards,    setAiCards]    = useState<AiCard[]>([]);
  const [aiSel,      setAiSel]      = useState<Set<number>>(new Set());
  const [aiAdding,   startAiAdd]    = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) { setAddErr("Заполните оба поля"); return; }
    setAddErr(null);
    startAdd(async () => {
      const fd = new FormData();
      fd.set("type", type); fd.set("front", front);
      fd.set("back", back); fd.set("options", options);
      const res = await addCard(deckId, fd);
      if (res?.error) setAddErr(res.error);
      else { setFront(""); setBack(""); setOptions(""); }
    });
  }

  function toggleStudent(id: string) {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setSaved(false);
  }

  function handleAssign() {
    startSave(async () => {
      await assignDeck(deckId, [...selection]);
      setSaved(true);
    });
  }

  function handleDelete(cardId: string) {
    startDel(async () => { await deleteCard(cardId, deckId); });
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiCards([]);
    setAiSel(new Set());
    const typeHint = aiType ? `, тип карточек: ${TYPE_LABELS[aiType]}` : "";
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt + typeHint, mode: "trainer_cards" }),
    });
    const data = await res.json();
    if (!res.ok || data.error) { setAiError(data.error ?? "Ошибка"); setAiLoading(false); return; }
    try {
      const parsed: AiCard[] = JSON.parse(data.text);
      const valid = parsed.filter(c => c.type && c.front && c.back);
      setAiCards(valid);
      setAiSel(new Set(valid.map((_, i) => i)));
    } catch {
      setAiError("ИИ вернул некорректный ответ. Попробуйте снова.");
    }
    setAiLoading(false);
  }

  function handleAiAdd() {
    const selected = aiCards.filter((_, i) => aiSel.has(i));
    if (selected.length === 0) return;
    startAiAdd(async () => {
      const res = await bulkAddCards(deckId, selected);
      if (res?.error) setAiError(res.error);
      else { setAiCards([]); setAiSel(new Set()); setAiPrompt(""); setShowAi(false); }
    });
  }

  // Progress per student
  const studentsWithProgress = students.map(s => {
    const rows = progress.filter(p => p.student_id === s.id);
    const total = cards.length;
    const practiced = new Set(rows.map(r => r.card_id)).size;
    const correct = rows.reduce((acc, r) => acc + r.correct_count, 0);
    const incorrect = rows.reduce((acc, r) => acc + r.incorrect_count, 0);
    const isAssigned = selection.has(s.id);
    return { ...s, total, practiced, correct, incorrect, isAssigned };
  }).filter(s => s.isAssigned || progress.some(p => p.student_id === s.id));

  const inp = "w-full px-3 py-2 rounded-xl border outline-none text-sm";
  const inpS = { borderColor: "var(--brown-pale)", color: "var(--brown-dark)", background: "white" };

  return (
    <div className="space-y-6">

      {/* AI generation */}
      <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
        <button onClick={() => setShowAi(o => !o)}
          className="w-full flex items-center gap-2 px-5 py-3.5 text-left"
          style={{ color: "var(--brown-dark)" }}>
          <Sparkles size={16} style={{ color: "#b07040" }} />
          <span className="font-semibold text-sm">Сгенерировать карточки с ИИ</span>
          <span className="ml-auto">{showAi ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </button>

        {showAi && (
          <div className="px-5 pb-5 pt-1 border-t space-y-3" style={{ borderColor: "var(--brown-pale)" }}>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder={"Опишите тему: «Клетка и органоиды, 8 пар для сопоставления» или «Даты Великой Отечественной, карточки»"}
              rows={3}
              className={inp}
              style={{ ...inpS, resize: "none" }}
            />

            {/* Type hint */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs self-center" style={{ color: "var(--brown-light)" }}>Тип:</span>
              {([["", "Авто"], ["flashcard", "Карточки"], ["match", "Сопоставление"], ["definition", "Тест"]] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setAiType(val)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    borderColor: aiType === val ? "var(--brown-dark)" : "var(--brown-pale)",
                    background:  aiType === val ? "var(--brown-pale)" : "transparent",
                    color: "var(--brown-dark)",
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}>
              <Sparkles size={14} />
              {aiLoading ? "Генерирую..." : "Сгенерировать"}
            </button>

            {aiError && <p className="text-xs" style={{ color: "#c06040" }}>{aiError}</p>}

            {aiCards.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium" style={{ color: "var(--brown-mid)" }}>
                    {aiCards.length} карточек сгенерировано — выберите нужные:
                  </p>
                  <button onClick={() => setAiSel(aiSel.size === aiCards.length ? new Set() : new Set(aiCards.map((_, i) => i)))}
                    className="text-xs" style={{ color: "var(--brown-mid)" }}>
                    {aiSel.size === aiCards.length ? "Снять все" : "Выбрать все"}
                  </button>
                </div>

                <div className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: "var(--brown-pale)" }}>
                  {aiCards.map((c, i) => (
                    <label key={i}
                      className="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-all"
                      style={{ background: aiSel.has(i) ? "var(--brown-pale)" : "white" }}>
                      <input type="checkbox" checked={aiSel.has(i)}
                        onChange={() => setAiSel(prev => {
                          const n = new Set(prev);
                          n.has(i) ? n.delete(i) : n.add(i);
                          return n;
                        })}
                        className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(0,0,0,0.06)", color: "var(--brown-mid)" }}>
                            {TYPE_LABELS[c.type] ?? c.type}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate" style={{ color: "var(--brown-dark)" }}>{c.front}</p>
                        <p className="text-sm truncate" style={{ color: "var(--brown-light)" }}>{c.back}</p>
                        {c.options.length > 0 && (
                          <p className="text-xs truncate" style={{ color: "var(--brown-light)" }}>
                            Варианты: {c.options.join(", ")}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <button onClick={handleAiAdd} disabled={aiAdding || aiSel.size === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--gradient-primary)" }}>
                  <CheckIcon size={14} />
                  {aiAdding ? "Добавляем..." : `Добавить ${aiSel.size} карточек`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add card form */}
      <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>Добавить карточку</h2>

        {/* Type selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(["flashcard","match","definition"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all"
              style={{
                borderColor: type === t ? "var(--brown-dark)" : "var(--brown-pale)",
                background:  type === t ? "var(--brown-pale)" : "transparent",
                color: "var(--brown-dark)",
              }}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--brown-light)" }}>{TYPE_HINTS[type]}</p>

        <form onSubmit={handleAdd} className="space-y-3">
          <input value={front} onChange={e => setFront(e.target.value)}
            placeholder={type === "definition" ? "Термин / понятие" : "Лицо карточки"}
            className={inp} style={inpS} />
          <input value={back} onChange={e => setBack(e.target.value)}
            placeholder={type === "definition" ? "Правильное определение" : "Оборот карточки"}
            className={inp} style={inpS} />
          {type === "definition" && (
            <textarea value={options} onChange={e => setOptions(e.target.value)}
              placeholder={"Неверные варианты (каждый с новой строки):\nВариант 1\nВариант 2\nВариант 3"}
              rows={3} className={inp} style={{ ...inpS, resize: "none" }} />
          )}
          {addErr && <p className="text-xs" style={{ color: "#c06040" }}>{addErr}</p>}
          <button type="submit" disabled={adding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)", opacity: adding ? 0.7 : 1 }}>
            <Plus size={14} /> {adding ? "Добавляем..." : "Добавить"}
          </button>
        </form>
      </div>

      {/* Cards list */}
      {cards.length > 0 && (
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--brown-pale)" }}>
            <span className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>
              Карточки ({cards.length})
            </span>
            <Link href={`/tutor/trainer/${deckId}/practice`}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg text-white"
              style={{ background: "var(--gradient-primary)" }}>
              <Play size={13} /> Тренироваться
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--brown-pale)" }}>
            {cards.map(card => (
              <div key={card.id} className="px-5 py-3 flex items-start gap-3 group">
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full mt-0.5"
                  style={{ background: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                  {TYPE_LABELS[card.type] ?? card.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{card.front}</p>
                  <p className="text-sm" style={{ color: "var(--brown-light)" }}>{card.back}</p>
                  {card.options && card.options.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--brown-light)" }}>
                      Варианты: {card.options.join(", ")}
                    </p>
                  )}
                </div>
                <button onClick={() => handleDelete(card.id)} disabled={deleting}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
                  style={{ color: "#c06040" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign to students */}
      {students.length > 0 && (
        <div className="rounded-2xl border p-5 bg-white" style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} style={{ color: "var(--brown-mid)" }} />
            <h2 className="font-semibold" style={{ color: "var(--brown-dark)" }}>Назначить ученикам</h2>
          </div>
          <div className="space-y-2 mb-4">
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: selection.has(s.id) ? "var(--brown-dark)" : "var(--brown-pale)",
                  background:  selection.has(s.id) ? "var(--brown-pale)" : "white",
                }}>
                <input type="checkbox" checked={selection.has(s.id)} onChange={() => toggleStudent(s.id)}
                  className="rounded" />
                <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{s.name}</span>
              </label>
            ))}
          </div>
          <button onClick={handleAssign} disabled={saving}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-sm"
            style={{ background: "var(--gradient-primary)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Сохраняем..." : saved ? "✓ Сохранено" : "Сохранить назначение"}
          </button>
        </div>
      )}

      {/* Progress overview */}
      {studentsWithProgress.length > 0 && (
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
          <button
            onClick={() => setShowProg(p => !p)}
            className="w-full px-5 py-3 flex items-center justify-between border-b"
            style={{ borderColor: "var(--brown-pale)" }}>
            <span className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>
              Прогресс учеников
            </span>
            {showProg ? <ChevronUp size={16} style={{ color: "var(--brown-light)" }} /> : <ChevronDown size={16} style={{ color: "var(--brown-light)" }} />}
          </button>
          {showProg && (
            <div className="divide-y" style={{ borderColor: "var(--brown-pale)" }}>
              {studentsWithProgress.map(s => {
                const pct = s.correct + s.incorrect > 0
                  ? Math.round(s.correct / (s.correct + s.incorrect) * 100) : null;
                return (
                  <div key={s.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{s.name}</span>
                      <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                        {s.practiced}/{s.total} карточек
                        {pct !== null && ` · ${pct}% верно`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--brown-pale)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${s.total > 0 ? (s.practiced / s.total) * 100 : 0}%`,
                          background: "var(--gradient-primary)",
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="flex justify-end pt-2">
        <button onClick={async () => {
          if (!confirm("Удалить колоду и все карточки?")) return;
          await deleteDeck(deckId);
        }}
          className="text-xs px-3 py-1.5 rounded-lg border hover:bg-red-50 transition-all"
          style={{ borderColor: "#f0c0b0", color: "#c06040" }}>
          Удалить колоду
        </button>
      </div>
    </div>
  );
}
