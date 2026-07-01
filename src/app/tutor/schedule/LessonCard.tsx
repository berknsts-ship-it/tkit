"use client";

import { useState } from "react";
import { updateLessonStatus, rescheduleLesson, togglePaymentStatus, updateLesson, deleteLesson } from "@/app/actions/lessons";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

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
  rescheduled_to?: string | null;
  duration_min?: number;
  notes?: string | null;
  students?: { name: string } | null;
  payment_status?: PayStatus;
  price_rub?: number | null;
}

export default function LessonCard({ lesson }: { lesson: Lesson }) {
  const [open,        setOpen]       = useState(false);
  const [status,      setStatus]     = useState<Status>(lesson.status);
  const [payStatus,   setPayStatus]  = useState<PayStatus>(lesson.payment_status ?? "unpaid");
  const [loading,     setLoading]    = useState(false);
  const [payLoading,  setPayLoading] = useState(false);
  const [confirmPay,  setConfirmPay] = useState(false);
  const [editMode,       setEditMode]      = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduledTo, setRescheduledTo] = useState(lesson.rescheduled_to ?? null);

  // edit form state — initialised from current lesson values
  const initDt = new Date(lesson.scheduled_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const initDate = `${initDt.getFullYear()}-${pad(initDt.getMonth()+1)}-${pad(initDt.getDate())}`;
  const initTime = `${pad(initDt.getHours())}:${pad(initDt.getMinutes())}`;

  const [editDate,     setEditDate]     = useState(initDate);
  const [editTime,     setEditTime]     = useState(initTime);
  const [editDuration, setEditDuration] = useState(String(lesson.duration_min ?? 60));
  const [editPrice,    setEditPrice]    = useState(lesson.price_rub ? String(lesson.price_rub) : "");
  const [editNotes,    setEditNotes]    = useState(lesson.notes ?? "");
  const [editLoading,  setEditLoading]  = useState(false);

  const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  const dt   = new Date(lesson.scheduled_at);
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
    if (!rescheduleDate || !rescheduleTime) return;
    setRescheduleLoading(true);
    const iso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    await rescheduleLesson(lesson.id, iso);
    setRescheduledTo(iso);
    setStatus("rescheduled");
    setRescheduleMode(false);
    setRescheduleLoading(false);
  };

  const handleTogglePay = async () => {
    if (payStatus === "paid") { setConfirmPay(true); return; }
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

  const submitEdit = async () => {
    if (!editDate || !editTime) return;
    setEditLoading(true);
    await updateLesson(lesson.id, {
      scheduled_at: new Date(`${editDate}T${editTime}:00`).toISOString(),
      duration_min: parseInt(editDuration) || 60,
      price_rub:    editPrice ? parseInt(editPrice) : null,
      notes:        editNotes.trim() || null,
    });
    setEditLoading(false);
    setEditMode(false);
  };

  const inputStyle = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };

  return (
    <div className="rounded-xl border overflow-visible"
      style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)", opacity: status !== "scheduled" ? 0.78 : 1 }}>
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

        {/* Редактировать / Удалить */}
        <button
          onClick={() => setEditMode(m => !m)}
          title="Редактировать"
          className="shrink-0 p-1.5 rounded-lg border hover:opacity-70 transition-all"
          style={{ borderColor: editMode ? "var(--brown-dark)" : "var(--brown-pale)", color: "var(--brown-mid)" }}>
          <Pencil size={13}/>
        </button>
        <button
          onClick={async () => {
            if (!window.confirm("Удалить урок?")) return;
            await deleteLesson(lesson.id);
          }}
          title="Удалить"
          className="shrink-0 p-1.5 rounded-lg border hover:opacity-70 transition-all"
          style={{ borderColor: "var(--brown-pale)", color: "#e05030" }}>
          <Trash2 size={13}/>
        </button>

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
            {status === "rescheduled" && rescheduledTo && (
              <span className="ml-1 font-normal">
                → {new Date(rescheduledTo).toLocaleDateString("ru", { day:"numeric", month:"short" })}
              </span>
            )}
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
        <div className="flex items-center gap-2 px-4 pb-4 pt-2 flex-wrap border-t"
          style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }}>
          <span className="text-sm" style={{ color: "var(--brown-mid)" }}>Перенести на:</span>
          <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)", background: "white" }}/>
          <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
            className="px-3 py-1.5 rounded-lg border outline-none text-sm"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)", background: "white" }}/>
          <button onClick={submitReschedule} disabled={!rescheduleDate || !rescheduleTime || rescheduleLoading}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}>
            {rescheduleLoading ? "..." : "Сохранить"}
          </button>
          <button onClick={() => setRescheduleMode(false)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Отмена
          </button>
        </div>
      )}
      {/* Инлайн-форма редактирования */}
      {editMode && (
        <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
          style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }}>
          <div className="col-span-2 sm:col-span-2">
            <label className="text-xs mb-1 block" style={{ color: "var(--brown-light)" }}>Дата</label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--brown-light)" }}>Время</label>
            <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--brown-light)" }}>Длительность, мин</label>
            <select value={editDuration} onChange={e => setEditDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
              <option value="30">30</option>
              <option value="45">45</option>
              <option value="60">60</option>
              <option value="90">90</option>
              <option value="120">120</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs mb-1 block" style={{ color: "var(--brown-light)" }}>Цена, ₽</label>
            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
              placeholder="Без изменений" min="0" step="50"
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>
          </div>
          <div className="col-span-2">
            <label className="text-xs mb-1 block" style={{ color: "var(--brown-light)" }}>Заметки</label>
            <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
              placeholder="Тема, домашнее задание..."
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>
          </div>
          <div className="col-span-2 sm:col-span-4 flex gap-2">
            <button onClick={submitEdit} disabled={editLoading}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}>
              {editLoading ? "Сохраняем..." : "Сохранить"}
            </button>
            <button onClick={() => setEditMode(false)}
              className="px-4 py-2 rounded-xl border text-sm"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
