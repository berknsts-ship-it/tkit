"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { createGroup } from "@/app/actions/groups";

export default function CreateGroupForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createGroup(fd);
      if (res && "error" in res) setError(res.error);
      // on success, createGroup redirects — router.refresh handles cache
      else router.refresh();
    });
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border p-4 mb-6 flex gap-3 items-end" style={card}>
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
          Название новой группы
        </label>
        <input
          name="name"
          type="text"
          required
          disabled={pending}
          placeholder="Например: Группа А, Воскресенье 11:00…"
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
          style={{ borderColor: error ? "#fecaca" : "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" }}
        />
        {error && <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{error}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-50"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
      >
        <PlusCircle size={16} />
        {pending ? "Создаю..." : "Создать"}
      </button>
    </form>
  );
}
