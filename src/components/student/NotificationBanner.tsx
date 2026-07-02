"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markNotificationRead } from "@/app/actions/notifications";

interface Notif { id: string; title: string; body: string; }

export default function NotificationBanner({
  studentId,
  notifications,
}: {
  studentId: string;
  notifications: Notif[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = notifications.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;
  const n = visible[0];

  const handleRead = () => {
    startTransition(async () => {
      await markNotificationRead(n.id, studentId);
      setDismissed(prev => new Set([...prev, n.id]));
    });
  };

  return (
    <div
      className="fixed left-0 right-0 z-[999] px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div
          className="rounded-2xl border p-4"
          style={{
            background: "white",
            borderColor: "var(--brown-pale)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Bell size={16} style={{ color: "white" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug" style={{ color: "var(--brown-dark)" }}>
                {n.title}
              </p>
              <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--brown-mid)" }}>
                {n.body}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 ml-12">
            <button
              onClick={handleRead}
              disabled={pending}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              {pending ? "..." : "Прочитано ✓"}
            </button>
            {visible.length > 1 && (
              <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                + ещё {visible.length - 1}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
