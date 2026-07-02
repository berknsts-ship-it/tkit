"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { localToUTC, nextOccurrenceUTC } from "@/lib/notifUtils";

export async function createNotification(fields: {
  title: string;
  body: string;
  date: string;
  time: string;
  timezone: string;
  studentIds: string[];
  recurrenceDays?: number[];
  instant?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();

  let recipientIds = fields.studentIds;
  if (recipientIds.length === 0) {
    const { data: students } = await admin.from("students").select("id").eq("tutor_id", user.id);
    recipientIds = (students ?? []).map(s => s.id);
  }

  const isRecurring = (fields.recurrenceDays?.length ?? 0) > 0;
  const scheduledAt = fields.instant
    ? new Date().toISOString()
    : isRecurring
    ? nextOccurrenceUTC(fields.recurrenceDays!, fields.time, fields.timezone)
    : localToUTC(fields.date, fields.time, fields.timezone);

  const { data: notif, error } = await admin.from("notifications").insert({
    tutor_id: user.id,
    title: fields.title,
    body: fields.body,
    scheduled_at: scheduledAt,
    timezone: fields.timezone,
    recurrence_days: isRecurring ? fields.recurrenceDays : null,
    recurrence_time: isRecurring ? fields.time : null,
  }).select("id").single();

  if (error || !notif) return { error: error?.message ?? "Ошибка создания" };

  if (recipientIds.length > 0) {
    await admin.from("notification_recipients").insert(
      recipientIds.map(sid => ({ notification_id: notif.id, student_id: sid }))
    );
  }

  revalidatePath("/tutor/notifications");
  return { ok: true };
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").delete().eq("id", id).eq("tutor_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/tutor/notifications");
}

export async function markNotificationRead(notificationId: string, studentId: string) {
  const admin = createAdminClient();
  await admin.from("notification_reads").upsert(
    { notification_id: notificationId, student_id: studentId },
    { onConflict: "notification_id,student_id" }
  );
}
