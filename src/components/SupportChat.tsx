"use client";

import { useState, useRef } from "react";
import { MessageCircle, X, Send, CheckCircle, Paperclip, Trash2 } from "lucide-react";
import { submitSupportMessage } from "@/app/actions/support";

function SupportPopup({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 3 - screenshots.length);
    if (!newFiles.length) return;
    setScreenshots(prev => [...prev, ...newFiles].slice(0, 3));
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 3));
      reader.readAsDataURL(f);
    });
  }

  function removeFile(i: number) {
    setScreenshots(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    screenshots.forEach(f => data.append("screenshots", f));
    const result = await submitSupportMessage(data);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setDone(true);
      setScreenshots([]); setPreviews([]);
      formRef.current?.reset();
    }
  }

  return (
    <div className="w-80 rounded-2xl border overflow-hidden"
      style={{
        background: "rgba(253, 248, 240, 0.97)",
        borderColor: "var(--brown-pale)",
        boxShadow: "0 8px 40px rgba(59, 42, 26, 0.16)",
        backdropFilter: "blur(8px)",
      }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--gradient-primary)" }}>
        <span className="text-white font-semibold text-sm">Поддержка T-Kit</span>
        <button onClick={onClose} className="text-white opacity-80 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        {done ? (
          <div className="flex flex-col items-center py-4 gap-2 text-center">
            <CheckCircle size={36} style={{ color: "var(--brown-light)" }} />
            <p className="font-semibold" style={{ color: "var(--brown-dark)" }}>Сообщение отправлено!</p>
            <p className="text-sm" style={{ color: "var(--brown-mid)" }}>Мы разберёмся и ответим вам.</p>
            <button onClick={() => setDone(false)} className="mt-2 text-sm underline" style={{ color: "var(--brown-light)" }}>
              Отправить ещё
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--brown-mid)" }}>Нашли ошибку или есть вопрос? Напишите нам.</p>
            <input type="email" name="email" placeholder="Ваш email (необязательно)"
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }} />
            <textarea name="message" required rows={4} placeholder="Опишите проблему или вопрос..."
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }} />

            {/* Screenshot previews */}
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border"
                      style={{ borderColor: "var(--brown-pale)" }} />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "#c03030", color: "white" }}>
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attach button */}
            {screenshots.length < 3 && (
              <button type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border self-start"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "transparent" }}>
                <Paperclip size={12} />
                Прикрепить скрин {screenshots.length > 0 ? `(${screenshots.length}/3)` : ""}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => addFiles(e.target.files)} />

            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)", opacity: loading ? 0.7 : 1 }}>
              <Send size={14} />
              {loading ? "Отправка..." : "Отправить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SupportChatButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Написать в поддержку"
        className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:opacity-80"
        style={{
          borderColor: open ? "var(--brown-dark)" : "var(--brown-pale)",
          color: "var(--brown-mid)",
          background: open ? "var(--brown-pale)" : "transparent",
        }}
        aria-label="Поддержка">
        <MessageCircle size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-[200]">
          <SupportPopup onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && <SupportPopup onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: "var(--gradient-primary)", boxShadow: "0 4px 20px rgba(124, 92, 62, 0.40)" }}
        aria-label="Написать в поддержку">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
