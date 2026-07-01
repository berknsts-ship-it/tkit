"use client";

import { useState } from "react";
import { createSubscription } from "@/app/actions/subscriptions";
import { CreditCard } from "lucide-react";

const PRESETS = [
  { label: "4 занятия", amount: 4000 },
  { label: "8 занятий", amount: 8000 },
  { label: "12 занятий", amount: 12000 },
];

export default function CreateSubscriptionForm({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [name, setName]       = useState("");
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name || "Абонемент");
    fd.set("total_amount", amount);
    await createSubscription(studentId, fd);
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  if (!open) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={card}>
        <CreditCard size={32} className="mx-auto mb-3" style={{ color: "var(--brown-light)" }} />
        <p className="font-medium mb-1" style={{ color: "var(--brown-dark)" }}>Нет активного абонемента</p>
        <p className="text-sm mb-4" style={{ color: "var(--brown-mid)" }}>
          {studentName} оплачивает занятия поурочно
        </p>
        <button onClick={() => setOpen(true)}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)" }}>
          Создать абонемент
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={card}>
      <h2 className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>Новый абонемент</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm mb-1 block" style={{ color: "var(--brown-mid)" }}>Название</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Например: 8 занятий"
            className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }} />
        </div>
        <div>
          <label className="text-sm mb-1 block" style={{ color: "var(--brown-mid)" }}>Сумма абонемента, ₽</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.label} type="button"
                onClick={() => { setAmount(String(p.amount)); setName(prev => prev || p.label); }}
                className="text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition-all"
                style={{
                  borderColor: amount === String(p.amount) ? "var(--brown-dark)" : "var(--brown-pale)",
                  background:  amount === String(p.amount) ? "var(--brown-pale)" : "white",
                  color: "var(--brown-dark)",
                }}>
                {p.label} · {p.amount.toLocaleString("ru")} ₽
              </button>
            ))}
          </div>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Или введите сумму" min="100" step="100" required
            className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading || !amount}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}>
            {loading ? "Создаём..." : "Создать абонемент"}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-xl border text-sm"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
