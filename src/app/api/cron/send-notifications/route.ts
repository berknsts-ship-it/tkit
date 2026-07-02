import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToStudent } from "@/lib/push";
import { nextOccurrenceUTC } from "@/lib/notifUtils";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  // One-time unsent + first occurrence of recurring
  const { data: unsent } = await db.from("notifications")
    .select("id, title, body, timezone, recurrence_days, recurrence_time, notification_recipients(student_id)")
    .is("sent_at", null)
    .lte("scheduled_at", now);

  // Recurring: subsequent occurrences (sent_at set, but next scheduled_at has arrived)
  const { data: recurringDue } = await db.from("notifications")
    .select("id, title, body, timezone, recurrence_days, recurrence_time, notification_recipients(student_id)")
    .not("sent_at", "is", null)
    .not("recurrence_days", "is", null)
    .lte("scheduled_at", now);

  const all = [...(unsent ?? []), ...(recurringDue ?? [])];
  if (!all.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const notif of all) {
    const recipients = (notif.notification_recipients as { student_id: string }[]) ?? [];
    const isRecurring = !!notif.recurrence_days;

    if (isRecurring) {
      await db.from("notification_reads").delete().eq("notification_id", notif.id);
    }

    for (const { student_id } of recipients) {
      await pushToStudent(student_id, { title: notif.title, body: notif.body, tag: `notif-${notif.id}` });
      sent++;
    }

    const updates: Record<string, unknown> = { sent_at: new Date().toISOString() };
    if (isRecurring && notif.recurrence_time) {
      updates.scheduled_at = nextOccurrenceUTC(
        notif.recurrence_days as number[],
        notif.recurrence_time as string,
        notif.timezone as string,
      );
    }
    await db.from("notifications").update(updates).eq("id", notif.id);
  }

  return NextResponse.json({ sent });
}
