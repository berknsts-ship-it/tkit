import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import StudentCabinet from "@/components/student/StudentCabinet";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function StudentPage({ params }: Props) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, tutor_id, notes")
    .eq("access_code", code.toUpperCase())
    .single();

  if (!student) redirect(`/student?error=not_found&code=${encodeURIComponent(code)}`);

  const [
    { data: lessons },
    { data: homework },
    { data: materials },
    { data: allArticles },
    { data: snapshots },
    { data: topicsRaw },
  ] = await Promise.all([
    supabase.from("lessons").select("*").eq("student_id", student.id)
      .eq("status", "scheduled").order("scheduled_at"),
    supabase.from("homework").select("*").eq("student_id", student.id)
      .in("status", ["pending", "submitted"]).order("due_date"),
    supabase.from("materials").select("*")
      .eq("tutor_id", student.tutor_id)
      .or(`student_id.eq.${student.id},student_id.is.null`)
      .order("created_at", { ascending: false }),
    supabase.from("reference_articles")
      .select("id, title, content, assign_to_all, reference_article_students(student_id)")
      .eq("tutor_id", student.tutor_id)
      .order("sort_order").order("created_at"),
    supabase.from("board_snapshots")
      .select("id, title, created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase.from("vocabulary_topics")
      .select("id, title, language, vocabulary_words(id, word, translation, example)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
  ]);

  const { data: tutor } = await supabase
    .from("tutors").select("subject").eq("id", student.tutor_id).single();

  const articles = (allArticles ?? []).filter(a =>
    a.assign_to_all ||
    a.reference_article_students.some((r: { student_id: string }) => r.student_id === student.id)
  );

  return (
    <StudentCabinet
      studentId={student.id}
      student={{ name: student.name }}
      subject={tutor?.subject ?? null}
      lessons={lessons ?? []}
      homework={homework ?? []}
      materials={materials ?? []}
      articles={articles.map(a => ({ id: a.id, title: a.title, content: a.content }))}
      snapshots={snapshots ?? []}
      topics={(topicsRaw ?? []).map(t => ({
        id: t.id, title: t.title, language: t.language ?? "en-US",
        words: (t.vocabulary_words ?? []) as { id: string; word: string; translation: string; example?: string | null }[],
      }))}
    />
  );
}
