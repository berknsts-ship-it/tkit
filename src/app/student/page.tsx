"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TKitLogo from "@/components/TKitLogo";
import { ArrowRight, Loader2 } from "lucide-react";

function StudentEntryForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [error, setError] = useState<string | null>(
    params.get("error") === "not_found" ? "Код не найден. Проверь правописание или спроси репетитора." : null
  );
  const [loading, setLoading] = useState(false);

  // Reset error when user types
  useEffect(() => { if (error && code) setError(null); }, [code]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Введи код доступа"); return; }
    setLoading(true);
    router.push(`/student/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={code}
        onChange={e => { setCode(e.target.value.toUpperCase()); setError(null); }}
        placeholder="LISA2024"
        maxLength={20}
        autoFocus
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        disabled={loading}
        className="w-full text-center text-2xl font-bold px-4 py-4 rounded-2xl border-2 outline-none tracking-widest uppercase transition-all"
        style={{
          borderColor: error ? "#e05050" : code ? "var(--brown-mid)" : "var(--brown-pale)",
          background: "white",
          color: "var(--brown-dark)",
          letterSpacing: "0.15em",
          opacity: loading ? 0.6 : 1,
        }}
      />

      {error && (
        <p className="text-sm text-center" style={{ color: "#e05050" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "var(--shadow-button)",
        }}
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Открываю...</> : <>Открыть кабинет <ArrowRight size={18} /></>}
      </button>
    </form>
  );
}

export default function StudentEntryPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "var(--background)" }}>

      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-120px", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(200,170,130,0.18) 0%, transparent 70%)",
        }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        <div className="flex justify-center mb-8">
          <TKitLogo size="lg" subtitle />
        </div>

        <div className="rounded-3xl border p-8" style={{
          background: "rgba(253,248,240,0.95)",
          borderColor: "var(--brown-pale)",
          boxShadow: "0 8px 40px rgba(59,42,26,0.10)",
          backdropFilter: "blur(8px)",
        }}>
          <h1 className="text-xl font-bold mb-1 text-center" style={{
            color: "var(--brown-dark)",
            fontFamily: "var(--font-lora), Georgia, serif",
          }}>
            Добро пожаловать!
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: "var(--brown-light)" }}>
            Введи код, который дал репетитор
          </p>

          <Suspense fallback={<div className="h-32" />}>
            <StudentEntryForm />
          </Suspense>
        </div>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--brown-light)" }}>
          Вы репетитор?{" "}
          <a href="/auth/login" className="font-semibold hover:underline" style={{ color: "var(--brown-mid)" }}>
            Войти в кабинет
          </a>
        </p>
      </div>
    </div>
  );
}
