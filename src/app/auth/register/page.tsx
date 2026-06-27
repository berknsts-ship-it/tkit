"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, Globe, Languages, Feather, PenLine, Scroll,
  Calculator, Atom, FlaskConical, Microscope, Zap, Binary,
  Landmark, Map, Compass, GraduationCap, Star,
} from "lucide-react";
import TKitLogo from "@/components/TKitLogo";

const THEMES = {
  default: {
    bg: "#fdf8f0",
    dark: "#3b2a1a",
    mid: "#7c5c3e",
    pale: "#e8d5b7",
    cardBg: "rgba(253, 248, 240, 0.92)",
    gradient: "linear-gradient(135deg, #7c5c3e 0%, #b8956a 100%)",
    shadow: "rgba(124, 92, 62, 0.35)",
    bgPattern: "lines" as const,
    lineColor: "rgba(180, 145, 90, 0.20)",
    marginColor: "rgba(210, 130, 120, 0.22)",
  },
  warm: {
    bg: "#FDF0EB",
    dark: "#5C3030",
    mid: "#967878",
    pale: "#F0CCB8",
    cardBg: "rgba(253, 245, 240, 0.93)",
    gradient: "linear-gradient(135deg, #967878 0%, #E08878 100%)",
    shadow: "rgba(192, 96, 96, 0.30)",
    bgPattern: "lines" as const,
    lineColor: "rgba(224, 136, 120, 0.20)",
    marginColor: "rgba(224, 136, 120, 0.28)",
  },
  cool: {
    bg: "#EEF2F8",
    dark: "#2D3250",
    mid: "#7B8DB0",
    pale: "#C8D4E8",
    cardBg: "rgba(240, 244, 252, 0.93)",
    gradient: "linear-gradient(135deg, #3D3B5C 0%, #7B8DB0 100%)",
    shadow: "rgba(61, 59, 92, 0.30)",
    bgPattern: "grid" as const,
    lineColor: "rgba(123, 141, 176, 0.22)",
    marginColor: "rgba(123, 141, 176, 0.22)",
  },
  humanities: {
    bg: "#F5F0E4",
    dark: "#3D2D14",
    mid: "#8A6A40",
    pale: "#E0CCA0",
    cardBg: "rgba(250, 245, 234, 0.93)",
    gradient: "linear-gradient(135deg, #5C3D18 0%, #A87840 100%)",
    shadow: "rgba(92, 61, 24, 0.30)",
    bgPattern: "lines" as const,
    lineColor: "rgba(168, 120, 64, 0.20)",
    marginColor: "rgba(168, 120, 64, 0.26)",
  },
};

type ThemeKey = keyof typeof THEMES;

const SUBJECT_THEME: Record<string, ThemeKey> = {
  "Русский язык": "warm",
  "Иностранный язык": "warm",
  "Литература": "warm",
  "Математика": "cool",
  "Физика": "cool",
  "Химия": "cool",
  "Биология": "cool",
  "Информатика": "cool",
  "История и обществознание": "humanities",
  "Другое": "default",
};

const SUBJECT_ICONS: Record<ThemeKey, React.ElementType[]> = {
  warm: [BookOpen, Globe, Languages, Feather, PenLine, Scroll, BookOpen, Languages],
  cool: [Calculator, Atom, FlaskConical, Microscope, Zap, Binary, Calculator, Atom],
  humanities: [Landmark, Map, Compass, Scroll, Globe, BookOpen, Landmark, Map],
  default: [GraduationCap, BookOpen, Star, Feather, PenLine, GraduationCap, Star, BookOpen],
};

