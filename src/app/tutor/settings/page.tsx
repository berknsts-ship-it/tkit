"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveMeetingUrl } from "@/app/actions/settings";
import { Video, Check } from "lucide-react";

export default function SettingsPage() {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("tutors").select("meeting_url").eq("id", user.id).single()
        .then(({ data }) => {
          setMeetingUrl(data?.meeting_url ?? "");
          setLoading(false);
        });
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await saveMeetingUrl(meetingUrl);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--brown-dark)" }}>Настройки</h1>

      <div className="rounded-2xl border p-6" style={card}>
        <div className="flex items-center gap-2 mb-4">
          <Video size={18} style={{ color: "var(--brown-mid)" }} />
          <h2 className="font-semibold" style={{ color: "var(--brown-dark)" }}>Ссылка на видеозвонок</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--brown-mid)" }}>
          Введите постоянную ссылку для занятий — Zoom, Google Meet, Яндекс Телемост, Teams или любую другую.
          Ученик увидит кнопку «Войти на урок» за 15 минут до занятия.
        </p>
        {loading ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--brown-pale)" }} />
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <input
              type="url"
              value={meetingUrl}
              onChange={e => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm"
              style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)", opacity: saving ? 0.7 : 1 }}>
              {saved ? <><Check size={15}/> Сохранено</> : saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
