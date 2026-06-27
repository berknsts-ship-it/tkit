"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStudent } from "@/app/actions/students";

export default function NewStudentPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const card = {
    background: "white",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createStudent(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Добавить ученика</h1>
      <div className="rounded-2xl border p-6" style={card}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Имя ученика
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="Иван Петров"
              className="w-full px-4 py-2 rounded-xl border outline-none"
              style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Заметки (необязательно)
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Особенности, цели, уровень..."
              className="w-full px-4 py-2 rounded-xl border outline-none resize-none"
              style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex-1 py-2 rounded-xl border font-medium"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl font-semibold text-white"
              style={{ background: "var(--gradient-primary)", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Сохраняем..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
      <p className="mt-4 text-sm" style={{ color: "var(--brown-light)" }}>
        После добавления ученику автоматически будет выдан код входа — поделитесь им с учеником.
      </p>
    </div>
  );
}
