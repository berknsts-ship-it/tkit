import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { studentId, subscription } = await req.json();
  if (!studentId || !subscription?.endpoint) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // If there's an authenticated session, verify ownership
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: student } = await supabase
      .from("students").select("id").eq("id", studentId).eq("tutor_id", user.id).single();
    if (!student) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: student } = await supabase
      .from("students").select("id").eq("id", studentId).eq("tutor_id", user.id).single();
    if (!student) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  await db.from("push_subscriptions").delete()
    .eq("student_id", studentId).eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
