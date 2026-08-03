"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createSubscription(studentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const name         = (formData.get("name") as string)?.trim() || "Абонемент";
  const totalAmount  = parseInt(formData.get("total_amount") as string);
  if (!totalAmount || totalAmount <= 0) return { error: "Введите сумму абонемента" };

  const db = createAdminClient();
  const { error } = await db.from("student_subscriptions").insert({
    tutor_id:     user.id,
    student_id:   studentId,
    name,
    total_amount: totalAmount,
    balance:      totalAmount,
    status:       "active",
  });

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
}

export async function renewSubscription(subscriptionId: string, studentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const addAmount = parseInt(formData.get("add_amount") as string);
  if (!addAmount || addAmount <= 0) return { error: "Введите сумму пополнения" };

  const db = createAdminClient();
  const { data: sub } = await db.from("student_subscriptions")
    .select("total_amount, balance")
    .eq("id", subscriptionId)
    .eq("tutor_id", user.id)
    .single();
  if (!sub) return { error: "Абонемент не найден" };

  const { error } = await db.from("student_subscriptions").update({
    total_amount: sub.total_amount + addAmount,
    balance:      sub.balance + addAmount,
  }).eq("id", subscriptionId).eq("tutor_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
}

// Абонемент оплачивается целиком одной суммой — если он оплачен, все уроки,
// которые с него списываются, тоже фактически оплачены (деньги уже получены
// вперёд). Синхронизируем payment_status у уже привязанных уроков в обе стороны.
export async function toggleSubscriptionPaid(subscriptionId: string, studentId: string, current: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const db = createAdminClient();
  const nextPaid = !current;
  const { error } = await db.from("student_subscriptions")
    .update({ paid: nextPaid })
    .eq("id", subscriptionId)
    .eq("tutor_id", user.id);

  if (error) return { error: error.message };

  await db.from("lessons")
    .update({ payment_status: nextPaid ? "paid" : "unpaid" })
    .eq("subscription_id", subscriptionId);

  revalidatePath(`/tutor/students/${studentId}`);
  revalidatePath("/tutor/schedule");
}

export async function cancelSubscription(subscriptionId: string, studentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const db = createAdminClient();
  const { error } = await db.from("student_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId)
    .eq("tutor_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
}
