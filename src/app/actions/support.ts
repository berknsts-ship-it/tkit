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

  // Upload screenshots to Supabase Storage
  const admin = createAdminClient();
  const screenshotUrls: string[] = [];
  const files = formData.getAll("screenshots") as File[];
  for (const file of files.slice(0, 3)) {
    if (!file.size) continue;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `support/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("board-images").upload(path, buf, { contentType: file.type, upsert: false });
    if (!upErr) {
      const { data } = admin.storage.from("board-images").getPublicUrl(path);
      screenshotUrls.push(data.publicUrl);
    }
  }

  const { error: dbError } = await admin.from("support_messages").insert({
    email, message,
    ...(screenshotUrls.length ? { screenshots: screenshotUrls } : {}),
  });
  if (dbError) return { error: "Не удалось отправить. Попробуйте позже." };

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const screenshotLinks = screenshotUrls.map((url, i) => `Скрин ${i + 1}: ${url}`).join("\n");
    await resend.emails.send({
      from: "T-Kit Support <onboarding@resend.dev>",
      to: SUPPORT_EMAIL,
      ...(email ? { replyTo: email } : {}),
      subject: "Новое сообщение в поддержку T-Kit",
      text: [
        email ? `От: ${email}` : "От: (без email — ответить нельзя)",
        "",
        message,
        ...(screenshotLinks ? ["", screenshotLinks] : []),
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

export async function unmarkSupportReplied(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isCreator(user.email)) return;

  const admin = createAdminClient();
  await admin.from("support_messages").update({ replied_at: null }).eq("id", id);
}

export async function replySupportMessage(id: string, toEmail: string, replyText: string, originalMessage: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isCreator(user.email)) return { error: "Нет доступа" };

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "T-Kit Support <onboarding@resend.dev>",
      to: toEmail,
      subject: "Ответ от поддержки T-Kit",
      text: [
        replyText,
        "",
        "---",
        "Ваш вопрос:",
        `> ${originalMessage}`,
      ].join("\n"),
    });
    if (error) return { error: "Не удалось отправить письмо" };
  }

  const admin = createAdminClient();
  await admin.from("support_messages").update({ replied_at: new Date().toISOString() }).eq("id", id);
  return { ok: true };
}
