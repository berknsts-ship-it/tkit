"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveMeetingUrl(meetingUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("tutors")
    .update({ meeting_url: meetingUrl.trim() || null })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/tutor/settings");
  return { ok: true };
}

export async function saveBoardProfile(subjectProfile: string, boardBg: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("tutors")
    .update({ subject_profile: subjectProfile, board_bg: boardBg })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/tutor/settings");
  return { ok: true };
}
