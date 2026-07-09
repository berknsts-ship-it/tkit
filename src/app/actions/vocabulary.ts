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
  const group_id   = (formData.get("group_id") as string) || null;
  const language   = (formData.get("language") as string) || "en-US";
  if (!title) return { error: "Введите название темы" };

  const { data: topic, error } = await supabase
    .from("vocabulary_topics")
    .insert({ tutor_id: user.id, title, student_id, group_id, language })
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

export async function updateTopicMeta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const id         = formData.get("id") as string;
  const title      = (formData.get("title") as string)?.trim();
  const student_id = (formData.get("student_id") as string) || null;
  const language   = (formData.get("language") as string) || "en-US";

  if (!title) return { error: "Введите название" };
  await supabase.from("vocabulary_topics").update({ title, student_id, language }).eq("id", id);
  revalidatePath(`/tutor/vocabulary/${id}`);
  revalidatePath("/tutor/vocabulary");
  return { ok: true };
}

export async function addWord(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const topic_id   = formData.get("topic_id") as string;
  const word       = (formData.get("word") as string)?.trim();
  const translation = (formData.get("translation") as string)?.trim();
  const example    = (formData.get("example") as string)?.trim() || null;

  if (!word || !translation) return { error: "Слово и перевод обязательны" };

  const { data, error } = await supabase
    .from("vocabulary_words")
    .insert({ topic_id, word, translation, example })
    .select("id, word, translation, example")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/tutor/vocabulary/${topic_id}`);
  return { ok: true, word: data };
}

export async function deleteWord(wordId: string, topicId: string) {
  const supabase = await createClient();
  await supabase.from("vocabulary_words").delete().eq("id", wordId);
  revalidatePath(`/tutor/vocabulary/${topicId}`);
}

export async function updateWord(formData: FormData) {
  const supabase = await createClient();
  const id          = formData.get("id") as string;
  const topic_id    = formData.get("topic_id") as string;
  const word        = (formData.get("word") as string)?.trim();
  const translation = (formData.get("translation") as string)?.trim();
  const example     = (formData.get("example") as string)?.trim() || null;

  if (!word || !translation) return { error: "Слово и перевод обязательны" };
  await supabase.from("vocabulary_words").update({ word, translation, example }).eq("id", id);
  revalidatePath(`/tutor/vocabulary/${topic_id}`);
  return { ok: true };
}
