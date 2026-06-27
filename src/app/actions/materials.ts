"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function uploadMaterial(formData: FormData) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string)?.trim();
  const studentId = (formData.get("student_id") as string) || null;

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

  const { error: dbError } = await admin.from("materials").insert({
    tutor_id: user.id,
    student_id: studentId,
    title,
    file_url: publicUrl,
    file_name: file.name,
  });

  if (dbError) return { error: "Ошибка сохранения: " + dbError.message };
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
