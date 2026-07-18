import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import BoardView from "./BoardView";
import type { BoardMaterial } from "@/components/shared/WhiteboardCanvas";

interface Props {
  searchParams: Promise<{ student?: string; group?: string }>;
}

export default async function BoardPage({ searchParams }: Props) {
  const { student: studentId, group: groupId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const today = new Date();
  const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const [studentsRes, groupsRes, materialsRes, tutorRes] = await Promise.all([
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("groups").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("materials").select("id, title, file_url, file_name").eq("tutor_id", tutorId).order("created_at", { ascending: false }),
    db.from("tutors").select("subject_profile, board_bg, onboarding_steps, onboarding_completed, name").eq("id", tutorId).single(),
  ]);
  const students   = studentsRes.data ?? [];
  const groups     = groupsRes.data ?? [];
  const materials  = materialsRes.data ?? [];
  const subjectProfile = tutorRes.data?.subject_profile ?? "other";
  const boardBg        = tutorRes.data?.board_bg        ?? "dots";
  const tutorName      = tutorRes.data?.name            ?? undefined;

  // Помечаем шаг онбординга open_board (единоразово)
  if (!tutorRes.data?.onboarding_completed) {
    const steps = (tutorRes.data?.onboarding_steps ?? {}) as Record<string, boolean>;
    if (!steps.open_board) {
      await db.from("tutors")
        .update({ onboarding_steps: { ...steps, open_board: true } })
        .eq("id", tutorId);
    }
  }

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

  let groupStudents: { id: string; name: string }[] = [];
  if (groupId) {
    const { data: gm } = await db
      .from("group_members")
      .select("students(id, name)")
      .eq("group_id", groupId);
    groupStudents = ((gm ?? []) as unknown as { students: { id: string; name: string } }[])
      .map(m => m.students)
      .filter(Boolean);
  }

  const activeStudent = students.find(s => s.id === studentId);
  const activeGroup   = groups.find(g => g.id === groupId);

  // roomId: для группы — group_id, для ученика — student_id
  const roomId = groupId ?? studentId;

  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col z-20" style={{ top: "56px" }}>
      {/* Шапка с табами */}
      <div className="flex items-center border-b shrink-0"
        style={{ borderColor: "var(--brown-pale)", background: "white" }}>
        <span className="font-semibold text-sm shrink-0 px-3 py-2.5" style={{ color: "var(--brown-dark)" }}>Доска</span>
        <div className="flex gap-2 overflow-x-auto px-1 py-2" style={{ touchAction: "pan-x" }}>
          {/* Ученики */}
          {students.map(s => (
            <Link key={s.id} href={`/tutor/board?student=${s.id}`}
              className="text-sm px-3 py-1 rounded-lg border transition-all whitespace-nowrap shrink-0"
              style={{
                borderColor: s.id === studentId ? "var(--brown-dark)" : "var(--brown-pale)",
                background:  s.id === studentId ? "var(--brown-pale)" : "transparent",
                color:       s.id === studentId ? "var(--brown-dark)" : "var(--brown-mid)",
                fontWeight:  s.id === studentId ? 600 : 400,
              }}>
              {s.name}
            </Link>
          ))}

          {/* Разделитель, если есть и ученики и группы */}
          {students.length > 0 && groups.length > 0 && (
            <div className="w-px self-stretch mx-1 shrink-0" style={{ background: "var(--brown-pale)" }} />
          )}

          {/* Группы */}
          {groups.map(g => (
            <Link key={g.id} href={`/tutor/board?group=${g.id}`}
              className="text-sm px-3 py-1 rounded-lg border transition-all whitespace-nowrap shrink-0"
              style={{
                borderColor: g.id === groupId ? "var(--brown-dark)" : "var(--brown-pale)",
                background:  g.id === groupId ? "#eef4ff" : "transparent",
                color:       g.id === groupId ? "var(--brown-dark)" : "var(--brown-mid)",
                fontWeight:  g.id === groupId ? 600 : 400,
              }}>
              👥 {g.name}
            </Link>
          ))}
        </div>
      </div>

      {roomId && (activeStudent || activeGroup) ? (
        <BoardView
          roomId={roomId}
          studentId={studentId}
          studentName={activeStudent?.name}
          materials={materials as BoardMaterial[]}
          snapshots={studentId ? snapshots : []}
          todayLessonId={todayLesson?.id}
          isGroup={!!groupId}
          groupStudents={groupStudents}
          subjectProfile={subjectProfile}
          boardBg={boardBg}
          tutorName={tutorName}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl">🖊️</div>
          <p className="font-medium" style={{ color: "var(--brown-dark)" }}>Выберите ученика или группу</p>
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>
            {students.length === 0 && groups.length === 0
              ? "Сначала добавьте ученика"
              : "Нажмите на имя выше, чтобы открыть доску"}
          </p>
        </div>
      )}
    </div>
  );
}
