import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import CreateGroupForm from "./CreateGroupForm";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const { data: groups } = await createAdminClient()
    .from("groups")
    .select("id, name, created_at, group_members(count)")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Группы</h1>
      </div>

      <CreateGroupForm />

      {!groups || groups.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={card}>
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Групп пока нет</p>
          <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>
            Создайте группу, чтобы объединить учеников для совместных заданий и работы на доске
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(groups ?? []).map(g => {
            const count = (g.group_members as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={g.id}
                href={`/tutor/groups/${g.id}`}
                className="flex items-center gap-4 rounded-xl border p-4 hover:opacity-80 transition-all"
                style={card}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Users size={18} color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold" style={{ color: "var(--brown-dark)" }}>{g.name}</div>
                  <div className="text-sm" style={{ color: "var(--brown-mid)" }}>
                    {count} {count === 1 ? "ученик" : count < 5 ? "ученика" : "учеников"}
                  </div>
                </div>
                <div className="text-sm" style={{ color: "var(--brown-light)" }}>→</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
