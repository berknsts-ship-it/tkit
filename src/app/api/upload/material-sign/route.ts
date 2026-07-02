import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { fileName, contentType } = await req.json();
  if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });

  const ext = fileName.split(".").pop();
  const storagePath = `${user.id}/${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("materials")
    .createSignedUploadUrl(storagePath);

  if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, path: storagePath, token: data.token });
}
