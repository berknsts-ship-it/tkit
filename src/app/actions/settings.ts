"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveBoardProfile(subjectProfile: string, boardBg: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("tutors")
    .update({ subject_profile: subjectProfile, board_bg: boardBg })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Помечаем шаг онбординга (без ошибки если не выполнится)
  const db = createAdminClient();
  const { data: tutor } = await db.from("tutors")
    .select("onboarding_steps, onboarding_completed")
    .eq("id", user.id).single();
  if (!tutor?.onboarding_completed) {
    const steps = (tutor?.onboarding_steps ?? {}) as Record<string, boolean>;
    if (!steps.settings_profile) {
      await db.from("tutors")
        .update({ onboarding_steps: { ...steps, settings_profile: true } })
        .eq("id", user.id);
    }
  }

  revalidatePath("/tutor/settings");
  return { ok: true };
}
