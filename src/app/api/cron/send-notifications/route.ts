import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToStudent } from "@/lib/push";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: notifications } = await db.from("notifications")
    .select("id, title, body, notification_recipients(student_id)")
    .is("sent_at", null)
    .lte("scheduled_at", new Date().toISOString());

  if (!notifications?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const notif of notifications) {
    const recipients = (notif.notification_recipients as { student_id: string }[]) ?? [];
    for (const { student_id } of recipients) {
      await pushToStudent(student_id, {
        title: notif.title,
        body: notif.body,
        tag: `notif-${notif.id}`,
      });
      sent++;
    }
    await db.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notif.id);
  }

  return NextResponse.json({ sent });
}
