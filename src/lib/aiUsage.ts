import { createClient } from "@/lib/supabase/server";

export const AI_DAILY_LIMIT = 30;

type UsageResult =
  | { ok: true;  remaining: number; tutorId: string }
  | { ok: false; remaining: number; error: string };

/** Атомарно инкрементирует счётчик и возвращает разрешение + остаток */
export async function consumeAiRequest(): Promise<UsageResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, remaining: 0, error: "Не авторизован" };

  const today = new Date().toISOString().slice(0, 10);

  // Atomic increment via SQL function
  const { data: newCount, error } = await supabase
    .rpc("ai_usage_increment", { p_tutor_id: user.id, p_date: today });

  if (error) {
    // Table may not exist yet — allow through but don't track
    console.error("ai_usage_increment error:", error.message);
    return { ok: true, remaining: AI_DAILY_LIMIT, tutorId: user.id };
  }

  const count = newCount as number;
  if (count > AI_DAILY_LIMIT) {
    return {
      ok: false,
      remaining: 0,
      error: `Дневной лимит ИИ-запросов исчерпан (${AI_DAILY_LIMIT}/день). Завтра лимит обнулится.`,
    };
  }

  return { ok: true, remaining: AI_DAILY_LIMIT - count, tutorId: user.id };
}

/** Возвращает остаток без инкремента — для отображения в UI */
export async function getAiRemaining(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_usage")
    .select("requests")
    .eq("tutor_id", user.id)
    .eq("date", today)
    .single();

  return Math.max(0, AI_DAILY_LIMIT - ((data?.requests as number) ?? 0));
}
