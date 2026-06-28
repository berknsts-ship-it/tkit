"use client";

import { useState } from "react";
import { updateLessonStatus, rescheduleLesson, togglePaymentStatus } from "@/app/actions/lessons";
import { ChevronDown } from "lucide-react";

type Status = "scheduled" | "completed" | "cancelled" | "rescheduled" | "missed";
type PayStatus = "paid" | "unpaid";

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  scheduled:   { label: "Запланирован", color: "#2060d0",  bg: "#e8f0ff" },
  completed:   { label: "Проведён",     color: "#1a7a3a",  bg: "#d8f5e0" },
  cancelled:   { label: "Отменён",      color: "#999",     bg: "#f0f0f0" },
  rescheduled: { label: "Перенесён",    color: "#c07800",  bg: "#fff3cc" },
  missed:      { label: "Сгорел",       color: "#cc3030",  bg: "#ffe0e0" },
};

const ACTIONS: { status: Status; label: string }[] = [
  { status: "completed",   label: "✓ Проведён" },
  { status: "rescheduled", label: "⟳ Перенесён" },
  { status: "cancelled",   label: "✕ Отменён" },
  { status: "missed",      label: "⚡ Сгорел" },
  { status: "scheduled",   label: "↩ Вернуть" },
];

interface Lesson {
  id: string;
  status: Status;
  scheduled_at: string;
  duration_min?: number;
  notes?: string | null;
  students?: { name: string } | null;
  payment_status?: PayStatus;
  price_rub?: number | null;
}

export default function LessonCard({ lesson }: { lesson: Lesson }) {
  const [open,           setOpen]           = useState(false);
  const [status,         setStatus]         = useState<Status>(lesson.status);
  const [payStatus,      setPayStatus]      = useState<PayStatus>(lesson.payment_status ?? "unpaid");
  const [loading,        setLoading]        = useState(false);
  const [payLoading,     setPayLoading]     = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newDate,        setNewDate]        = useState("");
  const [newTime,        setNewTime]        = useState("");
  const [confirmPay,     setConfirmPay]     = useState(false);

  const cfg   = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  const dt    = new Date(lesson.scheduled_at);
  const isPast = status !== "scheduled";
  const isCancelled = status === "cancelled";

  const DESTRUCTIVE: Status[] = ["cancelled", "missed"];

  const changeStatus = async (s: Status) => {
    setOpen(false);
    if (s === "rescheduled") { setRescheduleMode(true); return; }
    if (DESTRUCTIVE.includes(s) && !window.confirm(
      s === "cancelled" ? "Отменить урок?" : "Отметить как сгоревший?"
    )) return;
    setLoading(true);
    await updateLessonStatus(lesson.id, s);
    setStatus(s);
    setLoading(false);
  };

  const submitReschedule = async () => {
    if (!newDate || !newTime) return;
    setLoading(true);
    setRescheduleMode(false);
    await rescheduleLesson(lesson.id, `${newDate}T${newTime}:00`);
    setStatus("scheduled");
    setLoading(false);
  };

  const handleTogglePay = async () => {
    if (payStatus === "paid") {
      setConfirmPay(true);
      return;
    }
    setPayLoading(true);
    await togglePaymentStatus(lesson.id, payStatus);
    setPayStatus("paid");
    setPayLoading(false);
  };

  const confirmUnpay = async () => {
    setConfirmPay(false);
    setPayLoading(true);
    await togglePaymentStatus(lesson.id, payStatus);
    setPayStatus("unpaid");
    setPayLoading(false);
  };

  return (
    <div className="rounded-xl border overflow-visible"
      style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)", opacity: isPast ? 0.78 : 1 }}>
      <div className="flex items-center gap-3 p-4">
        {/* Дата */}
        <div className="text-center min-w-[48px] shrink-0">
          <div className="text-xs font-medium" style={{ color: "var(--brown-light)" }}>
            {dt.toLocaleDateString("ru", { weekday: "short" })}
          </div>
          <div className="text-2xl font-bold leading-tight" style={{ color: "var(--brown-dark)" }}>
            {dt.getDate()}
          </div>
          <div className="text-xs" style={{ color: "var(--brown-light)" }}>
            {dt.toLocaleDateString("ru", { month: "short" })}
          </div>
        </div>

        <div className="w-px h-12 shrink-0" style={{ background: "var(--brown-pale)" }} />

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="font-medium" style={{ color: "var(--brown-dark)" }}>
            {lesson.students?.name ?? "Ученик"}
          </div>
          <div className="text-sm" style={{ color: "var(--brown-mid)" }}>
            {dt.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
            {lesson.duration_min ? ` · ${lesson.duration_min} мин` : ""}
            {lesson.price_rub ? ` · ${lesson.price_rub} ₽` : ""}
          </div>
          {lesson.notes && (
            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--brown-light)" }}>
              {lesson.notes}
            </div>
          )}
        </div>

        {/* Оплата */}
        {!isCancelled && !confirmPay && (
          <button
            onClick={handleTogglePay}
            disabled={payLoading}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
            style={{
              background: payStatus === "paid" ? "#d8f5e0" : "#fff3e0",
              color:      payStatus === "paid" ? "#1a7a3a" : "#c07800",
              border:     `1.5px solid ${payStatus === "paid" ? "#b0e8c0" : "#f0d090"}`,
            }}>
            {payLoading ? "..." : payStatus === "paid" ? "✓ Оплачено" : "₽ Не оплачено"}
          </button>
        )}

        {/* Статус + меню */}
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen(o => !o)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: cfg.bg, color: cfg.color }}>
            {loading ? "..." : cfg.label}
            <ChevronDown size={12} style={{ opacity: 0.7 }} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-xl overflow-hidden min-w-[160px]"
                style={{ background: "white", borderColor: "var(--brown-pale)" }}>
                {ACTIONS.filter(a => a.status !== status).map(a => (
                  <button key={a.status} onClick={() => changeStatus(a.status)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:opacity-80 transition-all border-b last:border-0"
                    style={{ borderColor: "var(--brown-pale)", color: STATUS_CONFIG[a.status].color }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Подтверждение снятия оплаты */}
      {confirmPay && !isCancelled && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <span className="text-sm flex-1" style={{ color: "var(--brown-mid)" }}>Снять отметку об оплате?</span>
          <button onClick={confirmUnpay} className="text-sm px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: "#e05030" }}>Снять</button>
          <button onClick={() => setConfirmPay(false)} className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>Отмена</button>
        </div>
      )}

      {/* Форма переноса */}
      {rescheduleMode && (
        <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
          <span className="text-sm" style={{ color: "var(--brown-mid)" }}>Новая дата:</span>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }} />
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
            className="px-3 py-1.5 rounded-lg border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }} />
          <button onClick={submitReschedule} disabled={!newDate || !newTime}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}>
            Сохранить
          </button>
          <button onClick={() => setRescheduleMode(false)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
