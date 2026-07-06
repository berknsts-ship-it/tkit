import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg",
    png: "image/png", gif: "image/gif", webp: "image/webp",
    avif: "image/avif", heic: "image/heic", heif: "image/heif",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    pdf: "application/pdf",
  };
  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const contentType = ALLOWED[rawExt];
  if (!contentType) return NextResponse.json({ error: "File type not allowed", ext: rawExt }, { status: 400 });

  const path = `board/${user.id}/${Date.now()}.${rawExt}`;

  const { data, error } = await supabase.storage
    .from("board-images")
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("board-images").getPublicUrl(data.path);
  return NextResponse.json({ url: publicUrl });
}
