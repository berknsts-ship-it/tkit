"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSubscription(studentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const name         = (formData.get("name") as string)?.trim() || "Абонемент";
  const totalAmount  = parseInt(formData.get("total_amount") as string);
  if (!totalAmount || totalAmount <= 0) return { error: "Введите сумму абонемента" };

  const db = createAdminClient();
  const { error } = await db.from("subscriptions").insert({
    tutor_id:     user.id,
    student_id:   studentId,
    name,
    total_amount: totalAmount,
    balance:      totalAmount,
    status:       "active",
  });

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
  redirect(`/tutor/students/${studentId}`);
}

export async function renewSubscription(subscriptionId: string, studentId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const addAmount = parseInt(formData.get("add_amount") as string);
  if (!addAmount || addAmount <= 0) return { error: "Введите сумму пополнения" };

  const db = createAdminClient();
  const { data: sub } = await db.from("subscriptions").select("total_amount, balance").eq("id", subscriptionId).single();
  if (!sub) return { error: "Абонемент не найден" };

  const { error } = await db.from("subscriptions").update({
    total_amount: sub.total_amount + addAmount,
    balance:      sub.balance + addAmount,
  }).eq("id", subscriptionId);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
  redirect(`/tutor/students/${studentId}`);
}

export async function cancelSubscription(subscriptionId: string, studentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const db = createAdminClient();
  const { error } = await db.from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subscriptionId)
    .eq("tutor_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/students/${studentId}`);
  redirect(`/tutor/students/${studentId}`);
}
