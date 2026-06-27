"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function submitSupportMessage(formData: FormData) {
  const email = (formData.get("email") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim();

  if (!message) return { error: "Напишите сообщение" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("support_messages").insert({ email, message });

  if (error) return { error: "Не удалось отправить. Попробуйте позже." };
  return { ok: true };
}
