"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveSnapshot(studentId: string, title: string, items: unknown[], lessonId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase.from("board_snapshots").insert({
    tutor_id:   user.id,
    student_id: studentId,
    lesson_id:  lessonId ?? null,
    title:      title.trim() || new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
    items,
  });
  revalidatePath(`/tutor/board/${studentId}`);
}

export async function updateSnapshot(id: string, items: unknown[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase.from("board_snapshots")
    .update({ items, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tutor_id", user.id);
}

export async function deleteSnapshot(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase.from("board_snapshots").delete().eq("id", id).eq("tutor_id", user.id);
}

export async function getSnapshots(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("board_snapshots")
    .select("id, title, created_at, lesson_id, lessons(scheduled_at)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getSnapshotItems(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("board_snapshots")
    .select("items")
    .eq("id", id)
    .single();
  return (data?.items as unknown[]) ?? [];
}

export async function renameSnapshot(id: string, title: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("board_snapshots").update({ title }).eq("id", id).eq("tutor_id", user.id);
}

export async function saveBoardState(studentId: string, items: unknown[]) {
  const db = createAdminClient();
  await db.from("boards").upsert(
    { student_id: studentId, data: { items }, updated_at: new Date().toISOString() },
    { onConflict: "student_id" }
  );
}

export async function loadBoardState(studentId: string): Promise<unknown[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("boards")
    .select("data")
    .eq("student_id", studentId)
    .single();
  return (data?.data as { items: unknown[] } | null)?.items ?? [];
}
