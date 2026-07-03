"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircle, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import { saveProgress } from "@/app/actions/trainer";

export type TrainerCard = {
  id: string;
  type: "flashcard" | "match" | "definition";
  front: string;
  back: string;
  options: string[] | null;
};

interface Props {
  deckId: string;
  cards: TrainerCard[];
  studentId?: string; // if present, save progress
  onDone?: () => void;
}

// ── Flashcard mode ─────────────────────────────────────────────────────────

function FlashcardSession({
  cards, onResult,
}: {
  cards: TrainerCard[];
  onResult: (results: { cardId: string; correct: boolean }[]) => void;
}) {
  const [queue,   setQueue]   = useState<TrainerCard[]>(() => shuffle([...cards]));
  const [index,   setIndex]   = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<{ cardId: string; correct: boolean }[]>([]);

  const current = queue[index];

  function answer(correct: boolean) {
    const newResults = [...results, { cardId: current.id, correct }];
    setResults(newResults);
    setFlipped(false);
    if (!correct) {
      // Return to queue later
      setQueue(q => {
        const rest = [...q];
        rest.splice(index, 1);
        rest.push(current);
        return rest;
      });
    } else {
      if (index + 1 >= queue.length - (correct ? 0 : 1)) {
        // Done — only correct cards eliminated from queue
        const remaining = queue.filter((_, i) => i !== index);
        if (remaining.length === 0) {
          onResult(newResults);
          return;
        }
        setQueue(remaining);
        setIndex(0);
      } else {
        setQueue(q => q.filter((_, i) => i !== index));
        setIndex(i => Math.min(i, queue.length - 2));
      }
    }
  }

  if (!current) { onResult(results); return null; }

  const total = queue.length;
  const done = results.filter(r => r.correct).length;

  return (
    <div className="space-y-4">
      <Progress done={done} total={cards.length} />

      <div
        className="rounded-2xl border p-8 text-center cursor-pointer select-none min-h-[180px] flex flex-col items-center justify-center gap-3 bg-white"
        style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}
        onClick={() => !flipped && setFlipped(true)}>
        <p className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>{current.front}</p>
        {flipped ? (
          <p className="text-base" style={{ color: "var(--brown-mid)" }}>{current.back}</p>
        ) : (
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>Нажмите, чтобы увидеть ответ</p>
        )}
      </div>

      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => answer(false)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2"
            style={{ borderColor: "#e0a0a0", color: "#c06060", background: "#fff5f5" }}>
            <XCircle size={18} /> Не знал
          </button>
          <button onClick={() => answer(true)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2"
            style={{ borderColor: "#90c890", color: "#4a8a4a", background: "#f0fff0" }}>
            <CheckCircle size={18} /> Знал
          </button>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: "var(--gradient-primary)" }}>
          Показать ответ <ArrowRight size={18} />
        </button>
      )}

      <p className="text-center text-xs" style={{ color: "var(--brown-light)" }}>
        Осталось в очереди: {total} · Выучено: {done}/{cards.length}
      </p>
    </div>
  );
}

// ── Matching mode ──────────────────────────────────────────────────────────

