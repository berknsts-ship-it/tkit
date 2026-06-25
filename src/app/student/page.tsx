"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/student/${trimmed}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-2">T-Kit</h1>
        <p className="mb-8" style={{ color: "var(--brown-mid)" }}>Введи свой код доступа</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(null); }}
            placeholder="Например: LISA2024"
            maxLength={20}
            autoFocus
            className="w-full text-center text-2xl px-4 py-4 rounded-2xl border outline-none tracking-widest uppercase"
            style={{
              borderColor: "var(--brown-pale)",
              background: "rgba(253, 248, 240, 0.95)",
              color: "var(--brown-dark)",
              boxShadow: "var(--shadow-card)",
            }}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-button)",
            }}
          >
            Войти
          </button>
        </form>

        <p className="mt-8 text-sm" style={{ color: "var(--brown-mid)" }}>
          Репетитор?{" "}
          <a href="/auth/login" style={{ color: "var(--brown-mid)", fontWeight: 600 }}>Войти</a>
        </p>
      </div>
    </div>
  );
}
