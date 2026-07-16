"use client";

import { useState } from "react";
import { deleteDemoStudent } from "@/app/actions/onboarding";
import { useRouter } from "next/navigation";

export default function DeleteDemoButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs" style={{ color: "var(--brown-mid)" }}>Удалить демо-ученика?</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          onClick={async () => {
            setLoading(true);
            setError(null);
            const result = await deleteDemoStudent();
            if (result?.error) {
              setError(result.error);
              setLoading(false);
            } else {
              router.refresh();
            }
          }}
          disabled={loading}
          className="text-xs px-2 py-1 rounded-lg font-semibold text-white"
          style={{ background: "#e05030", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "..." : "Да"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}
        >
          Нет
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all hover:opacity-80"
      style={{ borderColor: "#f0c040", color: "#a06800", background: "#fff8e6" }}
    >
      Удалить пример
    </button>
  );
}
