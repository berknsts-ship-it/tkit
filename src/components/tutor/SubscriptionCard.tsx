"use client";

import { useState } from "react";
import { renewSubscription, cancelSubscription } from "@/app/actions/subscriptions";

interface Lesson {
  id: string;
  scheduled_at: string;
  duration_min?: number | null;
  price_rub?: number | null;
  status: string;
  deducted_amount?: number | null;
  notes?: string | null;
}

interface Sub {
  id: string;
  name: string;
  total_amount: number;
  balance: number;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
}

export default function SubscriptionCard({
  subscription: sub,
  student,
  lessons,
  studentId,
}: {
  subscription: Sub;
  student: Student;
  lessons: Record<string, unknown>[];
  studentId: string;
}) {
  const [renewMode, setRenewMode] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(false);

  const ls = lessons as unknown as Lesson[];
  const spent = sub.total_amount - sub.balance;
  const pct   = Math.min(100, Math.round((spent / sub.total_amount) * 100));
  const doneCount = ls.filter(l => l.deducted_amount).length;

  const createdDate = new Date(sub.created_at).toLocaleDateString("ru", {
    day: "numeric", month: "long",
  });

  const initials = student.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  async function handleRenew(fd: FormData) {
    setLoading(true);
    await renewSubscription(sub.id, studentId, fd);
  }

  async function handleCancel() {
    if (!window.confirm("Перевести ученика на разовую оплату? Абонемент будет закрыт.")) return;
    setCancelling(true);
    await cancelSubscription(sub.id, studentId);
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={card}>
      {/* Шапка */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ background: "var(--gradient-primary)", fontSize: 15 }}>
            {initials}
          </div>
          <div>
            <div className="font-semibold" style={{ color: "var(--brown-dark)" }}>{student.name}</div>
            <div className="text-sm" style={{ color: "var(--brown-light)" }}>
              Абонемент «{sub.name}» · куплен {createdDate}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs" style={{ color: "var(--brown-light)" }}>Остаток</div>
          <div className="text-2xl font-bold" style={{ color: sub.balance < 0 ? "#c0392b" : "var(--brown-dark)" }}>
            {sub.balance.toLocaleString("ru")} ₽
          </div>
        </div>
      </div>

      {/* Прогресс */}
      <div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--brown-pale)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 90 ? "#e05030" : "#4caf7a" }} />
        </div>
        <p className="text-sm mt-1.5" style={{ color: "var(--brown-mid)" }}>
          Списано {spent.toLocaleString("ru")} ₽ из {sub.total_amount.toLocaleString("ru")} ₽
          {doneCount > 0 && ` за ${doneCount} ${doneCount === 1 ? "занятие" : doneCount < 5 ? "занятия" : "занятий"}`}
          {doneCount !== ls.length && ls.length > 0 && ` (всего уроков по абонементу: ${ls.length})`}
        </p>
      </div>

      {/* Список уроков */}
      {ls.length > 0 && (
        <div className="divide-y" style={{ borderColor: "var(--brown-pale)" }}>
          {ls.map(l => {
            const dt = new Date(l.scheduled_at);
            const dateStr = dt.toLocaleDateString("ru", { day: "numeric", month: "long" });
            const isScheduled = l.status === "scheduled";
            const isMissed    = l.status === "missed";
            const amount      = l.deducted_amount ?? l.price_rub;

            return (
              <div key={l.id} className="flex items-center justify-between py-2.5 gap-2">
                <span className="text-sm" style={{ color: "var(--brown-dark)" }}>
                  {dateStr}
                  {l.duration_min ? ` · ${l.duration_min} мин` : ""}
                  {isMissed && " · пропущено без предупреждения"}
                  {isScheduled && " · запланировано"}
                </span>
                <span className="text-sm font-medium shrink-0"
                  style={{ color: isMissed ? "#c0392b" : isScheduled ? "var(--brown-light)" : "var(--brown-dark)" }}>
                  {amount ? `−${amount.toLocaleString("ru")} ₽` : "—"}
                  {isMissed && " (сгорело)"}
                  {isScheduled && amount ? " при проведении" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {ls.length === 0 && (
        <p className="text-sm" style={{ color: "var(--brown-light)" }}>
          Уроков по этому абонементу ещё нет. Добавляйте уроки в расписании — они автоматически привяжутся.
        </p>
      )}

      {/* Пополнение */}
      {renewMode && (
        <form action={handleRenew} className="flex items-center gap-2 pt-1">
          <input
            name="add_amount" type="number" min="100" step="100" placeholder="Сумма пополнения, ₽"
            value={addAmount} onChange={e => setAddAmount(e.target.value)} required
            className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }} />
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)", opacity: loading ? 0.7 : 1 }}>
            Пополнить
          </button>
          <button type="button" onClick={() => setRenewMode(false)}
            className="px-3 py-2 rounded-xl text-sm border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Отмена
          </button>
        </form>
      )}

      {/* Кнопки */}
      {!renewMode && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setRenewMode(true)}
            className="flex-1 py-2 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }}>
            Продлить абонемент
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            className="flex-1 py-2 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", opacity: cancelling ? 0.5 : 1 }}>
            Перевести на разовую оплату
          </button>
        </div>
      )}
    </div>
  );
}
