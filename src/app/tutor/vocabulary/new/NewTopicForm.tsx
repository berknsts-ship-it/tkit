"use client";

import { useState } from "react";
import { createTopic } from "@/app/actions/vocabulary";
import { Plus, Sparkles, X, Volume2 } from "lucide-react";
import { speak, LANGUAGES } from "@/lib/speak";

interface Student { id: string; name: string; }
interface Group   { id: string; name: string; }
interface Word { word: string; translation: string; example: string; }

export default function NewTopicForm({ students, groups }: { students: Student[]; groups: Group[] }) {
  const [words, setWords]           = useState<Word[]>([{ word: "", translation: "", example: "" }]);
  const [aiLoading, setAiLoading]   = useState<number | null>(null);
  const [loading, setLoading]       = useState(false);
  const [bulkPrompt, setBulkPrompt] = useState("");
  const [showBulk, setShowBulk]     = useState(false);
  const [language, setLanguage]     = useState("en-US");

  const input = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };
  const card  = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  function addRow() {
    setWords(w => [...w, { word: "", translation: "", example: "" }]);
  }

  function removeRow(i: number) {
    setWords(w => w.filter((_, idx) => idx !== i));
  }

  function updateWord(i: number, field: keyof Word, value: string) {
    setWords(w => w.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function getAIExample(i: number) {
    const { word, translation } = words[i];
    if (!word) return;
    setAiLoading(i);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: translation ? `${word} (${translation})` : word,
        mode: "vocabulary_example",
      }),
    });
    const data = await res.json();
    if (data.text) updateWord(i, "example", data.text.trim());
    setAiLoading(null);
  }

  async function generateBulk() {
    if (!bulkPrompt.trim()) return;
    setAiLoading(-1);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: bulkPrompt.trim(), mode: "vocabulary_set" }),
    });
    const data = await res.json();
    if (data.text) {
      try {
        const match = data.text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed: Word[] = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWords(parsed.map(w => ({
              word: String(w.word ?? ""),
              translation: String(w.translation ?? ""),
              example: String(w.example ?? ""),
            })));
            setShowBulk(false);
            setBulkPrompt("");
          }
        }
      } catch {
        alert("Не удалось разобрать ответ ИИ. Попробуйте ещё раз.");
      }
    }
    setAiLoading(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    words.forEach((w, i) => {
      fd.set(`word_${i}`, w.word);
      fd.set(`trans_${i}`, w.translation);
      fd.set(`example_${i}`, w.example);
    });
    await createTopic(fd);
  }

  const AI_BULK_EXAMPLES = [
    "Цвета на английском, 8 слов",
    "Неправильные глаголы — топ-10, Past Simple",
    "Части тела на испанском",
    "Числа от 1 до 20 на французском",
    "Профессии на немецком, 10 слов",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Основные поля */}
      <div className="rounded-2xl border p-5" style={card}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Название темы *
            </label>
            <input name="title" required type="text" placeholder="Например: Цвета, Глаголы движения..."
              className="w-full px-4 py-2 rounded-xl border outline-none" style={input}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Ученик
            </label>
            <select name="student_id" className="w-full px-4 py-2 rounded-xl border outline-none" style={input}>
              <option value="">Для всех</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {groups.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Или группа
            </label>
            <select name="group_id" className="w-full px-4 py-2 rounded-xl border outline-none" style={input}>
              <option value="">— без группы —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
            Язык карточек (для произношения)
          </label>
          <select name="language" value={language} onChange={e => setLanguage(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border outline-none" style={input}>
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Блок ИИ-генерации всего набора */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <button type="button" onClick={() => setShowBulk(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:opacity-80 transition-all">
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: "var(--brown-mid)" }}/>
            <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>
              Сгенерировать весь набор с ИИ
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--brown-light)" }}>
            {showBulk ? "свернуть ▲" : "развернуть ▼"}
          </span>
        </button>

        {showBulk && (
          <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--brown-pale)" }}>
            <p className="text-xs pt-3" style={{ color: "var(--brown-light)" }}>
              Опишите что нужно — ИИ создаст полный набор карточек и заполнит таблицу ниже
            </p>
            <textarea value={bulkPrompt} onChange={e => setBulkPrompt(e.target.value)} rows={2}
              placeholder="Например: «Животные на английском, 10 слов» или «Глаголы движения в русском языке»"
              className="w-full px-3 py-2.5 rounded-xl border outline-none resize-none text-sm"
              style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" }}/>

            <div className="flex flex-wrap gap-1.5">
              {AI_BULK_EXAMPLES.map(s => (
                <button key={s} type="button" onClick={() => setBulkPrompt(s)}
                  className="text-xs px-2.5 py-1 rounded-full border hover:opacity-80 transition-all"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "white" }}>
                  {s}
                </button>
              ))}
            </div>

            <button type="button" onClick={generateBulk}
              disabled={aiLoading === -1 || !bulkPrompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: "var(--gradient-primary)", color: "white", opacity: (aiLoading === -1 || !bulkPrompt.trim()) ? 0.6 : 1 }}>
              <Sparkles size={14}/>
              {aiLoading === -1 ? "Генерирую набор..." : "Создать карточки"}
            </button>
          </div>
        )}
      </div>

      {/* Карточки */}
      <div className="space-y-3">
        {words.map((w, i) => (
          <div key={i} className="rounded-xl border p-4" style={card}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex gap-1.5">
                <input value={w.word} onChange={e => updateWord(i, "word", e.target.value)}
                  placeholder="Слово / фраза" className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm" style={input}/>
                <button type="button" onClick={() => w.word && speak(w.word, language)}
                  disabled={!w.word}
                  className="px-2.5 rounded-xl border hover:opacity-80 transition-all shrink-0 disabled:opacity-30"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
                  title="Произнести">
                  <Volume2 size={14}/>
                </button>
              </div>
              <input value={w.translation} onChange={e => updateWord(i, "translation", e.target.value)}
                placeholder="Перевод" className="px-3 py-2 rounded-xl border outline-none text-sm" style={input}/>
            </div>
            <div className="flex gap-2">
              <input value={w.example} onChange={e => updateWord(i, "example", e.target.value)}
                placeholder="Пример использования (необязательно)"
                className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm" style={input}/>
              <button type="button" onClick={() => getAIExample(i)} disabled={aiLoading === i || !w.word}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium shrink-0"
                style={{ background: "var(--gradient-primary)", color: "white", opacity: (aiLoading === i || !w.word) ? 0.5 : 1 }}
                title="Придумать пример с ИИ">
                <Sparkles size={12}/>
                {aiLoading === i ? "..." : "Пример"}
              </button>
              {words.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  className="p-2 rounded-xl border hover:opacity-70 transition-all"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
                  <X size={14}/>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow}
        className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-all"
        style={{ color: "var(--brown-mid)" }}>
        <Plus size={16}/> Добавить карточку
      </button>

      <div className="flex gap-3 pt-2">
        <a href="/tutor/vocabulary"
          className="flex-1 py-2 rounded-xl border font-medium text-center"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          Отмена
        </a>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-xl font-semibold text-white"
          style={{ background: "var(--gradient-primary)", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Сохраняем..." : "Создать тему"}
        </button>
      </div>
    </form>
  );
}
