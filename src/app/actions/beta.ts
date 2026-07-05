"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isCreator } from "@/lib/creatorMode";
import { revalidatePath } from "next/cache";

// Символы без двусмысленных 0/O, 1/I/L
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let s = "BETA-";
  for (let i = 0; i < 4; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

// Регистрация через бета-код — полный flow на сервере
export async function betaRegister(
  code: string,
  email: string,
  password: string,
  name: string,
  subject: string,
) {
  const db = createAdminClient();
  const upperCode = code.trim().toUpperCase();

  // 1. Проверяем код
  const { data: row } = await db
    .from("beta_codes")
    .select("used_by")
    .eq("code", upperCode)
    .single();

  if (!row) return { error: "Неверный код доступа" };
  if (row.used_by) return { error: "Этот код уже использован" };

  // 2. Создаём пользователя через admin (email сразу подтверждён)
  const { data: { user }, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authErr || !user) {
    if (authErr?.message?.includes("already registered"))
      return { error: "Этот email уже зарегистрирован" };
    return { error: authErr?.message ?? "Ошибка регистрации" };
  }

  // 3. Устанавливаем PRO план и предмет
  await db.from("tutors").upsert({
    id:               user.id,
    email,
    name:             name || email.split("@")[0],
    subject:          subject || null,
    plan:             "pro",
    plan_expires_at:  "2099-01-01T00:00:00Z",
  });

  // 4. Помечаем код как использованный
  await db
    .from("beta_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", upperCode);

  return { success: true };
}

// Генерация кодов (только для создателя)
export async function generateBetaCodes(count: number, note?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isCreator(user?.email)) return { error: "Нет доступа" };

  const db = createAdminClient();
  const codes: string[] = [];

  for (let i = 0; i < Math.min(count, 50); i++) {
    let code = randomCode();
    // Пересоздаём если вдруг коллизия
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data } = await db.from("beta_codes").select("code").eq("code", code).single();
      if (!data) break;
      code = randomCode();
    }
    codes.push(code);
  }

  await db.from("beta_codes").insert(
    codes.map(code => ({ code, note: note || null }))
  );

  revalidatePath("/creator");
  return { codes };
}

// Список всех кодов (только для создателя)
export async function listBetaCodes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isCreator(user?.email)) return [];

  const db = createAdminClient();
  const { data: codes } = await db
    .from("beta_codes")
    .select("code, note, used_by, used_at, created_at")
    .order("created_at", { ascending: false });

  if (!codes?.length) return [];

  // Отдельно подгружаем имена тьюторов (нет прямого FK beta_codes -> tutors)
  const usedIds = codes.filter(c => c.used_by).map(c => c.used_by as string);
  const tutorMap: Record<string, { name: string | null; email: string }> = {};
  if (usedIds.length) {
    const { data: tutors } = await db
      .from("tutors")
      .select("id, name, email")
      .in("id", usedIds);
    (tutors ?? []).forEach(t => { tutorMap[t.id] = { name: t.name, email: t.email }; });
  }

  return codes.map(c => ({
    ...c,
    tutors: c.used_by ? (tutorMap[c.used_by] ?? null) : null,
  }));
}

// Удалить неиспользованный код
export async function deleteBetaCode(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isCreator(user?.email)) return;

  const db = createAdminClient();
  await db.from("beta_codes").delete().eq("code", code).is("used_by", null);
  revalidatePath("/creator");
}
