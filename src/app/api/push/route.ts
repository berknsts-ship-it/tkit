import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { studentId, subscription } = await req.json();
  if (!studentId || !subscription?.endpoint) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const db = createAdminClient();
  await db.from("push_subscriptions").upsert({
    student_id: studentId,
    endpoint:   subscription.endpoint,
    p256dh:     subscription.keys.p256dh,
    auth:       subscription.keys.auth,
  }, { onConflict: "student_id,endpoint" });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { studentId, endpoint } = await req.json();
  if (!studentId || !endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = createAdminClient();
  await db.from("push_subscriptions").delete()
    .eq("student_id", studentId).eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
