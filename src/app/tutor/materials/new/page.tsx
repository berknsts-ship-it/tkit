"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X } from "lucide-react";

export default function NewMaterialPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.95)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Выберите файл"); return; }
    if (!title.trim()) { setError("Укажите название"); return; }
    setError(null);
    setProgress(0);

    try {
      // 1. Получить signed URL
      const signRes = await fetch("/api/upload/material-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const signData = await signRes.json();
      if (!signRes.ok || signData.error) throw new Error(signData.error ?? "Ошибка получения URL");

      // 2. Загрузить файл напрямую с прогрессом
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signData.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Ошибка сети"));
        xhr.send(file);
      });

      // 3. Сохранить в базу
      const saveRes = await fetch("/api/upload/material-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), storagePath: signData.path, fileName: file.name }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || saveData.error) throw new Error(saveData.error ?? "Ошибка сохранения");

      router.push("/tutor/materials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      setProgress(null);
    }
  }

  const isLoading = progress !== null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/tutor/materials")}
          className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          ← Назад
        </button>
        <h1 className="text-xl font-bold">Загрузить учебник / материал</h1>
      </div>

      <div className="rounded-2xl border p-6 space-y-4" style={cardStyle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Название</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Например: Учебник Spotlight 7"
              className="w-full px-4 py-2 rounded-xl border outline-none"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Файл (PDF, видео, изображение, документ — до 300 МБ)
            </label>
            {file ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}>
                <FileText size={20} style={{ color: "var(--brown-light)" }} />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                  {(file.size / 1024 / 1024).toFixed(1)} МБ
                </span>
                {!isLoading && (
                  <button type="button" onClick={() => setFile(null)}>
                    <X size={16} style={{ color: "var(--brown-light)" }} />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:opacity-70"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
                <Upload size={28} />
                <span className="text-sm">Нажмите или перетащите файл</span>
                <input ref={inputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.ppt,.pptx"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          {/* Прогресс-бар */}
          {isLoading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: "var(--brown-mid)" }}>
                <span>{progress === 100 ? "Сохраняем..." : "Загружаем файл..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "var(--brown-pale)" }}>
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%`, background: "var(--gradient-primary)" }} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
            <Upload size={16} />
            {isLoading ? `Загрузка ${progress}%` : "Загрузить"}
          </button>
        </form>
      </div>
    </div>
  );
}
