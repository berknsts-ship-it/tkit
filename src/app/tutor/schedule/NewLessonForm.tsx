"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Student     { id: string; name: string; default_price_rub?: number | null; }
interface Group       { id: string; name: string; }
interface Subscription { id: string; student_id: string; balance: number; name: string; paid?: boolean; }

export default function NewLessonForm({
  students, subscriptions = [], groups = [],
}: {
  students: Student[];
  subscriptions?: Subscription[];
  groups?: Group[];
}) {
  const [mode,       setMode]       = useState<"student" | "group">("student");
  const [studentId,  setStudentId]  = useState("");
  const [groupId,    setGroupId]    = useState("");
  const [date,       setDate]       = useState("");
  const [time,       setTime]       = useState("");
  const [duration,   setDuration]   = useState("60");
  const [price,      setPrice]      = useState("");
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const router = useRouter();

  const activeSub = subscriptions.find(s => s.student_id === studentId) ?? null;

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const s = students.find(s => s.id === id);
    if (s?.default_price_rub) setPrice(String(s.default_price_rub));
  };

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!date || !time) { setError("Укажите дату и время"); return; }
    if (mode === "student" && !studentId) { setError("Выберите ученика"); return; }
    if (mode === "group" && !groupId) { setError("Выберите группу"); return; }

    const lessonDate = new Date(`${date}T${time}:00`);
    if (lessonDate < new Date() && !window.confirm("Дата урока в прошлом. Всё равно добавить?")) return;

    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Не авторизован"); setLoading(false); return; }

    if (mode === "group") {
      // Получаем участников группы
      const { data: members, error: membErr } = await supabase
        .from("group_members")
        .select("student_id")
        .eq("group_id", groupId);

      if (membErr || !members?.length) {
        setError(membErr?.message ?? "В группе нет учеников"); setLoading(false); return;
      }

      const { error: err } = await supabase.from("lessons").insert(
        members.map(m => ({
          tutor_id:     user.id,
          student_id:   m.student_id,
          group_id:     groupId,
          scheduled_at: lessonDate.toISOString(),
          duration_min: parseInt(duration) || 60,
          price_rub:    price ? parseInt(price) : null,
          notes:        notes || null,
        }))
      );

      setLoading(false);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from("lessons").insert({
        tutor_id:        user.id,
        student_id:      studentId,
        scheduled_at:    lessonDate.toISOString(),
        duration_min:    parseInt(duration) || 60,
        price_rub:       price ? parseInt(price) : null,
        notes:           notes || null,
        subscription_id: activeSub?.id ?? null,
        ...(activeSub?.paid ? { payment_status: "paid" } : {}),
      });

      setLoading(false);
      if (err) { setError(err.message); return; }
    }

    setStudentId(""); setGroupId(""); setDate(""); setTime(""); setPrice(""); setNotes("");
    router.refresh();
  }

  const inputStyle = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };
  const modeBtn = (m: "student" | "group", label: string) => (
    <button type="button" onClick={() => setMode(m)}
      className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
      style={{
        background: mode === m ? "var(--gradient-primary)" : "transparent",
        color: mode === m ? "white" : "var(--brown-mid)",
        border: mode === m ? "none" : "1px solid var(--brown-pale)",
      }}>
      {label}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Переключатель: ученик / группа */}
      {groups.length > 0 && (
        <div className="col-span-2 sm:col-span-4 flex gap-2">
          {modeBtn("student", "Ученик")}
          {modeBtn("group", "👥 Группа")}
        </div>
      )}

      {/* Кому */}
      {mode === "student" ? (
        <select value={studentId} onChange={e => handleStudentChange(e.target.value)}
          className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
          <option value="">Ученик *</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      ) : (
        <select value={groupId} onChange={e => setGroupId(e.target.value)}
          className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
          <option value="">Группа *</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}

      <input type="date" value={date} onChange={e => setDate(e.target.value)} required
        className="px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)} required
        className="px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle} />
      <select value={duration} onChange={e => setDuration(e.target.value)}
        className="px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
        <option value="30">30 мин</option>
        <option value="45">45 мин</option>
        <option value="60">1 час</option>
        <option value="90">1.5 часа</option>
        <option value="120">2 часа</option>
      </select>
      <input type="number" value={price} onChange={e => setPrice(e.target.value)}
        placeholder="Цена, ₽" min="0" step="50"
        className="px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle} />
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Заметка (необязательно)"
        className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle} />
      <button type="submit" disabled={loading}
        className="px-4 py-2 rounded-xl font-semibold text-white text-sm"
        style={{ background: "var(--gradient-primary)", opacity: loading ? 0.7 : 1 }}>
        {loading ? "..." : "Добавить"}
      </button>
      {activeSub && mode === "student" && (
        <p className="col-span-4 text-xs px-3 py-2 rounded-lg"
          style={{ background: "#f0fdf4", color: "#1a7a3a", border: "1px solid #b0e8c0" }}>
          Абонемент «{activeSub.name}» · остаток {activeSub.balance.toLocaleString("ru")} ₽ — урок спишется автоматически
        </p>
      )}
      {error && <p className="col-span-4 text-sm text-red-600">{error}</p>}
    </form>
  );
}
