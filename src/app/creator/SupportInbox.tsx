"use client";

import { useState, useTransition } from "react";
import { markSupportReplied } from "@/app/actions/support";

type Message = {
  id: string;
  email: string | null;
  message: string;
  created_at: string;
  replied_at: string | null;
};

export default function SupportInbox({ messages }: { messages: Message[] }) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  if (messages.length === 0) {
    return <p className="text-sm" style={{ color: "var(--brown-light)" }}>Обращений пока нет.</p>;
  }

  function handleReply(id: string, email: string, message: string) {
    const subject = encodeURIComponent("Ответ от поддержки T-Kit");
    const body = encodeURIComponent(`> ${message}\n\n`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
    startTransition(async () => {
      await markSupportReplied(id);
      setSent(prev => new Set(prev).add(id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map(msg => {
        const isSent = sent.has(msg.id);
        const date = new Date(msg.created_at).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
        const replied = msg.replied_at || isSent;

        return (
          <div key={msg.id} className="rounded-xl border px-4 py-3"
            style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)", opacity: replied ? 0.65 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: "var(--brown-mid)" }}>{msg.email ?? "без email"}</span>
                  <span className="text-xs" style={{ color: "var(--brown-light)" }}>{date}</span>
                  {replied && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#e8f5e9", color: "#4a8a4a" }}>
                      ✓ отвечено
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--brown-dark)" }}>{msg.message}</p>
              </div>
              {msg.email && !replied && (
                <button
                  onClick={() => handleReply(msg.id, msg.email!, msg.message)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                  style={{ background: "var(--gradient-primary)" }}>
                  Ответить →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
