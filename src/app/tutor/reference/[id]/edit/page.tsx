import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReferenceEditor from "@/components/tutor/ReferenceEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: article }, { data: students }] = await Promise.all([
    supabase
      .from("reference_articles")
      .select("id, title, content, assign_to_all, reference_article_students(student_id)")
      .eq("id", id)
      .eq("tutor_id", user!.id)
      .single(),
    supabase
      .from("students")
      .select("id, name")
      .eq("tutor_id", user!.id)
      .order("name"),
  ]);

  if (!article) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Редактировать статью</h1>
      <ReferenceEditor
        students={students ?? []}
        article={{
          id: article.id,
          title: article.title,
          content: article.content,
          assign_to_all: article.assign_to_all,
          assigned_student_ids: article.reference_article_students.map(
            (r: { student_id: string }) => r.student_id
          ),
        }}
      />
    </div>
  );
}
