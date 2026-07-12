"use client";

import { useState, useTransition } from "react";
import { markSupportReplied, unmarkSupportReplied, replySupportMessage } from "@/app/actions/support";

type Message = {
  id: string;
  email: string | null;
  message: string;
  created_at: string;
  replied_at: string | null;
  screenshots?: string[] | null;
};

export default function SupportInbox({ messages }: { messages: Message[] }) {
  const [localReplied, setLocalReplied] = useState<Set<string>>(new Set());
  const [localUnreplied, setLocalUnreplied] = useState<Set<string>>(new Set());
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (messages.length === 0) {
    return <p className="text-sm" style={{ color: "var(--brown-light)" }}>Обращений пока нет.</p>;
  }

  const openReply = (id: string) => {
    setReplyOpen(id);
    setReplyText("");
    setSendError(null);
  };

  const handleSendReply = async (msg: Message) => {
    if (!msg.email || !replyText.trim()) return;
    setSending(true);
    setSendError(null);
    const result = await replySupportMessage(msg.id, msg.email, replyText.trim(), msg.message);
    setSending(false);
    if (result?.error) {
      setSendError(result.error);
    } else {
      setLocalReplied(prev => new Set(prev).add(msg.id));
      setReplyOpen(null);
      setReplyText("");
    }
  };

  const handleUnmark = (id: string) => {
    setLocalUnreplied(prev => new Set(prev).add(id));
    startTransition(async () => {
      await unmarkSupportReplied(id);
    });
  };

  const handleMarkManual = (id: string, email: string, message: string) => {
    // Fallback for no-email messages: open mailto + mark
    const subject = encodeURIComponent("Ответ от поддержки T-Kit");
    const body = encodeURIComponent(`> ${message}\n\n`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-3">
      {messages.map(msg => {
        const isReplied = (msg.replied_at || localReplied.has(msg.id)) && !localUnreplied.has(msg.id);
        const isOpen = replyOpen === msg.id;
        const date = new Date(msg.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

        return (
          <div key={msg.id} className="rounded-xl border px-4 py-3"
            style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)", opacity: isReplied && !isOpen ? 0.65 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: "var(--brown-mid)" }}>{msg.email ?? "без email"}</span>
                  <span className="text-xs" style={{ color: "var(--brown-light)" }}>{date}</span>
                  {isReplied && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#e8f5e9", color: "#4a8a4a" }}>
                      ✓ отвечено
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--brown-dark)" }}>{msg.message}</p>
                {msg.screenshots && msg.screenshots.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {msg.screenshots.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Скрин ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          style={{ borderColor: "var(--brown-pale)" }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                {!isReplied && msg.email && (
                  <button
                    onClick={() => isOpen ? setReplyOpen(null) : openReply(msg.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                    style={{ background: isOpen ? "var(--brown-mid)" : "var(--gradient-primary)" }}>
                    {isOpen ? "Отмена" : "Ответить →"}
                  </button>
                )}
                {isReplied && (
                  <button
                    onClick={() => handleUnmark(msg.id)}
                    className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "transparent" }}>
                    ↩ Сбросить
                  </button>
                )}
              </div>
            </div>

            {/* Inline reply form */}
            {isOpen && msg.email && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--brown-pale)" }}>
                <div className="text-xs mb-1.5" style={{ color: "var(--brown-mid)" }}>
                  Кому: <strong>{msg.email}</strong>
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Введите ответ..."
                  rows={4}
                  className="w-full text-sm rounded-lg border outline-none resize-none"
                  style={{ padding: "8px 10px", borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" }}
                />
                {sendError && (
                  <p className="text-xs mt-1" style={{ color: "#c03030" }}>{sendError}</p>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setReplyOpen(null); setReplyText(""); setSendError(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "transparent" }}>
                    Отмена
                  </button>
                  <button
                    onClick={() => handleSendReply(msg)}
                    disabled={!replyText.trim() || sending}
                    className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--gradient-primary)", border: "none" }}>
                    {sending ? "Отправка..." : "Отправить письмо"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
