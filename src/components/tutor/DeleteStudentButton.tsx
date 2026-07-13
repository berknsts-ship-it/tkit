"use client";

import { useState } from "react";
import { deleteStudent } from "@/app/actions/students";

export default function DeleteStudentButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs" style={{ color: "var(--brown-mid)" }}>Удалить {name}?</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              const result = await deleteStudent(id);
              if (result?.error) setError(result.error);
            } catch {
              setError("Ошибка удаления");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="text-xs px-2 py-1 rounded-lg font-semibold text-white transition-all"
          style={{ background: "#e05030", opacity: loading ? 0.6 : 1 }}>
          {loading ? "..." : "Да"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 rounded-lg border transition-all"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
          Нет
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-2 py-1 rounded-lg border hover:opacity-70 transition-all"
      style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
      Удалить
    </button>
  );
}
