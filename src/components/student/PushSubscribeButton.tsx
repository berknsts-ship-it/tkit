"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

export default function PushSubscribeButton({ studentId }: { studentId: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported"); return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.register("/sw.js").then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setState(sub ? "subscribed" : "unsubscribed");
      });
    }).catch(err => {
      setErrMsg("SW: " + String(err));
      setState("unsubscribed");
    });
  }, []);

  const subscribe = async () => {
    setState("loading");
    setErrMsg(null);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setErrMsg("VAPID key not set");
        setState("unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subscription: sub.toJSON() }),
      });
      if (!res.ok) { setErrMsg("API error: " + res.status); setState("unsubscribed"); return; }
      setState("subscribed");
    } catch (err) {
      setErrMsg(String(err));
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

  return (
    <div className="flex flex-col gap-1">
      {state === "unsupported" ? null
        : state === "loading" ? (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl opacity-40"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
            <Bell size={13}/> Уведомления
          </div>
        ) : state === "denied" ? (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}>
            <BellOff size={13}/> Заблокированы
          </div>
        ) : state === "subscribed" ? (
          <button onClick={unsubscribe}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.9)" }}>
            <BellRing size={13}/> Уведомления включены
          </button>
        ) : (
          <button onClick={subscribe}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
            <Bell size={13}/> Включить уведомления
          </button>
        )}
      {errMsg && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,0,0,0.3)", color: "white", maxWidth: 220, wordBreak: "break-all" }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}
