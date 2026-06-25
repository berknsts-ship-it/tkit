"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/tutor/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-lora), Georgia, serif" }}>
            T-Kit
          </h1>
          <p className="mt-2" style={{ color: "var(--brown-mid)" }}>Регистрация репетитора</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{
          background: "rgba(253, 248, 240, 0.9)",
          borderColor: "var(--brown-pale)",
          boxShadow: "var(--shadow-card)",
        }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Ваше имя
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Как вас зовут"
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
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
                minLength={6}
                placeholder="Минимум 6 символов"
                className="w-full px-4 py-2 rounded-xl border outline-none"
                style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

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
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </form>

          <p className="text-center mt-4 text-sm" style={{ color: "var(--brown-mid)" }}>
            Уже есть аккаунт?{" "}
            <Link href="/auth/login" className="font-semibold" style={{ color: "var(--brown-mid)" }}>
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
