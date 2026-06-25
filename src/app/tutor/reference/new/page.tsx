import { createClient } from "@/lib/supabase/server";
import ReferenceEditor from "@/components/tutor/ReferenceEditor";

export default async function NewArticlePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .eq("tutor_id", user!.id)
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Новая статья справочника</h1>
      <ReferenceEditor students={students ?? []} />
    </div>
  );
}
