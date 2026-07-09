"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("message") === "password_reset") {
      setSuccess("Пароль успешно изменён. Войдите с новым паролем.");
    }
  }, [searchParams]);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("Неверный email или пароль"); setLoading(false); }
    else router.push("/tutor/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--background)" }}>

      {/* Паттерн линеек */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(to bottom,
            transparent 0px, transparent 27px,
            rgba(180, 145, 90, 0.18) 27px, rgba(180, 145, 90, 0.18) 28px
          ),
          linear-gradient(to right,
            transparent 58px,
            rgba(210, 130, 120, 0.20) 58px, rgba(210, 130, 120, 0.20) 59.5px,
            transparent 59.5px
          )
        `,
        backgroundSize: "100% 28px, 100% 100%",
      }} />

      {/* Плавающие иконки */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {BG_ICONS.map((pos, i) => {
          const Icon = ICONS[i];
          return (
            <div key={i} className="absolute" style={{
              top:       pos.top,
              left:      "left"  in pos ? (pos as { left: string }).left  : undefined,
              right:     "right" in pos ? (pos as { right: string }).right : undefined,
              transform: `rotate(${pos.rotate}deg)`,
              color:     "var(--brown-mid)",
              opacity:   pos.opacity,
            }}>
              <Icon size={pos.size} strokeWidth={1.4} />
            </div>
          );
        })}
      </div>

      {/* Карточка */}
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <TKitLogo size="lg" subtitle />
          <p className="mt-3 text-sm" style={{ color: "var(--brown-mid)" }}>Вход для репетитора</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{
          background:  "rgba(253, 248, 240, 0.93)",
          borderColor: "var(--brown-pale)",
          boxShadow:   "var(--shadow-card)",
          backdropFilter: "blur(6px)",
        }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 rounded-xl border outline-none transition-colors"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium" style={{ color: "var(--brown-mid)" }}>
                  Пароль
                </label>
                <Link href="/auth/forgot-password"
                  className="text-xs hover:underline"
                  style={{ color: "var(--brown-light)" }}>
                  Забыли пароль?
                </Link>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border outline-none transition-colors"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }} />
            </div>

            {success && <p className="text-sm text-center font-medium" style={{ color: "#2a7a3a" }}>{success}</p>}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all mt-2"
              style={{
                background:  "var(--gradient-primary)",
                boxShadow:   "var(--shadow-button)",
                opacity:     loading ? 0.7 : 1,
              }}>
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm" style={{ color: "var(--brown-mid)" }}>
            <p>
              Нет аккаунта?{" "}
              <Link href="/auth/register" className="font-semibold hover:underline"
                style={{ color: "var(--brown-dark)" }}>
                Зарегистрироваться
              </Link>
            </p>
            <p>
              <Link href="/student" className="hover:underline" style={{ color: "var(--brown-light)" }}>
                Я ученик →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
