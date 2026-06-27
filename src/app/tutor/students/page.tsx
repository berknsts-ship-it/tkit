import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { deleteStudent } from "@/app/actions/students";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import CopyStudentLink from "@/components/tutor/CopyStudentLink";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: students }, { data: lessons }] = await Promise.all([
    db.from("students").select("*").eq("tutor_id", tutorId).order("name"),
    db.from("lessons")
      .select("student_id, payment_status, price_rub, status")
      .eq("tutor_id", tutorId)
      .neq("status", "cancelled"),
  ]);

  // Compute balance per student (sum of price_rub for unpaid lessons)
  const debtMap: Record<string, number> = {};
  for (const l of lessons ?? []) {
    if (l.payment_status === "unpaid" && l.price_rub) {
      debtMap[l.student_id] = (debtMap[l.student_id] ?? 0) + l.price_rub;
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
            return (
              <div key={s.id} className="rounded-xl border p-4 flex items-center gap-4" style={card}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ background: "var(--gradient-primary)" }}>
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {s.notes && <span className="text-sm truncate" style={{ color: "var(--brown-mid)" }}>{s.notes}</span>}
                    {s.default_price_rub && (
                      <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                        {s.default_price_rub} ₽/занятие
                      </span>
                    )}
                  </div>
                </div>

                {/* Долг */}
                {debt > 0 && (
                  <div className="shrink-0 text-sm font-semibold px-3 py-1 rounded-lg"
                    style={{ background: "#fff3e0", color: "#c07800", border: "1px solid #f0d090" }}>
                    Долг: {debt.toLocaleString("ru")} ₽
                  </div>
                )}
                {debt === 0 && Object.prototype.hasOwnProperty.call(debtMap, s.id) === false && null}

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="text-sm font-mono px-3 py-1 rounded-lg" style={{
                    background: "var(--brown-pale)", color: "var(--brown-dark)"
                  }}>
                    {s.access_code}
                  </div>
                  <CopyStudentLink code={s.access_code} />
                  <Link
                    href={`/student/${s.access_code}`}
                    target="_blank"
                    className="text-sm px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-all"
                    style={{ background: "var(--gradient-primary)", color: "white" }}
                  >
                    Открыть ↗
                  </Link>
                  <form action={async () => { "use server"; await deleteStudent(s.id); }}>
                    <button type="submit" className="text-xs px-2 py-1 rounded-lg border hover:opacity-70 transition-all"
                      style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}>
                      Удалить
                    </button>
                  </form>
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
