"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { revalidatePath } from "next/cache";

export async function markWelcomeShown() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await createAdminClient().from("tutors").update({ welcome_shown: true }).eq("id", user.id);
}

export async function dismissOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await createAdminClient()
    .from("tutors")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  revalidatePath("/tutor/dashboard");
}

export async function markOnboardingStep(step: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const db = createAdminClient();
  const { data: tutor } = await db.from("tutors").select("onboarding_steps").eq("id", user.id).single();
  const steps = (tutor?.onboarding_steps ?? {}) as Record<string, boolean>;
  if (steps[step]) return;
  await db.from("tutors").update({ onboarding_steps: { ...steps, [step]: true } }).eq("id", user.id);
}

export async function deleteDemoStudent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const { data: demo } = await db
    .from("students")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("is_demo", true)
    .maybeSingle();

  if (!demo) return { error: "Демо-ученик не найден" };

  await db.from("vocabulary_topics").delete().eq("student_id", demo.id);
  await db.from("homework").delete().eq("student_id", demo.id);
  await db.from("lessons").delete().eq("student_id", demo.id);
  await db.from("materials").delete().eq("student_id", demo.id).eq("tutor_id", tutorId);
  await db.from("students").delete().eq("id", demo.id).eq("tutor_id", tutorId);

  revalidatePath("/tutor/students");
  revalidatePath("/tutor/dashboard");
  return { ok: true };
}
