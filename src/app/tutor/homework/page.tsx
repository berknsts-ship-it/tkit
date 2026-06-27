import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { updateHomeworkStatus } from "@/app/actions/homework";

const STATUS_LABEL: Record<string, string> = {
  pending: "Задано",
  submitted: "Сдано",
  checked: "Проверено",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--brown-light)",
  submitted: "#6a9e6a",
  checked: "var(--brown-mid)",
};

export default async function HomeworkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const { data: homework } = await createAdminClient()
    .from("homework")
    .select("*, students(name)")
    .eq("tutor_id", tutorId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Домашние задания</h1>
        <Link href="/tutor/homework/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
          <PlusCircle size={16} />
          Задать
        </Link>
      </div>

      {!homework || homework.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={card}>
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Домашних заданий пока нет</p>
          <Link href="/tutor/homework/new"
            className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            Задать первое задание
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {homework.map(hw => {
            const student = hw.students as { name: string } | null;
            return (
              <div key={hw.id} className="rounded-xl border p-4 flex items-start gap-4" style={card}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{hw.title}</div>
                  <div className="text-sm mt-0.5" style={{ color: "var(--brown-mid)" }}>
                    {student?.name}
                    {hw.due_date && ` · до ${new Date(hw.due_date).toLocaleDateString("ru")}`}
                  </div>
                  {hw.description && (
                    <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>{hw.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                    background: "var(--brown-pale)", color: STATUS_COLOR[hw.status]
                  }}>
                    {STATUS_LABEL[hw.status]}
                  </span>
                  {hw.status === "pending" && (
                    <form action={async () => { "use server"; await updateHomeworkStatus(hw.id, "checked"); }}>
                      <button type="submit" className="text-xs px-2 py-1 rounded-lg border hover:opacity-70"
                        style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                        ✓ Проверено
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
