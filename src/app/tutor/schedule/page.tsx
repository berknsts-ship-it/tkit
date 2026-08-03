import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import NewLessonForm from "./NewLessonForm";
import LessonCard from "./LessonCard";
import CalendarView from "./CalendarView";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isCalendar = view === "calendar";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [{ data: lessons }, { data: students }, { data: subscriptions }, { data: groups }] = await Promise.all([
    db.from("lessons").select("*, students(name), groups(name)")
      .eq("tutor_id", tutorId)
      .gte("scheduled_at", sixMonthsAgo.toISOString())
      .order("scheduled_at"),
    db.from("students").select("id, name, default_price_rub").eq("tutor_id", tutorId).order("name"),
    db.from("student_subscriptions").select("id, student_id, balance, name").eq("tutor_id", tutorId).eq("status", "active"),
    db.from("groups").select("id, name").eq("tutor_id", tutorId).order("name"),
  ]);

  const all      = lessons ?? [];
  const upcoming = all.filter(l => l.status === "scheduled");
  const past     = all.filter(l => l.status !== "scheduled");
  const card     = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  const tabBase  = "px-4 py-2 rounded-xl text-sm font-medium transition-all";
  const tabActive  = { background: "var(--gradient-primary)", color: "white" };
  const tabInactive = { color: "var(--brown-mid)", border: "1px solid var(--brown-pale)", background: "white" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Расписание</h1>
        <div className="flex gap-2">
          <Link href="/tutor/schedule" className={tabBase}
            style={!isCalendar ? tabActive : tabInactive}>
            Список
          </Link>
          <Link href="/tutor/schedule?view=calendar" className={tabBase}
            style={isCalendar ? tabActive : tabInactive}>
            Календарь
          </Link>
        </div>
      </div>

      {isCalendar ? (
        /* ── Вид: Календарь ── */
        <div className="rounded-2xl border p-4 sm:p-5" style={card}>
          <CalendarView
            lessons={all}
            students={students ?? []}
            subscriptions={subscriptions ?? []}
            groups={groups ?? []}
          />
        </div>
      ) : (
        /* ── Вид: Список ── */
        <>
          <div className="rounded-2xl border p-5 mb-6" style={card}>
            <h2 className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>Добавить занятие</h2>
            <NewLessonForm students={students ?? []} subscriptions={subscriptions ?? []} groups={groups ?? []} />
          </div>

          <h2 className="font-semibold mb-3" style={{ color: "var(--brown-dark)" }}>Предстоящие</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm mb-6" style={{ color: "var(--brown-light)" }}>Нет запланированных занятий</p>
          ) : (
            <div className="space-y-2 mb-6">
              {upcoming.map(l => <LessonCard key={l.id} lesson={l} />)}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="font-semibold mb-3" style={{ color: "var(--brown-light)" }}>История</h2>
              <div className="space-y-2">
                {past.map(l => <LessonCard key={l.id} lesson={l} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
