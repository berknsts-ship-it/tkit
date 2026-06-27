import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import BoardView from "./BoardView";
import type { BoardMaterial } from "@/components/shared/WhiteboardCanvas";

interface Props {
  searchParams: Promise<{ student?: string }>;
}

export default async function BoardPage({ searchParams }: Props) {
  const { student: studentId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const today = new Date();
  const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const [studentsRes, materialsRes] = await Promise.all([
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("materials").select("id, title, file_url, file_name").eq("tutor_id", tutorId).order("created_at", { ascending: false }),
  ]);
  const students  = studentsRes.data ?? [];
  const materials = materialsRes.data ?? [];

  let snapshots: { id: string; title: string; created_at: string; lesson_id: string | null; lessons?: { scheduled_at: string } | null }[] = [];
  let todayLesson: { id: string } | null = null;

  if (studentId) {
    const [snapshotsRes, lessonRes] = await Promise.all([
      db.from("board_snapshots")
        .select("id, title, created_at, lesson_id, lessons(scheduled_at)")
        .eq("student_id", studentId)
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false }),
      db.from("lessons")
        .select("id")
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId)
        .eq("status", "scheduled")
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .limit(1)
        .maybeSingle(),
    ]);
    snapshots   = (snapshotsRes.data ?? []) as unknown as typeof snapshots;
    todayLesson = lessonRes.data ?? null;
  }

  const activeStudent = students.find(s => s.id === studentId);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap shrink-0"
        style={{ borderColor: "var(--brown-pale)", background: "white" }}>
        <span className="font-semibold text-sm shrink-0" style={{ color: "var(--brown-dark)" }}>Доска</span>
        <div className="flex gap-2 flex-wrap overflow-x-auto">
          {students.map(s => (
            <Link key={s.id} href={`/tutor/board?student=${s.id}`}
              className="text-sm px-3 py-1 rounded-lg border transition-all whitespace-nowrap"
              style={{
                borderColor: s.id === studentId ? "var(--brown-dark)" : "var(--brown-pale)",
                background:  s.id === studentId ? "var(--brown-pale)" : "transparent",
                color:       s.id === studentId ? "var(--brown-dark)" : "var(--brown-mid)",
                fontWeight:  s.id === studentId ? 600 : 400,
              }}>
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      {studentId && activeStudent ? (
        <BoardView
          studentId={studentId}
          materials={materials as BoardMaterial[]}
          snapshots={snapshots}
          todayLessonId={todayLesson?.id}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl">🖊️</div>
          <p className="font-medium" style={{ color: "var(--brown-dark)" }}>Выберите ученика</p>
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>
            {(students ?? []).length === 0
              ? "Сначала добавьте ученика"
              : "Нажмите на имя выше, чтобы открыть доску"}
          </p>
        </div>
      )}
    </div>
  );
}
