"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createGroup(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Введите название группы" };

  const { data, error } = await supabase
    .from("groups")
    .insert({ tutor_id: user.id, name })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/tutor/groups");
  redirect(`/tutor/groups/${data.id}`);
}

export async function renameGroup(id: string, name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Введите название" };
  const { error } = await supabase
    .from("groups").update({ name: trimmed }).eq("id", id).eq("tutor_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/tutor/groups/${id}`);
  revalidatePath("/tutor/groups");
  return { ok: true };
}

export async function deleteGroup(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  await supabase.from("groups").delete().eq("id", id).eq("tutor_id", user.id);
  revalidatePath("/tutor/groups");
  redirect("/tutor/groups");
}

export async function addGroupMember(groupId: string, studentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  // verify tutor owns this group
  const { data: group } = await supabase
    .from("groups").select("id").eq("id", groupId).eq("tutor_id", user.id).single();
  if (!group) return { error: "Группа не найдена" };

  await supabase.from("group_members").upsert({ group_id: groupId, student_id: studentId });
  revalidatePath(`/tutor/groups/${groupId}`);
  return { ok: true };
}

export async function removeGroupMember(groupId: string, studentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: group } = await supabase
    .from("groups").select("id").eq("id", groupId).eq("tutor_id", user.id).single();
  if (!group) return { error: "Группа не найдена" };
  await supabase.from("group_members")
    .delete().eq("group_id", groupId).eq("student_id", studentId);
  revalidatePath(`/tutor/groups/${groupId}`);
  return { ok: true };
}

export async function createGroupHomework(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const group_id  = formData.get("group_id") as string | null;
  const student_id = formData.get("student_id") as string | null;
  const title     = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const due_date  = (formData.get("due_date") as string) || null;

  if (!title) redirect("/tutor/homework/new");

  if (group_id) {
    // Verify tutor owns this group
    const { data: group } = await supabase
      .from("groups").select("id").eq("id", group_id).eq("tutor_id", user.id).single();
    if (!group) redirect("/tutor/homework/new");

    // Get all members of the group
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("group_members")
      .select("student_id")
      .eq("group_id", group_id);

    if (!members?.length) redirect("/tutor/homework/new");

    await supabase.from("homework").insert(
      members.map(m => ({
        tutor_id: user.id,
        student_id: m.student_id,
        group_id,
        title,
        description,
        due_date,
      }))
    );
  } else if (student_id) {
    await supabase.from("homework").insert({
      tutor_id: user.id,
      student_id,
      title,
      description,
      due_date,
    });
  } else {
    redirect("/tutor/homework/new");
  }

  revalidatePath("/tutor/homework");
  redirect("/tutor/homework");
}
