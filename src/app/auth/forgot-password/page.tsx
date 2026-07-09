"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import TKitLogo from "@/components/TKitLogo";
import { GraduationCap, BookOpen, Star, Feather, PenLine } from "lucide-react";

const BG_ICONS = [
  { top: "5%",  left: "3%",   size: 72, opacity: 0.10, rotate: -18 },
  { top: "10%", right: "4%",  size: 56, opacity: 0.09, rotate:  22 },
  { top: "30%", left: "1%",   size: 48, opacity: 0.08, rotate:   8 },
  { top: "25%", right: "2%",  size: 80, opacity: 0.07, rotate: -12 },
  { top: "65%", left: "4%",   size: 60, opacity: 0.09, rotate:  14 },
  { top: "70%", right: "3%",  size: 50, opacity: 0.08, rotate: -22 },
  { top: "85%", left: "10%",  size: 44, opacity: 0.07, rotate:   5 },
  { top: "80%", right: "8%",  size: 64, opacity: 0.09, rotate:  -8 },
];
const ICONS = [GraduationCap, BookOpen, Star, Feather, PenLine, GraduationCap, Star, BookOpen];

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) { setError("Ошибка отправки. Проверьте email."); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--background)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(to bottom, transparent 0px, transparent 27px,
            rgba(180, 145, 90, 0.18) 27px, rgba(180, 145, 90, 0.18) 28px),
          linear-gradient(to right, transparent 58px,
            rgba(210, 130, 120, 0.20) 58px, rgba(210, 130, 120, 0.20) 59.5px, transparent 59.5px)`,
        backgroundSize: "100% 28px, 100% 100%",
      }} />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {BG_ICONS.map((pos, i) => {
          const Icon = ICONS[i];
          return (
            <div key={i} className="absolute" style={{
              top: pos.top,
              left:  "left"  in pos ? (pos as { left: string }).left  : undefined,
              right: "right" in pos ? (pos as { right: string }).right : undefined,
              transform: `rotate(${pos.rotate}deg)`,
              color: "var(--brown-mid)", opacity: pos.opacity,
            }}>
              <Icon size={pos.size} strokeWidth={1.4} />
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <TKitLogo size="lg" subtitle />
          <p className="mt-3 text-sm" style={{ color: "var(--brown-mid)" }}>Восстановление пароля</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{
          background: "rgba(253, 248, 240, 0.93)",
          borderColor: "var(--brown-pale)",
          boxShadow: "var(--shadow-card)",
          backdropFilter: "blur(6px)",
        }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="font-medium" style={{ color: "var(--brown-dark)" }}>Письмо отправлено</p>
              <p className="text-sm" style={{ color: "var(--brown-mid)" }}>
                Если этот email зарегистрирован, вы получите письмо с инструкциями по сбросу пароля.
              </p>
              <Link href="/auth/login"
                className="block mt-4 text-sm font-semibold hover:underline"
                style={{ color: "var(--brown-dark)" }}>
                ← Вернуться к входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm mb-4" style={{ color: "var(--brown-mid)" }}>
                Введите email — мы пришлём ссылку для сброса пароля.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                  Email
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border outline-none"
                  style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }} />
              </div>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all mt-2"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Отправляем..." : "Отправить инструкции"}
              </button>
              <p className="text-center text-sm mt-3">
                <Link href="/auth/login" className="hover:underline" style={{ color: "var(--brown-mid)" }}>
                  ← Вернуться к входу
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
