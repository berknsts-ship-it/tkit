"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, RotateCcw, CheckCircle, XCircle, Volume2 } from "lucide-react";
import { speak } from "@/lib/speak";

interface Word {
  id: string;
  word: string;
  translation: string;
  example?: string | null;
}

export default function PracticeSession({ words, language = "en-US" }: { words: Word[]; language?: string }) {
  const [index, setIndex]           = useState(0);
  const [flipped, setFlipped]       = useState(false);
  const [hint, setHint]             = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [score, setScore]           = useState({ ok: 0, fail: 0 });
  const [done, setDone]             = useState(false);
  const [queue, setQueue]           = useState<Word[]>(() => shuffle([...words]));
  const [speaking, setSpeaking]     = useState(false);

  const current = queue[index];
  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  function playWord() {
    setSpeaking(true);
    speak(current.word, language);
    setTimeout(() => setSpeaking(false), 1200);
  }

  async function getHint() {
    setHintLoading(true);
    setHint(null);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `${current.word} — ${current.translation}`,
        mode: "vocabulary_hint",
      }),
    });
    const data = await res.json();
    setHint(data.text ?? null);
    setHintLoading(false);
  }

  function next(knew: boolean) {
    setScore(s => knew ? { ...s, ok: s.ok + 1 } : { ...s, fail: s.fail + 1 });
    setFlipped(false);
    setHint(null);
    setSpeaking(false);
    if (index + 1 >= queue.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  function restart() {
    setQueue(shuffle([...words]));
    setIndex(0);
    setFlipped(false);
    setHint(null);
    setScore({ ok: 0, fail: 0 });
    setDone(false);
    setSpeaking(false);
  }

  if (done) {
    const total = score.ok + score.fail;
    const pct = Math.round((score.ok / total) * 100);
    return (
      <div className="rounded-2xl border p-8 text-center" style={card}>
        <div className="text-5xl mb-4">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--brown-dark)" }}>
          {pct >= 80 ? "Отлично!" : pct >= 50 ? "Хороший результат" : "Продолжайте тренироваться"}
        </h2>
        <p className="text-lg mb-1" style={{ color: "var(--brown-mid)" }}>
          {score.ok} из {total} правильно ({pct}%)
        </p>
        <button onClick={restart}
          className="mt-6 flex items-center gap-2 mx-auto px-5 py-2 rounded-xl font-semibold text-white"
          style={{ background: "var(--gradient-primary)" }}>
          <RotateCcw size={16}/> Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Прогресс */}
      <div className="flex items-center justify-between text-sm" style={{ color: "var(--brown-light)" }}>
        <span>{index + 1} / {queue.length}</span>
        <span>✓ {score.ok} · ✗ {score.fail}</span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: "var(--brown-pale)" }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${(index / queue.length) * 100}%`, background: "var(--gradient-primary)" }}/>
      </div>

      {/* Карточка */}
      <div className="rounded-2xl border p-8 text-center cursor-pointer select-none min-h-[200px] flex flex-col items-center justify-center gap-4"
        style={card} onClick={() => !flipped && setFlipped(true)}>

        {/* Слово + кнопка произношения */}
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold" style={{ color: "var(--brown-dark)" }}>
            {current.word}
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); playWord(); }}
            className="flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all hover:opacity-80 shrink-0"
            style={{
              borderColor: speaking ? "var(--brown-dark)" : "var(--brown-pale)",
              background: speaking ? "var(--brown-pale)" : "white",
              color: "var(--brown-mid)",
            }}
            title="Произнести">
            <Volume2 size={16} style={{ opacity: speaking ? 1 : 0.6 }}/>
          </button>
        </div>

        {!flipped ? (
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>
            Нажмите, чтобы увидеть перевод
          </p>
        ) : (
          <>
            <div className="text-xl font-semibold" style={{ color: "var(--brown-mid)" }}>
              {current.translation}
            </div>
            {(current.example || hint) && (
              <p className="text-sm italic max-w-sm" style={{ color: "var(--brown-light)", lineHeight: 1.6 }}>
                {hint ?? current.example}
              </p>
            )}
          </>
        )}
      </div>

      {/* Подсказка ИИ */}
      {flipped && !hint && (
        <button onClick={getHint} disabled={hintLoading}
          className="flex items-center gap-1.5 mx-auto text-sm px-4 py-1.5 rounded-lg font-medium"
          style={{ background: "var(--gradient-primary)", color: "white", opacity: hintLoading ? 0.7 : 1 }}>
          <Sparkles size={13}/>
          {hintLoading ? "Загружаю подсказку..." : "Подсказка от ИИ"}
        </button>
      )}

      {/* Кнопки */}
      {flipped && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => next(false)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 hover:opacity-80 transition-all"
            style={{ borderColor: "#e0a0a0", color: "#c06060", background: "#fff5f5" }}>
            <XCircle size={18}/> Не знал
          </button>
          <button onClick={() => next(true)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 hover:opacity-80 transition-all"
            style={{ borderColor: "#90c890", color: "#4a8a4a", background: "#f0fff0" }}>
            <CheckCircle size={18}/> Знал
          </button>
        </div>
      )}

      {!flipped && (
        <button onClick={() => setFlipped(true)}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: "var(--gradient-primary)" }}>
          Показать перевод <ChevronRight size={18}/>
        </button>
      )}
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
