"use client";

import { useState, useRef } from "react";
import { MessageCircle, X, Send, CheckCircle } from "lucide-react";
import { submitSupportMessage } from "@/app/actions/support";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const result = await submitSupportMessage(data);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setDone(true);
      formRef.current?.reset();
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => { setDone(false); setError(null); }, 300);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Попап */}
      {open && (
        <div
          className="w-80 rounded-2xl border overflow-hidden"
          style={{
            background: "rgba(253, 248, 240, 0.97)",
            borderColor: "var(--brown-pale)",
            boxShadow: "0 8px 40px rgba(59, 42, 26, 0.16)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Шапка */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "var(--gradient-primary)" }}
          >
            <span className="text-white font-semibold text-sm">Поддержка T-Kit</span>
            <button onClick={handleClose} className="text-white opacity-80 hover:opacity-100 transition-opacity">
              <X size={16} />
            </button>
          </div>

          <div className="p-4">
            {done ? (
              <div className="flex flex-col items-center py-4 gap-2 text-center">
                <CheckCircle size={36} style={{ color: "var(--brown-light)" }} />
                <p className="font-semibold" style={{ color: "var(--brown-dark)" }}>
                  Сообщение отправлено!
                </p>
                <p className="text-sm" style={{ color: "var(--brown-mid)" }}>
                  Мы разберёмся и ответим вам.
                </p>
                <button
                  onClick={() => setDone(false)}
                  className="mt-2 text-sm underline"
                  style={{ color: "var(--brown-light)" }}
                >
                  Отправить ещё
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: "var(--brown-mid)" }}>
                  Нашли ошибку или есть вопрос? Напишите нам.
                </p>

                <input
                  type="email"
                  name="email"
                  placeholder="Ваш email (необязательно)"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{
                    borderColor: "var(--brown-pale)",
                    background: "var(--cream)",
                    color: "var(--brown-dark)",
                  }}
                />

                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder="Опишите проблему или вопрос..."
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                  style={{
                    borderColor: "var(--brown-pale)",
                    background: "var(--cream)",
                    color: "var(--brown-dark)",
                  }}
                />

                {error && <p className="text-xs text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{
                    background: "var(--gradient-primary)",
                    boxShadow: "var(--shadow-button)",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <Send size={14} />
                  {loading ? "Отправка..." : "Отправить"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Кнопка */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "0 4px 20px rgba(124, 92, 62, 0.40)",
        }}
        aria-label="Написать в поддержку"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
