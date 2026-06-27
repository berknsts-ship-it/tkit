import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PracticeSession from "./PracticeSession";

interface Props {
  searchParams: Promise<{ topic?: string }>;
}

export default async function PracticePage({ searchParams }: Props) {
  const { topic: topicId } = await searchParams;
  if (!topicId) redirect("/tutor/vocabulary");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: topic }, { data: words }] = await Promise.all([
    supabase.from("vocabulary_topics").select("title, language").eq("id", topicId).single(),
    supabase.from("vocabulary_words").select("*").eq("topic_id", topicId),
  ]);

  if (!topic || !words || words.length === 0) redirect("/tutor/vocabulary");

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{topic.title}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--brown-light)" }}>{words.length} слов</p>
      <PracticeSession words={words} language={(topic as { language?: string }).language ?? "en-US"} />
    </div>
  );
}
