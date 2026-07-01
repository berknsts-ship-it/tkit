"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadMaterial(formData: FormData) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string)?.trim();

  if (!title) return { error: "Укажите название" };
  if (!file || file.size === 0) return { error: "Выберите файл" };

  const admin = createAdminClient();

  const ext = file.name.split(".").pop();
  const storagePath = `${user.id}/${Date.now()}.${ext}`;

  const { error: storageError } = await admin.storage
    .from("materials")
    .upload(storagePath, file, { contentType: file.type });

  if (storageError) return { error: "Ошибка загрузки файла: " + storageError.message };

  const { data: { publicUrl } } = admin.storage
    .from("materials")
    .getPublicUrl(storagePath);

  const { data: mat, error: dbError } = await admin.from("materials").insert({
    tutor_id: user.id,
    student_id: null,
    title,
    file_url: publicUrl,
    file_name: file.name,
  }).select("id").single();

  if (dbError) return { error: "Ошибка сохранения: " + dbError.message };

  // Pre-assign to students if provided
  const studentIds = formData.getAll("student_ids[]") as string[];
  if (mat && studentIds.length > 0) {
    await admin.from("material_assignments").insert(
      studentIds.map(sid => ({ material_id: mat.id, student_id: sid }))
    );
  }

  revalidatePath("/tutor/materials");
  return { ok: true };
}

export async function setMaterialAssignments(materialId: string, studentIds: string[]) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { data: mat } = await admin.from("materials").select("tutor_id").eq("id", materialId).single();
  if (!mat || mat.tutor_id !== user.id) return { error: "Нет доступа" };

  await admin.from("material_assignments").delete().eq("material_id", materialId);
  if (studentIds.length > 0) {
    const { error } = await admin.from("material_assignments").insert(
      studentIds.map(sid => ({ material_id: materialId, student_id: sid }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/tutor/materials");
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { data: mat } = await admin.from("materials").select("file_url, tutor_id").eq("id", id).single();
  if (!mat || mat.tutor_id !== user.id) return { error: "Нет доступа" };

  // Удаляем файл из Storage
  const url = new URL(mat.file_url);
  const pathParts = url.pathname.split("/object/public/materials/");
  if (pathParts[1]) {
    await admin.storage.from("materials").remove([decodeURIComponent(pathParts[1])]);
  }

  await admin.from("materials").delete().eq("id", id);
  return { ok: true };
}
