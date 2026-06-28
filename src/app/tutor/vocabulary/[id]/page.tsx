import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import TopicEditor from "./TopicEditor";

export default async function EditTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const admin = createAdminClient();

  const [{ data: topic }, { data: students }] = await Promise.all([
    admin.from("vocabulary_topics")
      .select("id, title, student_id, language, vocabulary_words(id, word, translation, example)")
      .eq("id", id)
      .eq("tutor_id", tutorId)
      .single(),
    admin.from("students")
      .select("id, name")
      .eq("tutor_id", tutorId)
      .order("name"),
  ]);

  if (!topic) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tutor/vocabulary"
          className="text-sm hover:underline"
          style={{ color: "var(--brown-light)" }}>
          ← Тренажёр
        </Link>
        <span style={{ color: "var(--brown-pale)" }}>/</span>
        <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{topic.title}</span>
      </div>

      <TopicEditor
        topic={{
          id: topic.id,
          title: topic.title,
          student_id: topic.student_id ?? null,
          language: topic.language ?? "en-US",
          words: (topic.vocabulary_words ?? []) as { id: string; word: string; translation: string; example?: string | null }[],
        }}
        students={(students ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
