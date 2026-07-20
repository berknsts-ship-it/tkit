"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "tkit_notify_bot";

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function generateTelegramLink(): Promise<{ code: string; url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  await admin.from("telegram_link_codes").delete().eq("tutor_id", user.id);

  const code      = makeCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await admin.from("telegram_link_codes").insert({ code, tutor_id: user.id, expires_at: expiresAt });
  if (error) return { error: "Ошибка генерации кода" };

  return { code, url: `https://t.me/${BOT_USERNAME}?start=${code}` };
}

export async function unlinkTelegram() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tutors").update({ telegram_chat_id: null }).eq("id", user.id);
  revalidatePath("/tutor/settings");
}

export async function updateNotifyChannels(channels: Record<string, boolean>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tutors").update({ notify_channels: channels }).eq("id", user.id);
}

// Generates a link for a student (called from student card or board)
export async function generateStudentTelegramLink(studentId: string): Promise<{ code: string; url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: s } = await supabase.from("students").select("id").eq("id", studentId).eq("tutor_id", user.id).single();
  if (!s) return { error: "Ученик не найден" };

  const admin = createAdminClient();
  await admin.from("telegram_link_codes").delete().eq("student_id", studentId);

  const code      = makeCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await admin.from("telegram_link_codes").insert({ code, student_id: studentId, expires_at: expiresAt });
  if (error) return { error: "Ошибка генерации кода" };

  return { code, url: `https://t.me/${BOT_USERNAME}?start=${code}` };
}
