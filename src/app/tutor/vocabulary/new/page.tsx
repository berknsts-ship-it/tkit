import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import NewTopicForm from "./NewTopicForm";

export default async function NewTopicPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: students }, { data: groups }] = await Promise.all([
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("groups").select("id, name").eq("tutor_id", tutorId).order("name"),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Новая тема</h1>
      <NewTopicForm students={students ?? []} groups={groups ?? []} />
    </div>
  );
}
