import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signUploadToken } from "@/lib/upload-token";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { fileName } = await req.json();
  if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });

  const ext = fileName.split(".").pop();
  const uploadPath = `${user.id}/${Date.now()}.${ext}`;
  const token = signUploadToken(user.id, uploadPath);

  return NextResponse.json({
    signedUrl: `/api/upload/file-put?token=${token}`,
    path: `vps:${uploadPath}`,
  });
}
