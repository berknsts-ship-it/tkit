"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTopic(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const title      = (formData.get("title") as string)?.trim();
  const student_id = (formData.get("student_id") as string) || null;
  const language   = (formData.get("language") as string) || "en-US";
  if (!title) return { error: "Введите название темы" };

  const { data: topic, error } = await supabase
    .from("vocabulary_topics")
    .insert({ tutor_id: user.id, title, student_id, language })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const words: { word: string; translation: string; example?: string }[] = [];
  let i = 0;
  while (formData.get(`word_${i}`)) {
    const word = (formData.get(`word_${i}`) as string).trim();
    const translation = (formData.get(`trans_${i}`) as string).trim();
    const example = (formData.get(`example_${i}`) as string)?.trim() || undefined;
    if (word && translation) words.push({ word, translation, example });
    i++;
  }

  if (words.length > 0) {
    await supabase.from("vocabulary_words").insert(
      words.map(w => ({ topic_id: topic.id, ...w }))
    );
  }

  revalidatePath("/tutor/vocabulary");
  redirect("/tutor/vocabulary");
}

export async function deleteTopic(id: string) {
  const supabase = await createClient();
  await supabase.from("vocabulary_topics").delete().eq("id", id);
  revalidatePath("/tutor/vocabulary");
}
