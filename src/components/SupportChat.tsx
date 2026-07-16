"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, CheckCircle, Paperclip, ChevronLeft } from "lucide-react";
import { submitSupportMessage, getTutorSupportMessages } from "@/app/actions/support";

type SupportMsg = {
  id: string;
  message: string;
  created_at: string;
  reply_text?: string | null;
  replied_at?: string | null;
  screenshots?: string[] | null;
};

type Tab = "thread" | "new";

function SupportPopup({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("thread");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [history, setHistory] = useState<SupportMsg[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const msgs = await getTutorSupportMessages();
    setHistory(msgs as SupportMsg[]);
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

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
      // Refresh history after sending
      await loadHistory();
    }
  }

  const hasUnread = history?.some(m => m.reply_text && !m.replied_at) ?? false;

  return (
    <div className="w-80 rounded-2xl border overflow-hidden"
      style={{
        background: "rgba(253, 248, 240, 0.97)",
        borderColor: "var(--brown-pale)",
        boxShadow: "0 8px 40px rgba(59, 42, 26, 0.16)",
        backdropFilter: "blur(8px)",
      }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--gradient-primary)" }}>
        <span className="text-white font-semibold text-sm">Поддержка T-Kit</span>
        <button onClick={onClose} className="text-white opacity-80 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--brown-pale)" }}>
        <button onClick={() => setTab("thread")}
          className="flex-1 py-2 text-xs font-medium transition-colors relative"
          style={{
            color: tab === "thread" ? "var(--brown-dark)" : "var(--brown-light)",
            borderBottom: tab === "thread" ? "2px solid var(--brown-mid)" : "2px solid transparent",
          }}>
          Мои обращения
          {hasUnread && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-top mt-1" />}
        </button>
        <button onClick={() => { setTab("new"); setDone(false); }}
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={{
            color: tab === "new" ? "var(--brown-dark)" : "var(--brown-light)",
            borderBottom: tab === "new" ? "2px solid var(--brown-mid)" : "2px solid transparent",
          }}>
          Написать
        </button>
      </div>

      {/* Content */}
      <div className="p-4" style={{ maxHeight: "min(400px, calc(100dvh - 180px))", overflowY: "auto" }}>

        {/* Thread tab */}
        {tab === "thread" && (
          <div className="flex flex-col gap-3">
            {historyLoading && (
              <p className="text-xs text-center py-4" style={{ color: "var(--brown-light)" }}>Загрузка...</p>
            )}
            {!historyLoading && (!history || history.length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm mb-2" style={{ color: "var(--brown-mid)" }}>Обращений пока нет</p>
                <button onClick={() => setTab("new")} className="text-xs underline" style={{ color: "var(--brown-light)" }}>
                  Написать в поддержку →
                </button>
              </div>
            )}
            {history?.map(msg => {
              const date = new Date(msg.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
              return (
                <div key={msg.id} className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ background: "white", border: "1px solid var(--brown-pale)" }}>
                  {/* User message */}
                  <div>
                    <div className="text-xs mb-1" style={{ color: "var(--brown-light)" }}>{date}</div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--brown-dark)" }}>{msg.message}</p>
                    {msg.screenshots && msg.screenshots.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {msg.screenshots.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" className="w-12 h-12 object-cover rounded-lg border"
                              style={{ borderColor: "var(--brown-pale)" }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reply */}
                  {msg.reply_text ? (
                    <div className="pl-2 border-l-2" style={{ borderColor: "#8060d0" }}>
                      <div className="text-xs mb-0.5 font-semibold" style={{ color: "#8060d0" }}>Ответ поддержки</div>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--brown-dark)" }}>{msg.reply_text}</p>
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: "var(--brown-light)" }}>Ожидает ответа...</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* New message tab */}
        {tab === "new" && (
          <>
            {done ? (
              <div className="flex flex-col items-center py-4 gap-2 text-center">
                <CheckCircle size={36} style={{ color: "var(--brown-light)" }} />
                <p className="font-semibold" style={{ color: "var(--brown-dark)" }}>Сообщение отправлено!</p>
                <p className="text-sm" style={{ color: "var(--brown-mid)" }}>Ответ появится в разделе «Мои обращения».</p>
                <button onClick={() => { setDone(false); setTab("thread"); }}
                  className="mt-2 text-sm underline" style={{ color: "var(--brown-light)" }}>
                  Посмотреть обращения →
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

                {screenshots.length < 3 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
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
          </>
        )}
      </div>
    </div>
  );
}

export function SupportChatButton({ dropUp = false }: { dropUp?: boolean }) {
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
        <div className={`absolute right-0 z-[200] ${dropUp ? "bottom-full mb-2" : "top-full mt-2"}`}>
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
