import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  tag?:  string;
}

// Отправить пуш всем подпискам конкретного ученика
export async function pushToStudent(studentId: string, payload: PushPayload) {
  const db = createAdminClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("student_id", studentId);

  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      ).catch(async err => {
        // 410 Gone — подписка протухла, удаляем
        if (err.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      })
    )
  );
}
