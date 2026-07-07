import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  console.log("[board/image] POST start");

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[board/image] SUPABASE_SERVICE_ROLE_KEY present:", hasServiceKey);
  if (!hasServiceKey) {
    console.error("[board/image] SUPABASE_SERVICE_ROLE_KEY is not set — admin client will fail");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("[board/image] auth user:", user?.id ?? null, "authError:", authError?.message ?? null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storage = createAdminClient();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  console.log("[board/image] file:", file?.name, "size:", file?.size);
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
  console.log("[board/image] ext:", rawExt, "contentType:", contentType ?? "NOT ALLOWED");
  if (!contentType) return NextResponse.json({ error: "File type not allowed", ext: rawExt }, { status: 400 });

  const path = `board/${user.id}/${Date.now()}.${rawExt}`;
  console.log("[board/image] uploading to path:", path);

  const { data, error } = await storage.storage
    .from("board-images")
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    console.error("[board/image] upload error:", error.message, JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[board/image] upload ok, path:", data.path);
  const { data: { publicUrl } } = storage.storage.from("board-images").getPublicUrl(data.path);
  console.log("[board/image] publicUrl:", publicUrl);
  return NextResponse.json({ url: publicUrl });
}
