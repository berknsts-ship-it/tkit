"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Student { id: string; name: string; default_price_rub?: number | null; }

export default function NewLessonForm({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState("");
  const [date,      setDate]      = useState("");
  const [time,      setTime]      = useState("");
  const [duration,  setDuration]  = useState("60");
  const [price,     setPrice]     = useState("");
  const [notes,     setNotes]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const router = useRouter();

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const s = students.find(s => s.id === id);
    if (s?.default_price_rub) setPrice(String(s.default_price_rub));
  };

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!studentId || !date || !time) { setError("Заполните все обязательные поля"); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Не авторизован"); setLoading(false); return; }
    const { error: err } = await supabase.from("lessons").insert({
      tutor_id:   user.id,
      student_id: studentId,
      scheduled_at: `${date}T${time}:00`,
      duration_min: parseInt(duration) || 60,
      price_rub:  price ? parseInt(price) : null,
      notes:      notes || null,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStudentId(""); setDate(""); setTime(""); setPrice(""); setNotes("");
    router.refresh();
  }

  const inputStyle = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <select value={studentId} onChange={e => handleStudentChange(e.target.value)} required
        className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
        <option value="">Ученик *</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
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
      {error && <p className="col-span-4 text-sm text-red-600">{error}</p>}
    </form>
  );
}
