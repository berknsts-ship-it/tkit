"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Lesson = {
  id: string;
  scheduled_at: string;
  status: string;
  duration_min?: number | null;
  price_rub?: number | null;
  subscription_id?: string | null;
  students?: { name: string } | null;
};
type Student     = { id: string; name: string; default_price_rub?: number | null };
type Subscription = { id: string; student_id: string; balance: number; name: string };

const STATUS_BG: Record<string, string> = {
  scheduled:   "#dbeafe",
  completed:   "#d1fae5",
  missed:      "#fee2e2",
  cancelled:   "#f1f5f9",
  rescheduled: "#fef3c7",
};
const STATUS_TEXT: Record<string, string> = {
  scheduled:   "#1d4ed8",
  completed:   "#166534",
  missed:      "#b91c1c",
  cancelled:   "#94a3b8",
  rescheduled: "#92400e",
};

const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const MONTHS   = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function toDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function pluralWeeks(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} неделю`;
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} недели`;
  return `${n} недель`;
}

function pluralLessons(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} урок`;
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} урока`;
  return `${n} уроков`;
}

export default function CalendarView({
  lessons, students, subscriptions,
}: {
  lessons: Lesson[];
  students: Student[];
  subscriptions: Subscription[];
}) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // form
  const [studentId,   setStudentId]   = useState("");
  const [time,        setTime]        = useState("");
  const [duration,    setDuration]    = useState("60");
  const [price,       setPrice]       = useState("");
  const [repeat,      setRepeat]      = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState("4");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const router = useRouter();

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  const { daysInMonth, firstDow } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const raw = new Date(year, month, 1).getDay();
    const firstDow = raw === 0 ? 6 : raw - 1; // Mon=0
    return { daysInMonth, firstDow };
  }, [year, month]);

  const lessonsByDate = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    for (const l of lessons) {
      const key = toDateKey(l.scheduled_at);
      const d = new Date(key);
      if (d.getFullYear() === year && d.getMonth() === month) {
        (map[key] ??= []).push(l);
      }
    }
    return map;
  }, [lessons, year, month]);

  const activeSub = subscriptions.find(s => s.student_id === studentId) ?? null;

  function handleStudentChange(id: string) {
    setStudentId(id);
    const s = students.find(s => s.id === id);
    setPrice(s?.default_price_rub ? String(s.default_price_rub) : "");
  }

  function selectDay(dateStr: string) {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
    setError(null);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!studentId || !selectedDate || !time) { setError("Выберите ученика и время"); return; }
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Не авторизован"); setLoading(false); return; }

    const weeks = repeat ? Math.max(1, Math.min(12, parseInt(repeatWeeks) || 1)) : 1;
    const rows = Array.from({ length: weeks }, (_, i) => {
      const d = new Date(`${selectedDate}T${time}:00`);
      d.setDate(d.getDate() + i * 7);
      return {
        tutor_id:        user.id,
        student_id:      studentId,
        scheduled_at:    d.toISOString(),
        duration_min:    parseInt(duration) || 60,
        price_rub:       price ? parseInt(price) : null,
        subscription_id: activeSub?.id ?? null,
      };
    });

    const { error: err } = await supabase.from("lessons").insert(rows);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSelectedDate(null);
    setStudentId(""); setTime(""); setPrice(""); setRepeat(false); setRepeatWeeks("4");
    router.refresh();
  }

  const todayKey  = toDateKey(today.toISOString());
  const inputStyle = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div>
      {/* Навигация по месяцам */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:opacity-70 transition-all"
          style={{ color: "var(--brown-mid)" }}><ChevronLeft size={20}/></button>
        <span className="font-semibold" style={{ color: "var(--brown-dark)" }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:opacity-70 transition-all"
          style={{ color: "var(--brown-mid)" }}><ChevronRight size={20}/></button>
      </div>

      {/* Заголовки дней недели */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1"
            style={{ color: "var(--brown-light)" }}>{d}</div>
        ))}
      </div>

      {/* Сетка дней */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`}/>;
          const key       = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const dayLessons = lessonsByDate[key] ?? [];
          const isToday   = key === todayKey;
          const isSelected = key === selectedDate;
          const isPast    = key < todayKey;

          return (
            <button key={key} onClick={() => selectDay(key)}
              className="min-h-[62px] sm:min-h-[76px] p-1 rounded-xl border text-left flex flex-col transition-all hover:shadow-sm"
              style={{
                borderColor: isSelected ? "var(--brown-dark)" : isToday ? "var(--brown-mid)" : "var(--brown-pale)",
                background:  isSelected ? "var(--brown-pale)" : "white",
                opacity:     isPast ? 0.6 : 1,
              }}>
              <span className="text-xs font-semibold mb-0.5 leading-none"
                style={{ color: isToday ? "var(--brown-dark)" : "var(--brown-light)" }}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                {dayLessons.slice(0, 2).map(l => (
                  <div key={l.id} className="text-xs rounded px-1 py-0.5 leading-tight truncate"
                    style={{ background: STATUS_BG[l.status] ?? "#f1f5f9", color: STATUS_TEXT[l.status] ?? "#64748b" }}>
                    {l.students ? initials(l.students.name) : "?"}
                    <span className="hidden sm:inline ml-0.5">
                      {new Date(l.scheduled_at).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                ))}
                {dayLessons.length > 2 && (
                  <span className="text-xs leading-none" style={{ color: "var(--brown-light)" }}>
                    +{dayLessons.length - 2}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Форма добавления при клике на день */}
      {selectedDate && (
        <div className="mt-4 rounded-2xl border p-4 space-y-3"
          style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>
              {selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}
            </span>
            <button onClick={() => setSelectedDate(null)} className="hover:opacity-60 transition-all"
              style={{ color: "var(--brown-light)" }}>
              <X size={16}/>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={studentId} onChange={e => handleStudentChange(e.target.value)} required
              className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}>
              <option value="">Ученик *</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input type="time" value={time} onChange={e => setTime(e.target.value)} required
              className="px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>

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
              className="col-span-2 px-3 py-2 rounded-xl border outline-none text-sm" style={inputStyle}/>

            {activeSub && (
              <p className="col-span-2 sm:col-span-4 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                Абонемент «{activeSub.name}» · остаток {activeSub.balance.toLocaleString("ru")} ₽ — спишется автоматически
              </p>
            )}

            {/* Повторение */}
            <div className="col-span-2 sm:col-span-4 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--brown-dark)" }}>
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)}
                  className="w-4 h-4 accent-amber-700"/>
                Повторять каждую неделю
              </label>
              {repeat && (
                <div className="flex items-center gap-1.5">
                  <input type="number" value={repeatWeeks} onChange={e => setRepeatWeeks(e.target.value)}
                    min="2" max="12"
                    className="w-16 px-2 py-1.5 rounded-lg border outline-none text-sm text-center" style={inputStyle}/>
                  <span className="text-sm" style={{ color: "var(--brown-mid)" }}>нед.</span>
                </div>
              )}
            </div>

            <div className="col-span-2 sm:col-span-4 flex gap-2">
              <button type="submit" disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--gradient-primary)" }}>
                {loading ? "..." : repeat
                  ? `Добавить ${pluralLessons(parseInt(repeatWeeks)||1)} на ${pluralWeeks(parseInt(repeatWeeks)||1)}`
                  : "Добавить урок"}
              </button>
            </div>

            {error && <p className="col-span-2 sm:col-span-4 text-xs text-red-600">{error}</p>}
          </form>
        </div>
      )}

      {/* Легенда */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {(["scheduled","completed","missed"] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_BG[s] }}/>
            <span className="text-xs" style={{ color: "var(--brown-light)" }}>
              {s === "scheduled" ? "Запланирован" : s === "completed" ? "Проведён" : "Сгорел"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
