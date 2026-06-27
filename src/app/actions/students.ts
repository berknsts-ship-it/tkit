"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createStudent(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const name = (formData.get("name") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!name) return { error: "Введите имя ученика" };

  let access_code = generateCode();
  // ensure uniqueness
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from("students").select("id").eq("access_code", access_code).single();
    if (!data) break;
    access_code = generateCode();
  }

  const { error } = await supabase.from("students").insert({
    tutor_id: user.id,
    name,
    notes,
    access_code,
  });

  if (error) return { error: error.message };
  revalidatePath("/tutor/students");
  redirect("/tutor/students");
}

export async function deleteStudent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("students").delete().eq("id", id).eq("tutor_id", user.id);
  revalidatePath("/tutor/students");
}
