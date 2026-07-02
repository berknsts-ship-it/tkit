"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNotification } from "@/app/actions/notifications";
import { Bell } from "lucide-react";

const TIMEZONES = [
  { value: "Europe/Kaliningrad",  label: "Калининград (UTC+2)"  },
  { value: "Europe/Moscow",       label: "Москва (UTC+3)"       },
  { value: "Europe/Samara",       label: "Самара (UTC+4)"       },
  { value: "Asia/Yekaterinburg",  label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk",           label: "Омск (UTC+6)"         },
  { value: "Asia/Novosibirsk",    label: "Новосибирск (UTC+7)"  },
  { value: "Asia/Irkutsk",        label: "Иркутск (UTC+8)"      },
  { value: "Asia/Yakutsk",        label: "Якутск (UTC+9)"       },
  { value: "Asia/Vladivostok",    label: "Владивосток (UTC+10)" },
  { value: "Asia/Magadan",        label: "Магадан (UTC+11)"     },
  { value: "Asia/Kamchatka",      label: "Камчатка (UTC+12)"    },
  { value: "UTC",                 label: "UTC"                  },
  { value: "Europe/London",       label: "Лондон (UTC+0/+1)"    },
  { value: "America/New_York",    label: "Нью-Йорк (UTC-5/-4)"  },
];

const WEEK_DAYS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Вс", value: 0 },
];

interface Student { id: string; name: string; }

export default function NewNotificationPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title,        setTitle]        = useState("");
  const [body,         setBody]         = useState("");
  const [date,         setDate]         = useState("");
  const [time,         setTime]         = useState("09:00");
  const [timezone,     setTimezone]     = useState("Europe/Moscow");
  const [isRecurring,  setIsRecurring]  = useState(false);
  const [recurrDays,   setRecurrDays]   = useState<Set<number>>(new Set());
  const [students,     setStudents]     = useState<Student[]>([]);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [allSelected,  setAllSelected]  = useState(true);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  useState(() => {
    fetch("/api/students")
      .then(r => r.json())
      .then((data: Student[]) => { setStudents(data ?? []); setStudentsLoaded(true); })
      .catch(() => setStudentsLoaded(true));
  });

  const toggleDay = (val: number) => setRecurrDays(prev => {
    const next = new Set(prev);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  });

  const toggleStudent = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    setAllSelected(v => !v);
    if (!allSelected) setSelectedIds(new Set());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Укажите заголовок"); return; }
    if (!body.trim())  { setError("Укажите текст"); return; }
    if (!isRecurring && !date) { setError("Выберите дату"); return; }
    if (isRecurring && recurrDays.size === 0) { setError("Выберите хотя бы один день"); return; }
    setError(null);

    const studentIds = allSelected ? [] : [...selectedIds];
    const recurrenceDays = isRecurring ? [...recurrDays] : undefined;

    startTransition(async () => {
      const res = await createNotification({ title, body, date, time, timezone, studentIds, recurrenceDays });
      if (res?.error) { setError(res.error); return; }
      router.push("/tutor/notifications");
    });
  };

  const inputStyle = { borderColor: "var(--brown-pale)", background: "var(--cream)", color: "var(--brown-dark)" };

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/tutor/notifications")}
          className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          ← Назад
        </button>
        <h1 className="text-xl font-bold">Новое уведомление</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Заголовок */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
            Заголовок пуш-уведомления
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Не забудь про домашнее задание!" maxLength={80}
            className="w-full px-4 py-2.5 rounded-xl border outline-none" style={inputStyle} />
        </div>

        {/* Текст */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
            Текст сообщения
          </label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder="Привет! Напоминаю..."
            className="w-full px-4 py-2.5 rounded-xl border outline-none resize-none" style={inputStyle} />
        </div>

        {/* Тип: разовое / периодически */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--brown-mid)" }}>
            Тип
          </label>
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--brown-pale)" }}>
            {[
              { label: "Разовое",       val: false },
              { label: "Периодически",  val: true  },
            ].map(opt => (
              <button key={String(opt.val)} type="button"
                onClick={() => setIsRecurring(opt.val)}
                className="flex-1 py-2 text-sm font-medium transition-all"
                style={isRecurring === opt.val
                  ? { background: "var(--gradient-primary)", color: "white" }
                  : { color: "var(--brown-mid)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Дни недели — только если периодически */}
        {isRecurring && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--brown-mid)" }}>
              Дни недели
            </label>
            <div className="flex gap-2 flex-wrap">
              {WEEK_DAYS.map(({ label, value }) => (
                <button key={value} type="button" onClick={() => toggleDay(value)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={recurrDays.has(value)
                    ? { background: "var(--gradient-primary)", color: "white" }
                    : { background: "var(--cream)", color: "var(--brown-mid)", border: "1px solid var(--brown-pale)" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Дата — только если разовое */}
        {!isRecurring && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border outline-none" style={inputStyle} />
          </div>
        )}

        {/* Время и часовой пояс */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Время</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>Часовой пояс</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border outline-none" style={inputStyle}>
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>

        {/* Получатели */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--brown-mid)" }}>Получатели</label>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--brown-pale)" }}>
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-80 border-b"
              style={{ background: allSelected ? "#e8f0ff" : "var(--cream)", borderColor: "var(--brown-pale)" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="w-4 h-4 accent-amber-700 cursor-pointer" />
              <span className="text-sm font-semibold" style={{ color: allSelected ? "#2060d0" : "var(--brown-dark)" }}>
                Все ученики
              </span>
            </label>
            {studentsLoaded && students.map(s => (
              <label key={s.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:opacity-80 border-b last:border-0"
                style={{
                  borderColor: "var(--brown-pale)",
                  background: (!allSelected && selectedIds.has(s.id)) ? "#e8f0ff" : "white",
                  opacity: allSelected ? 0.45 : 1,
                  pointerEvents: allSelected ? "none" : "auto",
                }}>
                <input type="checkbox" checked={!allSelected && selectedIds.has(s.id)}
                  onChange={() => toggleStudent(s.id)} disabled={allSelected}
                  className="w-4 h-4 accent-amber-700 cursor-pointer" />
                <span className="text-sm" style={{ color: "var(--brown-dark)" }}>{s.name}</span>
              </label>
            ))}
            {!studentsLoaded && (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--brown-light)" }}>Загрузка...</div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
          <Bell size={16} />
          {pending ? "Создаём..." : "Создать уведомление"}
        </button>
      </form>
    </div>
  );
}
