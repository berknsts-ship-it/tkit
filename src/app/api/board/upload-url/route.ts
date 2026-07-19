import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg",
  png: "image/png", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  avi: "video/x-msvideo", mkv: "video/x-matroska", m4v: "video/x-m4v",
  mpeg: "video/mpeg", mpg: "video/mpeg", ogv: "video/ogg",
  "3gp": "video/3gpp", wmv: "video/x-ms-wmv", flv: "video/x-flv",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", aac: "audio/aac",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ext } = await req.json();
  const contentType = ALLOWED[(ext ?? "").toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "File type not allowed" }, { status: 400 });

  const path = `board/${user.id}/${Date.now()}.${ext}`;
  const admin = createAdminClient();

  const { data, error } = await admin.storage.from("board-images").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publicUrl = admin.storage.from("board-images").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl, contentType });
}
