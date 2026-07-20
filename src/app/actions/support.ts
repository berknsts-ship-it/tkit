"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isCreator } from "@/lib/creatorMode";
import { Resend } from "resend";

const SUPPORT_EMAIL = process.env.CREATOR_EMAIL ?? "tkit.support@gmail.com";

export async function submitSupportMessage(formData: FormData) {
  const email = (formData.get("email") as string)?.trim() || null;
  const message = (formData.get("message") as string)?.trim();
  if (!message) return { error: "Напишите сообщение" };

  // Get current tutor if logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tutor_id = user?.id ?? null;

  // Upload screenshots
  const admin = createAdminClient();
  const screenshotUrls: string[] = [];
  const files = formData.getAll("screenshots") as File[];
  for (const file of files.slice(0, 3)) {
    if (!file.size) continue;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `support/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("board-images").upload(path, buf, { contentType: file.type, upsert: false });
    if (!upErr) screenshotUrls.push(admin.storage.from("board-images").getPublicUrl(path).data.publicUrl);
  }

  const { error: dbError } = await admin.from("support_messages").insert({
    email, message, tutor_id,
    ...(screenshotUrls.length ? { screenshots: screenshotUrls } : {}),
  });
  if (dbError) return { error: "Не удалось отправить. Попробуйте позже." };

  // Notify creator via email
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const screenshotLinks = screenshotUrls.map((url, i) => `Скрин ${i + 1}: ${url}`).join("\n");
    await resend.emails.send({
      from: "T-Kit Support <onboarding@resend.dev>",
      to: SUPPORT_EMAIL,
      subject: "Новое сообщение в поддержку T-Kit",
      text: [
        email ? `От: ${email}` : "От: (без email)",
        "",
        message,
        ...(screenshotLinks ? ["", screenshotLinks] : []),
      ].join("\n"),
    });
  }

  return { ok: true };
}

// Admin: save reply text to DB — tutor sees it in their chat widget
export async function replySupportMessage(id: string, replyText: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isCreator(user.email)) return { error: "Нет доступа" };

  const admin = createAdminClient();
  await admin.from("support_messages")
    .update({ reply_text: replyText, replied_at: new Date().toISOString() })
    .eq("id", id);
  return { ok: true };
}

export async function unmarkSupportReplied(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isCreator(user.email)) return;

  const admin = createAdminClient();
  await admin.from("support_messages").update({ replied_at: null, reply_text: null }).eq("id", id);
}

// Tutor: get their own messages with replies
export async function getTutorSupportMessages() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("support_messages")
    .select("id, message, created_at, reply_text, replied_at, tutor_read_at, screenshots")
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// Tutor: mark all replied messages as read
export async function markAllSupportRepliesRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from("support_messages")
    .update({ tutor_read_at: new Date().toISOString() })
    .eq("tutor_id", user.id)
    .not("reply_text", "is", null)
    .is("tutor_read_at", null);
}

// Tutor: count unread replies (has reply_text but no tutor_read_at)
export async function getUnreadSupportCount(tutorId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("support_messages")
    .select("*", { count: "exact", head: true })
    .eq("tutor_id", tutorId)
    .not("reply_text", "is", null)
    .is("tutor_read_at", null);
  return count ?? 0;
}
