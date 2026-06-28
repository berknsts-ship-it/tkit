import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToStudent } from "@/lib/push";

// Vercel Cron вызывает этот роут каждые 30 минут
// Находим уроки, которые начнутся через 55–65 минут (окно не пересекается при двух запусках)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date();
  const from = new Date(now.getTime() + 55 * 60 * 1000);
  const to   = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: lessons } = await db
    .from("lessons")
    .select("id, student_id, scheduled_at, duration_min, students(name), tutors(name)")
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gte("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString());

  if (!lessons?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const lesson of lessons) {
    const student = Array.isArray(lesson.students) ? lesson.students[0] : lesson.students;
    const tutor   = Array.isArray(lesson.tutors)   ? lesson.tutors[0]   : lesson.tutors;
    const time    = new Date(lesson.scheduled_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

    await pushToStudent(lesson.student_id, {
      title: "Скоро урок! ⏰",
      body:  `Урок с ${tutor?.name ?? "репетитором"} в ${time}. До начала ~1 час.`,
      url:   "/student",
      tag:   `lesson-${lesson.id}`,
    });

    await db.from("lessons").update({ reminder_sent: true }).eq("id", lesson.id);
    sent++;
  }

  return NextResponse.json({ sent });
}
