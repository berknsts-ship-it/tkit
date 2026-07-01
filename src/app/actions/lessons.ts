"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateLessonStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  // Списываем с абонемента при проведении или сгорании урока
  if (status === "completed" || status === "missed") {
    const db = createAdminClient();
    const { data: lesson } = await db.from("lessons")
      .select("subscription_id, price_rub, deducted_amount")
      .eq("id", id)
      .single();

    if (lesson?.subscription_id && lesson?.price_rub && !lesson?.deducted_amount) {
      await db.from("lessons").update({ deducted_amount: lesson.price_rub }).eq("id", id);
      await db.rpc("subscription_deduct", { p_id: lesson.subscription_id, p_amount: lesson.price_rub });
      revalidatePath("/tutor/students");
    }
  }

  revalidatePath("/tutor/schedule");
}

export async function rescheduleLesson(id: string, scheduledAt: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tutor/schedule");
}

export async function updateLesson(id: string, fields: {
  scheduled_at?: string;
  duration_min?: number;
  price_rub?: number | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update(fields).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/students");
}

export async function deleteLesson(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/students");
  revalidatePath("/tutor/dashboard");
}

export async function togglePaymentStatus(id: string, current: "paid" | "unpaid") {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons")
    .update({ payment_status: current === "paid" ? "unpaid" : "paid" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/students");
  revalidatePath("/tutor/dashboard");
}
