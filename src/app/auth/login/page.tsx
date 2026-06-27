"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TKitLogo from "@/components/TKitLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Неверный email или пароль");
      setLoading(false);
    } else {
      router.push("/tutor/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <TKitLogo size="lg" />
          <p className="mt-2" style={{ color: "var(--brown-mid)" }}>Вход для репетитора</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{
          background: "rgba(253, 248, 240, 0.9)",
          borderColor: "var(--brown-pale)",
          boxShadow: "var(--shadow-card)",
        }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-button)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>

          <p className="text-center mt-4 text-sm" style={{ color: "var(--brown-mid)" }}>
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="font-semibold" style={{ color: "var(--brown-mid)" }}>
              Зарегистрироваться
            </Link>
          </p>

          <p className="text-center mt-2 text-sm" style={{ color: "var(--brown-mid)" }}>
            <Link href="/student" style={{ color: "var(--brown-mid)" }}>
              Я ученик →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
