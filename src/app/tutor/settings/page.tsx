"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveBoardProfile } from "@/app/actions/settings";
import { generateTelegramLink, unlinkTelegram, updateNotifyChannels } from "@/app/actions/telegram";
import { Check, LayoutTemplate, Bell, Copy, ExternalLink } from "lucide-react";

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

const CHANNELS = [
  { key: "telegram", label: "Telegram",  desc: "Через бота T-Kit" },
  { key: "push",     label: "Push",      desc: "В браузере / на телефоне" },
];

export default function SettingsPage() {
  const [subjectProfile, setSubjectProfile] = useState("other");
  const [boardBg,        setBoardBg]        = useState("dots");
  const [loading,        setLoading]        = useState(true);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savedProfile,   setSavedProfile]   = useState(false);
  const [errorProfile,   setErrorProfile]   = useState<string | null>(null);

  // Notifications
  const [telegramChatId,   setTelegramChatId]   = useState<string | null>(null);
  const [notifyChannels,   setNotifyChannels]    = useState<Record<string, boolean>>({ telegram: true, push: true });
  const [tgLinkUrl,        setTgLinkUrl]         = useState<string | null>(null);
  const [tgLinkLoading,    setTgLinkLoading]     = useState(false);
  const [tgCopied,         setTgCopied]          = useState(false);
  const [unlinkLoading,    setUnlinkLoading]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("tutors")
        .select("subject_profile, board_bg, telegram_chat_id, notify_channels")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setSubjectProfile(data?.subject_profile ?? "other");
          setBoardBg(data?.board_bg ?? "dots");
          setTelegramChatId(data?.telegram_chat_id ?? null);
          setNotifyChannels(data?.notify_channels ?? { telegram: true, push: true });
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

  async function handleGenerateTgLink() {
    setTgLinkLoading(true);
    const res = await generateTelegramLink();
    setTgLinkLoading(false);
    if ("error" in res) return;
    setTgLinkUrl(res.url);
  }

  async function handleUnlink() {
    setUnlinkLoading(true);
    await unlinkTelegram();
    setTelegramChatId(null);
    setTgLinkUrl(null);
    setUnlinkLoading(false);
  }

  const handleToggleChannel = useCallback(async (key: string, val: boolean) => {
    const next = { ...notifyChannels, [key]: val };
    setNotifyChannels(next);
    updateNotifyChannels(next).catch(() => {});
  }, [notifyChannels]);

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => { setTgCopied(true); setTimeout(() => setTgCopied(false), 2000); });
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

      {/* Уведомления */}
      <div className="rounded-2xl border p-6" style={card}>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} style={{ color: "var(--brown-mid)" }} />
          <h2 className="font-semibold" style={{ color: "var(--brown-dark)" }}>Уведомления</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--brown-pale)" }} />
            <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--brown-pale)" }} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Telegram connection */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--brown-pale)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--brown-dark)" }}>
                    Telegram
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--brown-mid)" }}>
                    {telegramChatId ? "✓ Подключён" : "Не подключён"}
                  </p>
                </div>
                {telegramChatId ? (
                  <button onClick={handleUnlink} disabled={unlinkLoading}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                    style={{ borderColor: "var(--brown-light)", color: "var(--brown-mid)", opacity: unlinkLoading ? 0.6 : 1 }}>
                    {unlinkLoading ? "..." : "Отвязать"}
                  </button>
                ) : tgLinkUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={tgLinkUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white"
                      style={{ background: "#229ED9" }}>
                      <ExternalLink size={12}/> Открыть бота
                    </a>
                    <button onClick={() => copyLink(tgLinkUrl)}
                      className="text-xs px-2 py-1.5 rounded-lg border transition-all"
                      style={{ borderColor: "var(--brown-light)", color: "var(--brown-mid)" }}>
                      {tgCopied ? <Check size={12}/> : <Copy size={12}/>}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGenerateTgLink} disabled={tgLinkLoading}
                    className="text-xs px-3 py-1.5 rounded-lg text-white"
                    style={{ background: "#229ED9", opacity: tgLinkLoading ? 0.7 : 1 }}>
                    {tgLinkLoading ? "..." : "Подключить"}
                  </button>
                )}
              </div>
              {tgLinkUrl && !telegramChatId && (
                <p className="text-xs" style={{ color: "var(--brown-mid)" }}>
                  Ссылка действительна 15 минут. Нажми «Открыть бота» и отправь /start.
                </p>
              )}
            </div>

            {/* Channel toggles */}
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "var(--brown-mid)" }}>
                Каналы
              </p>
              <div className="space-y-2">
                {CHANNELS.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{label}</p>
                      <p className="text-xs" style={{ color: "var(--brown-mid)" }}>{desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggleChannel(key, !notifyChannels[key])}
                      className="relative w-11 h-6 rounded-full transition-colors duration-200"
                      style={{ background: notifyChannels[key] ? "var(--brown-dark)" : "var(--brown-pale)" }}>
                      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: notifyChannels[key] ? "translateX(20px)" : "translateX(0)" }} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--brown-light)" }}>
                Уведомления придут во все включённые каналы
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
