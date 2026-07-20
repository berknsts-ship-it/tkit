"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyStudent } from "@/lib/notifications/send";

export async function createHomework(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const student_id = formData.get("student_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const due_date = (formData.get("due_date") as string) || null;

  if (!student_id || !title) redirect("/tutor/homework/new");

  const { error } = await supabase.from("homework").insert({
    tutor_id: user.id,
    student_id,
    title,
    description,
    due_date,
  });
  if (error) redirect("/tutor/homework/new?error=1");

  // Уведомление ученику (не блокируем редирект)
  notifyStudent(student_id, {
    title:      "Новое домашнее задание",
    body:       due_date
      ? `«${title}» — сдать до ${new Date(due_date).toLocaleDateString("ru", { day: "numeric", month: "long" })}`
      : `«${title}»`,
    action_url: "/student",
    type:       "homework-new",
    emoji:      "📝",
  }).catch(() => {});

  revalidatePath("/tutor/homework");
  redirect("/tutor/homework");
}

export async function updateHomeworkStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("homework").update({ status }).eq("id", id).eq("tutor_id", user.id);
  if (error) return;
  revalidatePath("/tutor/homework");
}

export async function studentSubmitHomework(id: string, studentId: string) {
  const supabase = createAdminClient();
  await supabase.from("homework")
    .update({ status: "submitted" })
    .eq("id", id)
    .eq("student_id", studentId);
}

export async function studentUnsubmitHomework(id: string, studentId: string) {
  const supabase = createAdminClient();
  await supabase.from("homework")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("student_id", studentId);
}
