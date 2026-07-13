"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveSnapshot(
  roomId: string,
  title:  string,
  items:  unknown[],
  lessonId?: string,
  testOpts?: { testMode?: boolean; testStatus?: string; testDurationMinutes?: number; isGroup?: boolean },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const isGroup = testOpts?.isGroup ?? false;
  const { error } = await supabase.from("board_snapshots").insert({
    tutor_id:   user.id,
    student_id: isGroup ? null : roomId,
    group_id:   isGroup ? roomId : null,
    lesson_id:  lessonId ?? null,
    title:      title.trim() || new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
    items,
    test_mode:              testOpts?.testMode ?? false,
    test_status:            testOpts?.testStatus ?? null,
    test_duration_minutes:  testOpts?.testDurationMinutes ?? null,
  });
  if (error) return { error: "Не удалось сохранить конспект" };
  revalidatePath("/tutor/board");
}

export async function updateSnapshot(id: string, items: unknown[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("board_snapshots")
    .update({ items, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tutor_id", user.id);
  if (error) return { error: "Не удалось обновить конспект" };
}

export async function deleteSnapshot(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("board_snapshots").delete().eq("id", id).eq("tutor_id", user.id);
  if (error) return { error: "Не удалось удалить конспект" };
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

export async function getPreparedTests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("board_snapshots")
    .select("id, title, created_at")
    .eq("tutor_id", user.id)
    .eq("test_status", "prepared")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as { id: string; title: string; created_at: string }[];
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
  if (!user) return { error: "Unauthorized" };
  const { error } = await supabase.from("board_snapshots").update({ title }).eq("id", id).eq("tutor_id", user.id);
  if (error) return { error: "Не удалось переименовать" };
}

export async function saveBoardState(studentId: string, items: unknown[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // If authenticated tutor, verify they own this student
  if (user) {
    const { data: student } = await supabase
      .from("students").select("id").eq("id", studentId).eq("tutor_id", user.id).single();
    if (!student) return { error: "Доступ запрещён" };
  }
  const db = createAdminClient();
  await db.from("boards").upsert(
    { student_id: studentId, data: { items }, updated_at: new Date().toISOString() },
    { onConflict: "student_id" }
  );
}

export async function loadBoardState(studentId: string): Promise<unknown[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: student } = await supabase
      .from("students").select("id").eq("id", studentId).eq("tutor_id", user.id).single();
    if (!student) return [];
  }
  const db = createAdminClient();
  const { data } = await db
    .from("boards")
    .select("data")
    .eq("student_id", studentId)
    .single();
  return (data?.data as { items: unknown[] } | null)?.items ?? [];
}
