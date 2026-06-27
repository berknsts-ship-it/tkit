import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import NewLessonForm from "./NewLessonForm";
import LessonCard from "./LessonCard";

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: lessons }, { data: students }] = await Promise.all([
    db.from("lessons").select("*, students(name)")
      .eq("tutor_id", tutorId)
      .order("scheduled_at"),
    db.from("students").select("id, name, default_price_rub").eq("tutor_id", tutorId).order("name"),
  ]);

  const all = lessons ?? [];
  const upcoming   = all.filter(l => l.status === "scheduled");
  const past       = all.filter(l => l.status !== "scheduled");

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Расписание</h1>

      {/* Форма */}
      <div className="rounded-2xl border p-5 mb-6" style={card}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>Добавить занятие</h2>
        <NewLessonForm students={students ?? []} />
      </div>

      {/* Предстоящие */}
      <h2 className="font-semibold mb-3" style={{ color: "var(--brown-dark)" }}>Предстоящие</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm mb-6" style={{ color: "var(--brown-light)" }}>Нет запланированных занятий</p>
      ) : (
        <div className="space-y-2 mb-6">
          {upcoming.map(l => <LessonCard key={l.id} lesson={l} />)}
        </div>
      )}

      {/* Прошедшие */}
      {past.length > 0 && (
        <>
          <h2 className="font-semibold mb-3" style={{ color: "var(--brown-light)" }}>История</h2>
          <div className="space-y-2">
            {past.map(l => <LessonCard key={l.id} lesson={l} />)}
          </div>
        </>
      )}
    </div>
  );
}
