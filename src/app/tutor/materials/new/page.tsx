"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X } from "lucide-react";
import { uploadMaterial } from "@/app/actions/materials";

interface Student { id: string; name: string; }

export default function NewMaterialPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Загружаем учеников при монтировании
  useState(() => {
    fetch("/api/students")
      .then(r => r.json())
      .then(data => { setStudents(data ?? []); setStudentsLoaded(true); })
      .catch(() => setStudentsLoaded(true));
  });

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.95)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  async function handleSubmit(e: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    e.preventDefault();
    if (!file) { setError("Выберите файл"); return; }
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("file", file);

    const result = await uploadMaterial(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/tutor/materials");
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/tutor/materials")}
          className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
        >
          ← Назад
        </button>
        <h1 className="text-xl font-bold">Загрузить учебник / материал</h1>
      </div>

      <div className="rounded-2xl border p-6 space-y-4" style={cardStyle}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Название
            </label>
            <input
              name="title"
              required
              placeholder="Например: Учебник Spotlight 7"
              className="w-full px-4 py-2 rounded-xl border outline-none"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
            />
          </div>

          {/* Файл */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Файл (PDF, изображение, документ — до 50 МБ)
            </label>
            {file ? (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
              >
                <FileText size={20} style={{ color: "var(--brown-light)" }} />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                  {(file.size / 1024 / 1024).toFixed(1)} МБ
                </span>
                <button type="button" onClick={() => setFile(null)}>
                  <X size={16} style={{ color: "var(--brown-light)" }} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:opacity-70"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}
              >
                <Upload size={28} />
                <span className="text-sm">Нажмите или перетащите файл</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.ppt,.pptx"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* Назначить ученику */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Назначить
            </label>
            <select
              name="student_id"
              className="w-full px-4 py-2 rounded-xl border outline-none"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
            >
              <option value="">Всем моим ученикам</option>
              {studentsLoaded && students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-button)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Upload size={16} />
            {loading ? "Загрузка..." : "Загрузить"}
          </button>
        </form>
      </div>
    </div>
  );
}
