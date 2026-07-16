import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import CopyStudentLink from "@/components/tutor/CopyStudentLink";
import DeleteStudentButton from "@/components/tutor/DeleteStudentButton";
import DeleteDemoButton from "@/components/tutor/DeleteDemoButton";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: students }, { data: lessons }, { data: subscriptions }] = await Promise.all([
    db.from("students").select("*").eq("tutor_id", tutorId).order("name"),
    db.from("lessons")
      .select("student_id, payment_status, price_rub, status, subscription_id")
      .eq("tutor_id", tutorId)
      .neq("status", "cancelled"),
    db.from("subscriptions").select("student_id, balance, total_amount, name, status").eq("tutor_id", tutorId),
  ]);

  // Долг по поурочным урокам (без абонемента)
  const debtMap: Record<string, number> = {};
  for (const l of lessons ?? []) {
    if (l.payment_status === "unpaid" && l.price_rub && !l.subscription_id) {
      debtMap[l.student_id] = (debtMap[l.student_id] ?? 0) + l.price_rub;
    }
  }

  // Активные абонементы
  const subMap: Record<string, { balance: number; total: number; name: string }> = {};
  for (const s of subscriptions ?? []) {
    if (s.status === "active") {
      subMap[s.student_id] = { balance: s.balance, total: s.total_amount, name: s.name };
    }
  }

  const card = {
    background: "white",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ученики</h1>
        <Link
          href="/tutor/students/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
        >
          <UserPlus size={16} />
          Добавить
        </Link>
      </div>

      {!students || students.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={card}>
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Учеников пока нет</p>
          <Link
            href="/tutor/students/new"
            className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            Добавить первого ученика
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(s => {
            const debt = debtMap[s.id] ?? 0;
            const sub  = subMap[s.id] ?? null;
            return (
              <div key={s.id} className="rounded-xl border p-4" style={card}>
                {/* Верхняя строка: аватар + имя + статус оплаты */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ background: "var(--gradient-primary)" }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/tutor/students/${s.id}`}
                        className="font-semibold hover:underline truncate"
                        style={{ color: "var(--brown-dark)" }}>
                        {s.name}
                      </Link>
                      {s.is_demo && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: "#fff8e6", color: "#a06800", border: "1px solid #f0c040" }}>
                          Пример
                        </span>
                      )}
                    </div>
                    {s.notes && (
                      <span className="text-xs truncate block" style={{ color: "var(--brown-mid)" }}>{s.notes}</span>
                    )}
                  </div>
                  {/* Статус: абонемент или долг */}
                  {sub ? (
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium shrink-0"
                      style={{
                        background: sub.balance < sub.total * 0.25 ? "#fff0f0" : "#f0fdf4",
                        color:      sub.balance < sub.total * 0.25 ? "#c0392b" : "#1a7a3a",
                        border:     `1px solid ${sub.balance < sub.total * 0.25 ? "#fecaca" : "#bbf7d0"}`,
                      }}>
                      {sub.balance.toLocaleString("ru")} ₽
                    </span>
                  ) : debt > 0 ? (
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium shrink-0"
                      style={{ background: "#fff3e0", color: "#c07800", border: "1px solid #f0d090" }}>
                      Долг: {debt.toLocaleString("ru")} ₽
                    </span>
                  ) : null}
                </div>

                {/* Нижняя строка: код + кнопки */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono px-2.5 py-1 rounded-lg"
                    style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                    {s.access_code}
                  </span>
                  <CopyStudentLink code={s.access_code} />
                  <Link href={`/student/${s.access_code}`} target="_blank"
                    className="text-sm px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-all"
                    style={{ background: "var(--gradient-primary)", color: "white" }}>
                    Кабинет ↗
                  </Link>
                  <Link href={`/tutor/students/${s.id}`}
                    className="text-sm px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-all border"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                    {sub ? "Абонемент" : "Детали"}
                  </Link>
                  {s.is_demo ? <DeleteDemoButton /> : <DeleteStudentButton id={s.id} name={s.name} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {students && students.length > 0 && (
        <p className="mt-4 text-sm" style={{ color: "var(--brown-light)" }}>
          Ученик входит по коду на странице{" "}
          <span className="font-mono" style={{ color: "var(--brown-mid)" }}>
            /student/КОД
          </span>
        </p>
      )}
    </div>
  );
}
