"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateLessonStatus(id: string, status: string) {
  const supabase = await createClient();
  await supabase.from("lessons").update({ status }).eq("id", id);
  revalidatePath("/tutor/schedule");
}

export async function rescheduleLesson(id: string, scheduledAt: string) {
  const supabase = await createClient();
  await supabase.from("lessons")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", id);
  revalidatePath("/tutor/schedule");
}

export async function togglePaymentStatus(id: string, current: "paid" | "unpaid") {
  const supabase = await createClient();
  await supabase.from("lessons")
    .update({ payment_status: current === "paid" ? "unpaid" : "paid" })
    .eq("id", id);
  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/students");
  revalidatePath("/tutor/dashboard");
}
