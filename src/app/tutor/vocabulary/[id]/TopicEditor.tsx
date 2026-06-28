"use client";

import { useState, useTransition } from "react";
import { updateTopicMeta, addWord, deleteWord, updateWord } from "@/app/actions/vocabulary";
import { Plus, Trash2, Sparkles, Volume2, Check, X, Pencil } from "lucide-react";
import { speak, LANGUAGES } from "@/lib/speak";

interface Word    { id: string; word: string; translation: string; example?: string | null; }
interface Student { id: string; name: string; }

interface Props {
  topic: { id: string; title: string; student_id: string | null; language: string; words: Word[] };
  students: Student[];
}

export default function TopicEditor({ topic, students }: Props) {
  const [words,    setWords]    = useState<Word[]>(topic.words);
  const [title,    setTitle]    = useState(topic.title);
  const [studentId, setStudentId] = useState(topic.student_id ?? "");
  const [language, setLanguage] = useState(topic.language);
  const [metaSaving, startMeta] = useTransition();
  const [metaSaved, setMetaSaved] = useState(false);

  // add-word form state
  const [newWord,   setNewWord]   = useState("");
  const [newTrans,  setNewTrans]  = useState("");
  const [newEx,     setNewEx]     = useState("");
  const [addPending, startAdd]    = useTransition();

  // inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editW, setEditW] = useState("");
  const [editT, setEditT] = useState("");
  const [editE, setEditE] = useState("");
  const [editPending, startEdit]  = useTransition();
  const [deletePending, startDel] = useTransition();

  const [aiLoading, setAiLoading] = useState(false);

  const input = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };
  const card  = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  async function saveMeta() {
    const fd = new FormData();
    fd.set("id", topic.id);
    fd.set("title", title);
    fd.set("student_id", studentId);
    fd.set("language", language);
    startMeta(async () => {
      await updateTopicMeta(fd);
      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 2000);
    });
  }

  async function handleAddWord(e: React.FormEvent) {
    e.preventDefault();
    if (!newWord.trim() || !newTrans.trim()) return;
    const fd = new FormData();
    fd.set("topic_id", topic.id);
    fd.set("word", newWord.trim());
    fd.set("translation", newTrans.trim());
    fd.set("example", newEx.trim());
    startAdd(async () => {
      const res = await addWord(fd);
      if (res.ok && res.word) {
        setWords(w => [...w, res.word as Word]);
        setNewWord(""); setNewTrans(""); setNewEx("");
      }
    });
  }

  function startInlineEdit(w: Word) {
    setEditingId(w.id);
    setEditW(w.word);
    setEditT(w.translation);
    setEditE(w.example ?? "");
  }

  async function saveInlineEdit() {
    if (!editingId) return;
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("topic_id", topic.id);
    fd.set("word", editW.trim());
    fd.set("translation", editT.trim());
    fd.set("example", editE.trim());
    startEdit(async () => {
      await updateWord(fd);
      setWords(ws => ws.map(w => w.id === editingId
        ? { ...w, word: editW.trim(), translation: editT.trim(), example: editE.trim() || null }
        : w));
      setEditingId(null);
    });
  }

  async function handleDelete(wordId: string) {
    startDel(async () => {
      await deleteWord(wordId, topic.id);
      setWords(ws => ws.filter(w => w.id !== wordId));
    });
  }

  async function getAIExample(word: string, translation: string, targetField: "new" | string) {
    if (!word) return;
    setAiLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: translation ? `${word} (${translation})` : word, mode: "vocabulary_example" }),
    });
    const data = await res.json();
    setAiLoading(false);
    if (!data.text) return;
    if (targetField === "new") setNewEx(data.text.trim());
    else setEditE(data.text.trim());
  }

  return (
    <div className="space-y-6">

      {/* ── Мета: название / ученик / язык ── */}
      <div className="rounded-2xl border p-5 space-y-4" style={card}>
        <h2 className="font-semibold text-base" style={{ color: "var(--brown-dark)" }}>Настройки темы</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Название</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border outline-none text-sm" style={input} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Ученик</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border outline-none text-sm" style={input}>
              <option value="">Для всех</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Язык (для произношения)</label>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border outline-none text-sm" style={input}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
        </div>
        <button onClick={saveMeta} disabled={metaSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-all"
          style={{ background: "var(--gradient-primary)", opacity: metaSaving ? 0.6 : 1 }}>
          {metaSaved ? <><Check size={14}/> Сохранено</> : metaSaving ? "Сохраняю..." : "Сохранить изменения"}
        </button>
      </div>

      {/* ── Слова ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base" style={{ color: "var(--brown-dark)" }}>
            Слова <span className="text-sm font-normal" style={{ color: "var(--brown-light)" }}>({words.length})</span>
          </h2>
        </div>

        <div className="space-y-2 mb-4">
          {words.map(w => (
            <div key={w.id} className="rounded-xl border p-3" style={card}>
              {editingId === w.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-1">
                      <input value={editW} onChange={e => setEditW(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border outline-none text-sm" style={input} />
                      <button onClick={() => speak(editW, language)} disabled={!editW}
                        className="px-2 rounded-lg border hover:opacity-80 disabled:opacity-30"
                        style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                        <Volume2 size={13}/>
                      </button>
                    </div>
                    <input value={editT} onChange={e => setEditT(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border outline-none text-sm" style={input} />
                  </div>
                  <div className="flex gap-2">
                    <input value={editE} onChange={e => setEditE(e.target.value)}
                      placeholder="Пример (необязательно)"
                      className="flex-1 px-3 py-1.5 rounded-lg border outline-none text-sm" style={input} />
                    <button onClick={() => getAIExample(editW, editT, "edit")} disabled={aiLoading || !editW}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                      style={{ background: "var(--gradient-primary)", color: "white", opacity: (aiLoading || !editW) ? 0.5 : 1 }}>
                      <Sparkles size={12}/> {aiLoading ? "..." : "ИИ"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveInlineEdit} disabled={editPending}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-white"
                      style={{ background: "var(--gradient-primary)", opacity: editPending ? 0.6 : 1 }}>
                      <Check size={12}/> Сохранить
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs border"
                      style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
                      <X size={12}/> Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: "var(--brown-dark)" }}>{w.word}</span>
                      <button onClick={() => speak(w.word, language)}
                        className="opacity-40 hover:opacity-80 transition-all"
                        style={{ color: "var(--brown-mid)" }}>
                        <Volume2 size={12}/>
                      </button>
                      <span className="text-sm" style={{ color: "var(--brown-mid)" }}>— {w.translation}</span>
                    </div>
                    {w.example && (
                      <div className="text-xs mt-0.5 italic truncate" style={{ color: "var(--brown-light)" }}>
                        {w.example}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startInlineEdit(w)}
                      className="p-1.5 rounded-lg hover:opacity-70 transition-all"
                      style={{ color: "var(--brown-mid)" }}>
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => handleDelete(w.id)} disabled={deletePending}
                      className="p-1.5 rounded-lg hover:opacity-70 transition-all"
                      style={{ color: "#c06040" }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Добавить новое слово */}
        <form onSubmit={handleAddWord} className="rounded-xl border-2 border-dashed p-4 space-y-3"
          style={{ borderColor: "var(--brown-pale)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brown-light)" }}>
            Добавить слово
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-1">
              <input value={newWord} onChange={e => setNewWord(e.target.value)}
                placeholder="Слово / фраза" required
                className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm" style={input} />
              <button type="button" onClick={() => speak(newWord, language)} disabled={!newWord}
                className="px-2.5 rounded-xl border hover:opacity-80 disabled:opacity-30"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                <Volume2 size={13}/>
              </button>
            </div>
            <input value={newTrans} onChange={e => setNewTrans(e.target.value)}
              placeholder="Перевод" required
              className="px-3 py-2 rounded-xl border outline-none text-sm" style={input} />
          </div>
          <div className="flex gap-2">
            <input value={newEx} onChange={e => setNewEx(e.target.value)}
              placeholder="Пример (необязательно)"
              className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm" style={input} />
            <button type="button" onClick={() => getAIExample(newWord, newTrans, "new")}
              disabled={aiLoading || !newWord}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium shrink-0"
              style={{ background: "var(--gradient-primary)", color: "white", opacity: (aiLoading || !newWord) ? 0.5 : 1 }}>
              <Sparkles size={12}/> {aiLoading ? "..." : "ИИ"}
            </button>
          </div>
          <button type="submit" disabled={addPending || !newWord.trim() || !newTrans.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus size={14}/> {addPending ? "Добавляю..." : "Добавить"}
          </button>
        </form>
      </div>
    </div>
  );
}
