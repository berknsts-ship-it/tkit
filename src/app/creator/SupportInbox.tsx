"use client";

import { useState, useTransition } from "react";
import { replyToSupport } from "@/app/actions/support";

type Message = {
  id: string;
  email: string | null;
  message: string;
  created_at: string;
  replied_at: string | null;
};

export default function SupportInbox({ messages }: { messages: Message[] }) {
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (messages.length === 0) {
    return <p className="text-sm" style={{ color: "var(--brown-light)" }}>Обращений пока нет.</p>;
  }

  function handleReply(msg: Message) {
    if (!replyText.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await replyToSupport(msg.id, msg.email!, replyText.trim());
      if (res?.error) {
        setError(res.error);
      } else {
        setSent(prev => new Set(prev).add(msg.id));
        setReplyingId(null);
        setReplyText("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map(msg => {
        const isReplying = replyingId === msg.id;
        const isSent = sent.has(msg.id);
        const date = new Date(msg.created_at).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
        const repliedDate = msg.replied_at
          ? new Date(msg.replied_at).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })
          : null;

        return (
          <div key={msg.id} className="rounded-xl border px-4 py-3"
            style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)",
              opacity: (isSent || repliedDate) ? 0.7 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: "var(--brown-mid)" }}>
                    {msg.email ?? "без email"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--brown-light)" }}>{date}</span>
                  {(isSent || repliedDate) && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#e8f5e9", color: "#4a8a4a" }}>
                      ✓ отвечено {repliedDate ?? "только что"}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--brown-dark)" }}>{msg.message}</p>
              </div>
              {msg.email && !isSent && !repliedDate && (
                <button
                  onClick={() => { setReplyingId(isReplying ? null : msg.id); setReplyText(""); setError(null); }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all"
                  style={{
                    borderColor: isReplying ? "var(--brown-dark)" : "var(--brown-pale)",
                    background: isReplying ? "var(--brown-pale)" : "transparent",
                    color: "var(--brown-dark)",
                  }}>
                  {isReplying ? "Отмена" : "Ответить"}
                </button>
              )}
            </div>

            {isReplying && (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                  placeholder={`Ответ для ${msg.email}...`}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  onClick={() => handleReply(msg)}
                  disabled={isPending || !replyText.trim()}
                  className="self-end text-sm px-4 py-1.5 rounded-xl font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--gradient-primary)" }}>
                  {isPending ? "Отправка..." : "Отправить ответ"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
