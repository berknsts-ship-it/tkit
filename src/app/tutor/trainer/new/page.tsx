"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createDeck } from "@/app/actions/trainer";

const SUBJECTS = [
  "Математика", "Физика", "Химия", "Биология", "История и обществознание",
  "Русский язык", "Литература", "Информатика", "Другое",
];

export default function NewTrainerPage() {
  const [title, setTitle]       = useState("");
  const [subject, setSubject]   = useState("");
  const [desc, setDesc]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startT]       = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Введите название"); return; }
    startT(async () => {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("subject", subject);
      fd.set("description", desc);
      const res = await createDeck(fd);
      if (res?.error) setError(res.error);
    });
  }

  const inp = "w-full px-4 py-2.5 rounded-xl border outline-none text-sm transition-all";
  const inpStyle = { borderColor: "var(--brown-pale)", color: "var(--brown-dark)", background: "white" };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tutor/trainer" className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          ← Назад
        </Link>
        <h1 className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>Новая колода</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border p-6 space-y-4 bg-white"
        style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brown-dark)" }}>
            Название *
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Например: Клетка и её органоиды"
            className={inp} style={inpStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brown-dark)" }}>
            Предмет
          </label>
          <select value={subject} onChange={e => setSubject(e.target.value)}
            className={inp} style={{ ...inpStyle, color: subject ? "var(--brown-dark)" : "var(--brown-light)" }}>
            <option value="">Не указан</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brown-dark)" }}>
            Описание
          </label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Краткое описание (необязательно)"
            rows={2}
            className={inp} style={{ ...inpStyle, resize: "none" }} />
        </div>

        {error && <p className="text-sm" style={{ color: "#c06040" }}>{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-2.5 rounded-xl font-semibold text-white transition-all"
          style={{ background: "var(--gradient-primary)", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Создаём..." : "Создать и добавить карточки →"}
        </button>
      </form>
    </div>
  );
}
