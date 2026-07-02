import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { title, storagePath, fileName } = await req.json();
  if (!title || !storagePath || !fileName) {
    return NextResponse.json({ error: "Недостаточно данных" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: { publicUrl } } = admin.storage.from("materials").getPublicUrl(storagePath);

  const { error } = await admin.from("materials").insert({
    tutor_id: user.id,
    student_id: null,
    title,
    file_url: publicUrl,
    file_name: fileName,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/tutor/materials");
  return NextResponse.json({ ok: true });
}