function MatchSession({
  cards, onResult,
}: {
  cards: TrainerCard[];
  onResult: (results: { cardId: string; correct: boolean }[]) => void;
}) {
  const [lefts]  = useState(() => shuffle(cards.map(c => ({ id: c.id, text: c.front }))));
  const [rights] = useState(() => shuffle(cards.map(c => ({ id: c.id, text: c.back }))));
  const [selLeft,  setSelLeft]  = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [matched,  setMatched]  = useState<Set<string>>(new Set());
  const [flash,    setFlash]    = useState<{ id: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!selLeft || !selRight) return;
    const correct = selLeft === selRight;
    setFlash({ id: selLeft, ok: correct });
    setTimeout(() => {
      if (correct) {
        setMatched(m => new Set([...m, selLeft]));
        if (matched.size + 1 === cards.length) {
          const results = cards.map(c => ({ cardId: c.id, correct: true }));
          onResult(results);
        }
      }
      setSelLeft(null); setSelRight(null); setFlash(null);
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selLeft, selRight]);

  const btnBase = "flex-1 min-h-[48px] px-3 py-2 rounded-xl border-2 text-sm font-medium text-left transition-all";

  function leftStyle(id: string) {
    if (matched.has(id)) return { borderColor: "#90c890", background: "#f0fff0", color: "#4a8a4a", opacity: 0.5 };
    if (selLeft === id) return { borderColor: "var(--brown-dark)", background: "var(--brown-pale)", color: "var(--brown-dark)" };
    if (flash?.id === id) return { borderColor: flash.ok ? "#90c890" : "#e0a0a0", background: flash.ok ? "#f0fff0" : "#fff5f5", color: flash.ok ? "#4a8a4a" : "#c06060" };
    return { borderColor: "var(--brown-pale)", background: "white", color: "var(--brown-dark)" };
  }

  function rightStyle(id: string) {
    if (matched.has(id)) return { borderColor: "#90c890", background: "#f0fff0", color: "#4a8a4a", opacity: 0.5 };
    if (selRight === id) return { borderColor: "var(--brown-dark)", background: "var(--brown-pale)", color: "var(--brown-dark)" };
    if (flash?.id === id) return { borderColor: flash.ok ? "#90c890" : "#e0a0a0", background: flash.ok ? "#f0fff0" : "#fff5f5", color: flash.ok ? "#4a8a4a" : "#c06060" };
    return { borderColor: "var(--brown-pale)", background: "white", color: "var(--brown-dark)" };
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-center" style={{ color: "var(--brown-light)" }}>
        Выберите пару: сначала левое, затем правое
      </p>
      <p className="text-xs text-center" style={{ color: "var(--brown-light)" }}>
        Совпадений: {matched.size} / {cards.length}
      </p>
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-2">
          {lefts.map(item => (
            <button key={item.id} disabled={matched.has(item.id)}
              className={btnBase}
              style={leftStyle(item.id)}
              onClick={() => !matched.has(item.id) && setSelLeft(item.id === selLeft ? null : item.id)}>
              {item.text}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {rights.map(item => (
            <button key={item.id} disabled={matched.has(item.id)}
              className={btnBase}
              style={rightStyle(item.id)}
              onClick={() => {
                if (!matched.has(item.id) && selLeft) setSelRight(item.id);
              }}>
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Definition / MCQ mode ──────────────────────────────────────────────────

function DefinitionSession({
  cards, onResult,
}: {
  cards: TrainerCard[];
  onResult: (results: { cardId: string; correct: boolean }[]) => void;
}) {
  const allBacks = cards.map(c => c.back);

  const [queue,   setQueue]   = useState<TrainerCard[]>(() => shuffle([...cards]));
  const [index,   setIndex]   = useState(0);
  const [chosen,  setChosen]  = useState<string | null>(null);
  const [results, setResults] = useState<{ cardId: string; correct: boolean }[]>([]);

  const current = queue[index];

  // Build 4 options: correct + 3 wrong (from options field or other cards)
  const [opts] = useState(() => buildOpts(cards, current, allBacks));
  const [cardOpts, setCardOpts] = useState<string[]>(() => buildOpts(cards, queue[0], allBacks));

  function buildOptsForCard(card: TrainerCard) {
    setCardOpts(buildOpts(cards, card, allBacks));
  }

  function answer(opt: string) {
    if (chosen) return;
    setChosen(opt);
    const correct = opt === current.back;
    setTimeout(() => {
      const newResults = [...results, { cardId: current.id, correct }];
      setResults(newResults);
      setChosen(null);
      if (!correct) {
        setQueue(q => {
          const rest = [...q];
          rest.splice(index, 1);
          rest.push(current);
          return rest;
        });
        const next = queue[index + 1] ?? queue[0];
        if (next) buildOptsForCard(next);
      } else {
        const remaining = queue.filter((_, i) => i !== index);
        if (remaining.length === 0) { onResult(newResults); return; }
        setQueue(remaining);
        const ni = Math.min(index, remaining.length - 1);
        setIndex(ni);
        buildOptsForCard(remaining[ni]);
      }
    }, 800);
  }

  if (!current) { onResult(results); return null; }

  const done = results.filter(r => r.correct).length;

  return (
    <div className="space-y-4">
      <Progress done={done} total={cards.length} />

      <div className="rounded-2xl border p-6 text-center bg-white"
        style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>{current.front}</p>
        <p className="text-sm mt-2" style={{ color: "var(--brown-light)" }}>Выберите правильное определение</p>
      </div>

      <div className="grid gap-2">
        {cardOpts.map(opt => {
          const isCorrect = opt === current.back;
          let style: React.CSSProperties = { borderColor: "var(--brown-pale)", background: "white", color: "var(--brown-dark)" };
          if (chosen) {
            if (isCorrect) style = { borderColor: "#90c890", background: "#f0fff0", color: "#4a8a4a" };
            else if (chosen === opt) style = { borderColor: "#e0a0a0", background: "#fff5f5", color: "#c06060" };
          }
          return (
            <button key={opt} onClick={() => answer(opt)}
              className="w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all"
              style={style}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildOpts(all: TrainerCard[], card: TrainerCard, allBacks: string[]): string[] {
  const wrong = card.options && card.options.length >= 3
    ? card.options.slice(0, 3)
    : shuffle(allBacks.filter(b => b !== card.back)).slice(0, 3);
  return shuffle([card.back, ...wrong]);
}

// ── Progress bar ───────────────────────────────────────────────────────────

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--brown-light)" }}>
        <span>Выучено: {done} / {total}</span>
        <span>{Math.round((done / total) * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--brown-pale)" }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${(done / total) * 100}%`, background: "var(--gradient-primary)" }} />
      </div>
    </div>
  );
}

// ── Results screen ─────────────────────────────────────────────────────────

function ResultsScreen({
  results, total, onRetryWrong, onRestart,
}: {
  results: { cardId: string; correct: boolean }[];
  total: number;
  onRetryWrong: () => void;
  onRestart: () => void;
}) {
  const correct = results.filter(r => r.correct).length;
  const pct = Math.round((correct / total) * 100);
  const wrongCount = results.filter(r => !r.correct).length;

  return (
    <div className="rounded-2xl border p-8 text-center bg-white"
      style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
      <div className="text-5xl mb-4">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--brown-dark)" }}>
        {pct >= 80 ? "Отлично!" : pct >= 50 ? "Хороший результат" : "Продолжайте тренироваться"}
      </h2>
      <p className="text-lg mb-6" style={{ color: "var(--brown-mid)" }}>
        {correct} из {total} правильно ({pct}%)
      </p>
      <div className="flex flex-col gap-2">
        {wrongCount > 0 && (
          <button onClick={onRetryWrong}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            <RotateCcw size={16} /> Повторить ошибки ({wrongCount})
          </button>
        )}
        <button onClick={onRestart}
          className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold border-2"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          <RotateCcw size={16} /> Заново
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TrainerPractice({ deckId, cards, studentId, onDone }: Props) {
  const flashcards  = cards.filter(c => c.type === "flashcard");
  const matchCards  = cards.filter(c => c.type === "match");
  const defCards    = cards.filter(c => c.type === "definition");

  // Determine practice phases based on card types
  type Phase = { type: "flashcard" | "match" | "definition"; cards: TrainerCard[] };
  const phases: Phase[] = [
    ...(flashcards.length  > 0 ? [{ type: "flashcard"  as const, cards: flashcards }]  : []),
    ...(matchCards.length  >= 2 ? [{ type: "match"     as const, cards: matchCards }]  : []),
    ...(defCards.length    > 0 ? [{ type: "definition" as const, cards: defCards }]    : []),
  ];

  const [phaseIdx, setPhaseIdx]     = useState(0);
  const [sessionKey, setSessionKey] = useState(0); // force remount
  const [allResults, setAllResults] = useState<{ cardId: string; correct: boolean }[]>([]);
  const [done, setDone]             = useState(false);
  const [wrongCards, setWrongCards] = useState<TrainerCard[]>([]);

  const currentPhase = phases[phaseIdx];

  const handlePhaseResult = useCallback(async (results: { cardId: string; correct: boolean }[]) => {
    const combined = [...allResults, ...results];
    setAllResults(combined);

    if (phaseIdx + 1 < phases.length) {
      setPhaseIdx(p => p + 1);
    } else {
      // All phases done
      if (studentId) {
        await saveProgress(studentId, results.map(r => ({ ...r, deckId })));
      }
      const wrong = cards.filter(c => combined.some(r => r.cardId === c.id && !r.correct));
      setWrongCards(wrong);
      setDone(true);
      onDone?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx, allResults, studentId, deckId]);

  function retryWrong() {
    setAllResults([]);
    setPhaseIdx(0);
    setDone(false);
    setSessionKey(k => k + 1);
    // Override phases with only wrong cards
    // We can't mutate phases, so we remount with filtered cards — handled by key
  }

  function restart() {
    setAllResults([]);
    setPhaseIdx(0);
    setDone(false);
    setSessionKey(k => k + 1);
  }

  if (phases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-5xl mb-4">📭</p>
        <p className="font-semibold" style={{ color: "var(--brown-dark)" }}>В колоде нет карточек</p>
      </div>
    );
  }

  if (done) {
    const total = cards.length;
    return (
      <ResultsScreen
        results={allResults}
        total={total}
        onRetryWrong={retryWrong}
        onRestart={restart}
      />
    );
  }

  const phaseLabel: Record<string, string> = {
    flashcard: "Карточки",
    match: "Сопоставление",
    definition: "Тест",
  };

  return (
    <div className="space-y-4">
      {phases.length > 1 && (
        <div className="flex gap-1 justify-center">
          {phases.map((p, i) => (
            <span key={i}
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: i === phaseIdx ? "var(--gradient-primary)" : "var(--brown-pale)",
                color: i === phaseIdx ? "white" : "var(--brown-light)",
              }}>
              {phaseLabel[p.type]}
            </span>
          ))}
        </div>
      )}

      <div key={`${sessionKey}-${phaseIdx}`}>
        {currentPhase?.type === "flashcard" && (
          <FlashcardSession cards={currentPhase.cards} onResult={handlePhaseResult} />
        )}
        {currentPhase?.type === "match" && (
          <MatchSession cards={currentPhase.cards} onResult={handlePhaseResult} />
        )}
        {currentPhase?.type === "definition" && (
          <DefinitionSession cards={currentPhase.cards} onResult={handlePhaseResult} />
        )}
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
