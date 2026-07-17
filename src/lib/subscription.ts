import { createClient } from "@/lib/supabase/server";
import { isCreator } from "@/lib/creatorMode";

export type Plan = "free" | "pro";

export async function getTutorPlan(): Promise<Plan> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "free";

  if (isCreator(user.email)) return "pro";

  const { data } = await supabase
    .from("tutors")
    .select("plan, plan_expires_at, is_creator")
    .eq("id", user.id)
    .single();

  if (!data) return "free";
  if (data.is_creator) return "pro";
  if (data.plan === "pro" && data.plan_expires_at) {
    const expires = new Date(data.plan_expires_at);
    if (expires > new Date()) return "pro";
  }
  return "free";
}

export function isPro(plan: Plan) {
  return plan === "pro";
}
