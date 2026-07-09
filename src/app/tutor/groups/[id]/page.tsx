import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import GroupDetail from "./GroupDetail";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const db = createAdminClient();

  const [{ data: group }, { data: members }, { data: students }] = await Promise.all([
    db.from("groups").select("id, name").eq("id", id).eq("tutor_id", tutorId).single(),
    db.from("group_members").select("student_id, students(name)").eq("group_id", id),
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
  ]);

  if (!group) notFound();

  return (
    <div>
      <Link
        href="/tutor/groups"
        className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-70"
        style={{ color: "var(--brown-mid)" }}
      >
        <ChevronLeft size={16} />
        Все группы
      </Link>

      <GroupDetail
        group={group}
        members={(members ?? []) as unknown as { student_id: string; students: { name: string } }[]}
        allStudents={students ?? []}
      />
    </div>
  );
}
