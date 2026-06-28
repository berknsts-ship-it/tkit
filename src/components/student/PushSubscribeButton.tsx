"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

export default function PushSubscribeButton({ studentId }: { studentId: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported"); return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.register("/sw.js").then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setState(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  const subscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subscription: sub.toJSON() }),
      });
      setState("subscribed");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "unsubscribed");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, endpoint: sub.endpoint }),
      });
    }
    setState("unsubscribed");
  };

  if (state === "loading" || state === "unsupported") return null;

  if (state === "denied") return (
    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
      <BellOff size={13}/> Уведомления заблокированы
    </div>
  );

  if (state === "subscribed") return (
    <button onClick={unsubscribe}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
      style={{ background: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.9)" }}>
      <BellRing size={13}/> Уведомления включены
    </button>
  );

  return (
    <button onClick={subscribe}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
      style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
      <Bell size={13}/> Включить уведомления
    </button>
  );
}
