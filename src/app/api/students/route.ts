import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const { data } = await supabase
    .from("students")
    .select("id, name")
    .eq("tutor_id", user.id)
    .order("name");

  return NextResponse.json(data ?? []);
}
