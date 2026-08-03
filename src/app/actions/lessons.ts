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

// Ручная (пере)привязка урока к абонементу — нужна для уроков, добавленных до
// того как абонемент был создан (авто-привязка срабатывает только в момент
// создания урока). Если урок уже проведён/сгорел и ещё не был списан — списываем
// сразу; если уже списан — просто меняем связь, баланс не трогаем (не задваиваем).
export async function setLessonSubscription(id: string, subscriptionId: string | null) {
  const supabase = await createClient();
  const { data: lesson, error: fetchErr } = await supabase.from("lessons")
    .select("status, price_rub, deducted_amount")
    .eq("id", id)
    .single();
  if (fetchErr || !lesson) return { error: "Урок не найден" };

  const { error } = await supabase.from("lessons").update({ subscription_id: subscriptionId }).eq("id", id);
  if (error) return { error: error.message };

  if (subscriptionId && lesson.price_rub && !lesson.deducted_amount &&
      (lesson.status === "completed" || lesson.status === "missed")) {
    const db = createAdminClient();
    await db.from("lessons").update({ deducted_amount: lesson.price_rub }).eq("id", id);
    await db.rpc("subscription_deduct", { p_id: subscriptionId, p_amount: lesson.price_rub });
    revalidatePath("/tutor/students");
  }

  revalidatePath("/tutor/schedule");
}

export async function rescheduleLesson(id: string, rescheduledTo: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons")
    .update({ status: "rescheduled", rescheduled_to: rescheduledTo })
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
