"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveBoardProfile } from "@/app/actions/settings";
import { Check, LayoutTemplate } from "lucide-react";

const SUBJECT_PROFILES = [
  { v: "english",  label: "Английский язык",  icon: "🇬🇧" },
  { v: "math",     label: "Математика",        icon: "📐" },
  { v: "physics",  label: "Физика",            icon: "⚡" },
  { v: "cs",       label: "Информатика",       icon: "💻" },
  { v: "other",    label: "Другой предмет",    icon: "✏️" },
];

const BOARD_BGS = [
  { v: "dots",  label: "Точки",   icon: "·  ·  ·" },
  { v: "grid",  label: "Клетка",  icon: "⊞" },
  { v: "lines", label: "Линейка", icon: "≡" },
  { v: "blank", label: "Чистый",  icon: "□" },
];

export default function SettingsPage() {
  const [subjectProfile, setSubjectProfile] = useState("other");
  const [boardBg,        setBoardBg]        = useState("dots");
  const [loading,        setLoading]        = useState(true);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savedProfile,   setSavedProfile]   = useState(false);
  const [errorProfile,   setErrorProfile]   = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("tutors")
        .select("subject_profile, board_bg")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setSubjectProfile(data?.subject_profile ?? "other");
          setBoardBg(data?.board_bg ?? "dots");
          setLoading(false);
        });
    });
  }, []);

  async function handleSaveProfile() {
    setSavingProfile(true); setErrorProfile(null); setSavedProfile(false);
    const res = await saveBoardProfile(subjectProfile, boardBg);
    setSavingProfile(false);
    if (res.error) { setErrorProfile(res.error); return; }
    setSavedProfile(true); setTimeout(() => setSavedProfile(false), 3000);
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--brown-dark)" }}>Настройки</h1>

      {/* Профиль доски */}
      <div className="rounded-2xl border p-6" style={card}>
        <div className="flex items-center gap-2 mb-4">
          <LayoutTemplate size={18} style={{ color: "var(--brown-mid)" }} />
          <h2 className="font-semibold" style={{ color: "var(--brown-dark)" }}>Профиль доски</h2>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--brown-mid)" }}>
          Предмет определяет набор инструментов на доске. Фон задаёт умолчание при открытии.
        </p>
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 rounded-xl animate-pulse" style={{ background: "var(--brown-pale)" }} />
            <div className="h-8 rounded-xl animate-pulse" style={{ background: "var(--brown-pale)" }} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Предмет */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--brown-mid)" }}>Предмет</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUBJECT_PROFILES.map(p => (
                  <button key={p.v} onClick={() => setSubjectProfile(p.v)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all"
                    style={{
                      borderColor: subjectProfile === p.v ? "var(--brown-dark)" : "var(--brown-pale)",
                      background:  subjectProfile === p.v ? "var(--brown-pale)" : "transparent",
                      color:       "var(--brown-dark)",
                      fontWeight:  subjectProfile === p.v ? 600 : 400,
                    }}>
                    <span>{p.icon}</span><span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Фон */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--brown-mid)" }}>Фон доски</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BOARD_BGS.map(b => (
                  <button key={b.v} onClick={() => setBoardBg(b.v)}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl border text-sm transition-all"
                    style={{
                      borderColor: boardBg === b.v ? "var(--brown-dark)" : "var(--brown-pale)",
                      background:  boardBg === b.v ? "var(--brown-pale)" : "transparent",
                      color:       "var(--brown-dark)",
                      fontWeight:  boardBg === b.v ? 600 : 400,
                    }}>
                    <span className="text-base font-mono">{b.icon}</span>
                    <span className="text-xs">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {errorProfile && <p className="text-sm text-red-600">{errorProfile}</p>}
            <button onClick={handleSaveProfile} disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)", opacity: savingProfile ? 0.7 : 1 }}>
              {savedProfile ? <><Check size={15}/> Сохранено</> : savingProfile ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
