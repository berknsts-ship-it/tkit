import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `board/${user.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("board-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    // If bucket doesn't exist yet — return error so client falls back to object URL
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path);
  return NextResponse.json({ url: publicUrl });
}