const ICON_POSITIONS = [
  { top: "5%",  left: "3%",   size: 72, opacity: 0.12, rotate: -18 },
  { top: "10%", right: "4%",  size: 56, opacity: 0.10, rotate:  22 },
  { top: "30%", left: "1%",   size: 48, opacity: 0.09, rotate:   8 },
  { top: "25%", right: "2%",  size: 80, opacity: 0.08, rotate: -12 },
  { top: "54%", left: "4%",   size: 60, opacity: 0.10, rotate:  14 },
  { top: "60%", right: "3%",  size: 50, opacity: 0.09, rotate: -22 },
  { top: "76%", left: "8%",   size: 44, opacity: 0.08, rotate:   5 },
  { top: "80%", right: "6%",  size: 64, opacity: 0.11, rotate: -8  },
  { top: "90%", left: "28%",  size: 40, opacity: 0.07, rotate:  16 },
  { top: "3%",  left: "44%",  size: 52, opacity: 0.07, rotate: -5  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const themeKey: ThemeKey = subject ? (SUBJECT_THEME[subject] ?? "default") : "default";
  const theme = THEMES[themeKey];
  const icons = SUBJECT_ICONS[themeKey];

  async function doRegister() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      console.error("Supabase signUp error:", error, error.message, error.status, error.name);
      const msg = error.message
        || (error as unknown as Record<string, unknown>).error_description as string
        || `${error.name ?? "Error"} (status ${error.status ?? "?"})`
        || "Ошибка регистрации";
      setError(msg);
      setLoading(false);
      return;
    }

    // Email подтверждение включено — сессии ещё нет
    if (data.user && !data.session) {
      setError("✉️ Подтвердите email: мы отправили письмо на " + email);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Создаём запись репетитора вручную (без триггера)
      await supabase.from("tutors").upsert({
        id: data.user.id,
        email,
        name: name || email.split("@")[0],
        subject: subject || null,
      });
    }

    router.push("/tutor/dashboard");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: theme.bg,
        transition: "background 0.7s ease",
      }}
    >
      {/* Фоновый паттерн: клетка для технических, линейки для остальных */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={theme.bgPattern === "grid" ? {
          backgroundImage: `
            repeating-linear-gradient(to right,  ${theme.lineColor} 0px, ${theme.lineColor} 1px, transparent 1px, transparent 28px),
            repeating-linear-gradient(to bottom, ${theme.lineColor} 0px, ${theme.lineColor} 1px, transparent 1px, transparent 28px)
          `,
          backgroundSize: "28px 28px",
          transition: "background-image 0.7s ease",
        } : {
          backgroundImage: `
            repeating-linear-gradient(
              to bottom,
              transparent 0px, transparent 27px,
              ${theme.lineColor} 27px, ${theme.lineColor} 28px
            ),
            linear-gradient(
              to right,
              transparent 58px,
              ${theme.marginColor} 58px, ${theme.marginColor} 59.5px,
              transparent 59.5px
            )
          `,
          backgroundSize: "100% 28px, 100% 100%",
          transition: "background-image 0.7s ease",
        }}
      />

      {/* Плавающие иконки фона */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {ICON_POSITIONS.map((pos, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div
              key={i}
              className="absolute"
              style={{
                top: pos.top,
                left: "left" in pos ? pos.left : undefined,
                right: "right" in pos ? pos.right : undefined,
                transform: `rotate(${pos.rotate}deg)`,
                color: theme.mid,
                opacity: pos.opacity,
                transition: "color 0.7s ease, opacity 0.7s ease",
              }}
            >
              <Icon size={pos.size} strokeWidth={1.5} />
            </div>
          );
        })}
      </div>

      {/* Карточка */}
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <TKitLogo size="lg" gradient={theme.gradient} color={theme.dark} transition />
          <p className="mt-2" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
            Регистрация репетитора
          </p>
        </div>

        <div
          className="rounded-2xl p-8 border"
          style={{
            background: theme.cardBg,
            borderColor: theme.pale,
            boxShadow: `0 2px 24px ${theme.shadow.replace("0.30", "0.10")}`,
            transition: "background 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease",
            backdropFilter: "blur(4px)",
          }}
        >
          <form onSubmit={e => { e.preventDefault(); doRegister(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
                Ваше имя
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Как вас зовут"
                className="w-full px-4 py-2 rounded-xl border outline-none focus:ring-2"
                style={{
                  borderColor: theme.pale,
                  background: theme.bg,
                  color: theme.dark,
                  transition: "border-color 0.7s ease, background 0.7s ease",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
                Предмет
              </label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{
                  borderColor: theme.pale,
                  background: theme.bg,
                  color: subject ? theme.dark : theme.mid,
                  transition: "border-color 0.7s ease, background 0.7s ease, color 0.7s ease",
                }}
              >
                <option value="" disabled>Выберите предмет</option>
                <option value="Русский язык">Русский язык</option>
                <option value="Иностранный язык">Иностранный язык</option>
                <option value="Математика">Математика</option>
                <option value="Физика">Физика</option>
                <option value="История и обществознание">История и обществознание</option>
                <option value="Химия">Химия</option>
                <option value="Биология">Биология</option>
                <option value="Информатика">Информатика</option>
                <option value="Литература">Литература</option>
                <option value="Другое">Другое</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{
                  borderColor: theme.pale,
                  background: theme.bg,
                  color: theme.dark,
                  transition: "border-color 0.7s ease, background 0.7s ease",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{
                  borderColor: theme.pale,
                  background: theme.bg,
                  color: theme.dark,
                  transition: "border-color 0.7s ease, background 0.7s ease",
                }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all"
              style={{
                background: theme.gradient,
                boxShadow: `0 2px 10px ${theme.shadow}`,
                opacity: loading ? 0.7 : 1,
                transition: "background 0.7s ease, box-shadow 0.7s ease",
              }}
            >
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </form>

          <p className="text-center mt-4 text-sm" style={{ color: theme.mid, transition: "color 0.7s ease" }}>
            Уже есть аккаунт?{" "}
            <Link
              href="/auth/login"
              className="font-semibold"
              style={{ color: theme.mid }}
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
