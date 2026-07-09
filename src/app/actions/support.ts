"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isCreator } from "@/lib/creatorMode";
import { Resend } from "resend";

// eslint-disable-next-line @typescript-eslint/no-unused-vars

const SUPPORT_EMAIL = process.env.CREATOR_EMAIL ?? "tkit.support@gmail.com";

export async function submitSupportMessage(formData: FormData) {
  const email = (formData.get("email") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim();

  if (!message) return { error: "Напишите сообщение" };

  const supabase = createAdminClient();
  const { error: dbError } = await supabase.from("support_messages").insert({ email, message });
  if (dbError) return { error: "Не удалось отправить. Попробуйте позже." };

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "T-Kit Support <onboarding@resend.dev>",
      to: SUPPORT_EMAIL,
      ...(email ? { replyTo: email } : {}),
      subject: "Новое сообщение в поддержку T-Kit",
      text: [
        email ? `От: ${email}` : "От: (без email — ответить нельзя)",
        "",
        message,
      ].join("\n"),
    });
  }

  return { ok: true };
}

export async function markSupportReplied(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isCreator(user.email)) return;

  const admin = createAdminClient();
  await admin.from("support_messages").update({ replied_at: new Date().toISOString() }).eq("id", id);
}
