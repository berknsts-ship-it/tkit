"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createArticle, updateArticle } from "@/app/actions/reference";
import { useRouter } from "next/navigation";
import { Sparkles, ChevronDown, ChevronUp, ImagePlus, X } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Student { id: string; name: string; }

interface Props {
  students: Student[];
  article?: {
    id: string;
    title: string;
    content: string;
    assign_to_all: boolean;
    assigned_student_ids: string[];
  };
}

const AI_SUGGESTIONS = [
  "Напиши таблицу сравнения Present Simple и Present Continuous",
  "Объясни правило кратко с 2–3 примерами",
  "Сделай шпаргалку: правило + исключения + примеры",
  "Напиши таблицу неправильных глаголов (10 штук)",
  "Объясни тему для ученика 7 класса, простыми словами",
];

export default function ReferenceEditor({ students, article }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle]           = useState(article?.title ?? "");
  const [content, setContent]       = useState(article?.content ?? "");
  const [assignToAll, setAssignToAll] = useState(article?.assign_to_all ?? true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(article?.assigned_student_ids ?? []));
  const [aiPrompt, setAiPrompt]     = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);
  const [preview, setPreview]       = useState(false);
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ai/usage").then(r => r.json()).then(d => {
      if (typeof d.remaining === "number") setAiRemaining(d.remaining);
    }).catch(() => {});
  }, []);

  function pickImage(file: File) {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generateWithAI() {
    const prompt = aiPrompt.trim() || title.trim();
    setAiLoading(true);
    setAiError(null);
    try {
      let data: { text?: string; error?: string; remaining?: number };
      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        if (prompt) fd.append("prompt", prompt);
        const res = await fetch("/api/ai/reference-image", { method: "POST", body: fd });
        data = await res.json();
      } else {
        if (!prompt) { setAiError("Введите заголовок или запрос к ИИ"); return; }
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, mode: "reference" }),
        });
        data = await res.json();
      }
      if (data.text) {
        setContent(data.text);
        if (typeof data.remaining === "number") setAiRemaining(data.remaining);
        else setAiRemaining(prev => prev !== null ? Math.max(0, prev - 1) : null);
      } else {
        setAiError(data.error ?? "Ошибка ИИ");
      }
    } finally {
      setAiLoading(false);
    }
  }

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("content", content);
    fd.set("assign_to_all", String(assignToAll));
    if (!assignToAll) selectedIds.forEach(id => fd.append("student_ids", id));
    startTransition(async () => {
      if (article) await updateArticle(article.id, fd);
      else await createArticle(fd);
    });
  }

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.95)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

      {/* Заголовок */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
          Заголовок
        </label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
          placeholder="Например: Времена глагола, Падежи, Формулы кинематики..."
          className="w-full px-4 py-2 rounded-xl border outline-none"
          style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}/>
      </div>

      {/* AI-блок */}
      <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: "var(--brown-mid)" }}/>
            <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>Помощник ИИ</span>
          </div>
          {aiRemaining !== null && (
            <span className="text-xs" style={{ color: aiRemaining <= 5 ? "#c0392b" : "var(--brown-light)" }}>
              Осталось {aiRemaining}/30 запросов
            </span>
          )}
        </div>

        {/* Загрузка скрина */}
        <div>
          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="скрин" className="rounded-xl border max-h-48 object-contain"
                style={{ borderColor: "var(--brown-pale)" }}/>
              <button type="button" onClick={clearImage}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                style={{ background: "white", color: "var(--brown-dark)", border: "1px solid var(--brown-pale)" }}>
                <X size={12}/>
              </button>
            </div>
          ) : (
            <label
              className="flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer hover:opacity-80 transition-all w-fit text-sm"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "white" }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) pickImage(f); }}>
              <ImagePlus size={15}/>
              Загрузить скриншот
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); }}/>
            </label>
          )}
          {imageFile && (
            <p className="text-xs mt-1.5" style={{ color: "var(--brown-light)" }}>
              ИИ прочитает текст со скрина и выполнит твой запрос ниже
            </p>
          )}
        </div>

        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
          rows={2}
          placeholder={imageFile
            ? "Что сделать со скрином? Например: «Перепиши как шпаргалку», «Сделай таблицу», «Переведи на русский»"
            : "Что написать? Например:\n«Сделай таблицу сравнения Past Simple и Past Continuous с примерами»"}
          className="w-full px-3 py-2.5 rounded-xl border outline-none resize-none text-sm"
          style={{ borderColor: "var(--brown-pale)", background: "white", color: "var(--brown-dark)", lineHeight: 1.6 }}/>

        {/* Подсказки (только без скрина) */}
        {!imageFile && (
          <div className="flex flex-wrap gap-1.5">
            {AI_SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => setAiPrompt(s)}
                className="text-xs px-2.5 py-1 rounded-full border hover:opacity-80 transition-all text-left"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "white" }}>
                {s.length > 50 ? s.slice(0, 50) + "…" : s}
              </button>
            ))}
          </div>
        )}

        {aiError && (
          <p className="text-xs px-3 py-2 rounded-xl" style={{ background: "#fff0f0", color: "#c0392b" }}>
            {aiError}
          </p>
        )}

        <button type="button" onClick={generateWithAI} disabled={aiLoading}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-all hover:opacity-80"
          style={{ background: "var(--gradient-primary)", color: "white", opacity: aiLoading ? 0.7 : 1 }}>
          <Sparkles size={14}/>
          {aiLoading ? (imageFile ? "Читаю скрин..." : "Генерирую...") : (imageFile ? "Обработать скрин" : "Сгенерировать")}
        </button>
      </div>

      {/* Содержание */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium" style={{ color: "var(--brown-mid)" }}>
            Содержание
          </label>
          <button type="button" onClick={() => setPreview(v => !v)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border hover:opacity-70 transition-all"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            {preview ? <><ChevronUp size={11}/> Редактор</> : <><ChevronDown size={11}/> Предпросмотр</>}
          </button>
        </div>

        {preview ? (
          <div className="w-full px-4 py-3 rounded-xl border min-h-[200px]"
            style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}>
            {content ? <MarkdownContent text={content}/> : (
              <span className="text-sm" style={{ color: "var(--brown-light)" }}>Нет содержимого</span>
            )}
          </div>
        ) : (
          <textarea value={content} onChange={e => setContent(e.target.value)} required rows={14}
            placeholder={"Текст статьи. Поддерживается Markdown:\n## Заголовок\n**жирный**, *курсив*\n- список\n| Столбец 1 | Столбец 2 |\n|-----------|----------|\n| значение  | значение  |"}
            className="w-full px-4 py-3 rounded-xl border outline-none resize-y font-mono text-sm"
            style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", lineHeight: 1.7 }}/>
        )}
        <p className="text-xs mt-1.5" style={{ color: "var(--brown-light)" }}>
          Поддерживается Markdown: **жирный**, *курсив*, ## заголовок, таблицы, списки
        </p>
      </div>

      {/* Кому показывать */}
      <div className="rounded-xl border p-4" style={cardStyle}>
        <p className="font-medium mb-3" style={{ color: "var(--brown-dark)" }}>Кому показывать</p>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" checked={assignToAll} onChange={e => setAssignToAll(e.target.checked)}
            className="w-4 h-4 accent-amber-700"/>
          <span className="text-sm font-medium">Всем ученикам</span>
        </label>
        {!assignToAll && (
          <div className="space-y-2 mt-3 pl-1">
            {students.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--brown-mid)" }}>У вас ещё нет учеников</p>
            ) : (
              students.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)}
                    className="w-4 h-4 accent-amber-700"/>
                  <span className="text-sm">{s.name}</span>
                </label>
              ))
            )}
          </div>
        )}
        {!assignToAll && selectedIds.size === 0 && students.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--brown-light)" }}>
            Не выбрано ни одного ученика — статья будет скрыта
          </p>
        )}
      </div>

      {/* Кнопки */}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 rounded-xl font-semibold text-white transition-all"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Сохраняем..." : article ? "Сохранить" : "Создать"}
        </button>
        <button type="button" onClick={() => router.push("/tutor/reference")}
          className="px-6 py-2 rounded-xl border font-medium transition-all hover:opacity-70"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          Отмена
        </button>
      </div>
    </form>
  );
}
