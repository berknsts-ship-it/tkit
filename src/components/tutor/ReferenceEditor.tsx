"use client";

import { useState, useTransition } from "react";
import { createArticle, updateArticle } from "@/app/actions/reference";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
}

interface Props {
  students: Student[];
  // если передан article — режим редактирования
  article?: {
    id: string;
    title: string;
    content: string;
    assign_to_all: boolean;
    assigned_student_ids: string[];
  };
}

export default function ReferenceEditor({ students, article }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [assignToAll, setAssignToAll] = useState(article?.assign_to_all ?? true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(article?.assigned_student_ids ?? [])
  );

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("content", content);
    fd.set("assign_to_all", String(assignToAll));
    if (!assignToAll) {
      selectedIds.forEach(id => fd.append("student_ids", id));
    }

    startTransition(async () => {
      if (article) {
        await updateArticle(article.id, fd);
      } else {
        await createArticle(fd);
      }
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
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="Например: Времена глагола, Падежи, Формулы..."
          className="w-full px-4 py-2 rounded-xl border outline-none"
          style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
        />
      </div>

      {/* Текст статьи */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
          Содержание
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          required
          rows={12}
          placeholder={"Пишите сюда текст статьи, правило, таблицу или объяснение.\n\nПоддерживается обычный текст."}
          className="w-full px-4 py-3 rounded-xl border outline-none resize-y font-mono text-sm"
          style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", lineHeight: 1.7 }}
        />
      </div>

      {/* Кому показывать */}
      <div className="rounded-xl border p-4" style={cardStyle}>
        <p className="font-medium mb-3" style={{ color: "var(--brown-dark)" }}>
          Кому показывать
        </p>

        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={assignToAll}
            onChange={e => setAssignToAll(e.target.checked)}
            className="w-4 h-4 accent-amber-700"
          />
          <span className="text-sm font-medium">Всем ученикам</span>
        </label>

        {!assignToAll && (
          <div className="space-y-2 mt-3 pl-1">
            {students.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--brown-mid)" }}>
                У вас ещё нет учеников
              </p>
            ) : (
              students.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="w-4 h-4 accent-amber-700"
                  />
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
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 rounded-xl font-semibold text-white transition-all"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-button)",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Сохраняем..." : article ? "Сохранить" : "Создать"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/tutor/reference")}
          className="px-6 py-2 rounded-xl border font-medium transition-all hover:opacity-70"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
