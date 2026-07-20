import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram } from "./telegram";
import { pushToStudent } from "@/lib/push";

export interface NotifyPayload {
  title:      string;
  body:       string;
  action_url?: string;  // relative path, e.g. "/tutor/homework"
  type?:      string;   // for push tag
  emoji?:     string;   // prepended to Telegram message
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://t-kit.ru").replace(/\/$/, "");

function tgText({ title, body, emoji }: NotifyPayload) {
  return `${emoji ?? "🔔"} <b>${title}</b>\n${body}`;
}

export async function notifyStudent(studentId: string, payload: NotifyPayload) {
  const db = createAdminClient();
  const { data } = await db
    .from("students")
    .select("telegram_chat_id, notify_channels")
    .eq("id", studentId)
    .single();
  if (!data) return;

  const ch = (data.notify_channels as Record<string, boolean>) ?? {};
  const actionUrl = payload.action_url ? `${SITE_URL}${payload.action_url}` : undefined;

  if (ch.telegram !== false && data.telegram_chat_id) {
    sendTelegram(data.telegram_chat_id, tgText(payload), actionUrl).catch(() => {});
  }
  if (ch.push !== false) {
    pushToStudent(studentId, {
      title: payload.title,
      body:  payload.body,
      url:   payload.action_url ?? "/student",
      tag:   payload.type ?? "notification",
    }).catch(() => {});
  }
  // ch.max → sendMax() when implemented
  // ch.email → sendEmail() when implemented
}

export async function notifyTutor(tutorId: string, payload: NotifyPayload) {
  const db = createAdminClient();
  const { data } = await db
    .from("tutors")
    .select("telegram_chat_id, notify_channels")
    .eq("id", tutorId)
    .single();
  if (!data) return;

  const ch = (data.notify_channels as Record<string, boolean>) ?? {};
  const actionUrl = payload.action_url ? `${SITE_URL}${payload.action_url}` : undefined;

  if (ch.telegram !== false && data.telegram_chat_id) {
    sendTelegram(data.telegram_chat_id, tgText(payload), actionUrl).catch(() => {});
  }
}
