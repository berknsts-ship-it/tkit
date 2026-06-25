"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createArticle(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const assignToAll = formData.get("assign_to_all") === "true";
  const studentIds = formData.getAll("student_ids") as string[];

  const { data: article, error } = await supabase
    .from("reference_articles")
    .insert({ tutor_id: user.id, title, content, assign_to_all: assignToAll })
    .select("id")
    .single();

  if (error || !article) throw new Error("Не удалось создать статью");

  if (!assignToAll && studentIds.length > 0) {
    await supabase.from("reference_article_students").insert(
      studentIds.map(student_id => ({ article_id: article.id, student_id }))
    );
  }

  revalidatePath("/tutor/reference");
  redirect("/tutor/reference");
}

export async function updateArticle(articleId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const assignToAll = formData.get("assign_to_all") === "true";
  const studentIds = formData.getAll("student_ids") as string[];

  const { error } = await supabase
    .from("reference_articles")
    .update({ title, content, assign_to_all: assignToAll, updated_at: new Date().toISOString() })
    .eq("id", articleId)
    .eq("tutor_id", user.id);

  if (error) throw new Error("Не удалось обновить статью");

  // Пересинхронизировать назначения
  await supabase
    .from("reference_article_students")
    .delete()
    .eq("article_id", articleId);

  if (!assignToAll && studentIds.length > 0) {
    await supabase.from("reference_article_students").insert(
      studentIds.map(student_id => ({ article_id: articleId, student_id }))
    );
  }

  revalidatePath("/tutor/reference");
  redirect("/tutor/reference");
}

export async function deleteArticle(articleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  await supabase
    .from("reference_articles")
    .delete()
    .eq("id", articleId)
    .eq("tutor_id", user.id);

  revalidatePath("/tutor/reference");
}
