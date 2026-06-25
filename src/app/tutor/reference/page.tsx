import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { deleteArticle } from "@/app/actions/reference";

export default async function ReferencePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: articles } = await supabase
    .from("reference_articles")
    .select("id, title, assign_to_all, updated_at, reference_article_students(student_id)")
    .eq("tutor_id", user!.id)
    .order("sort_order")
    .order("created_at");

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .eq("tutor_id", user!.id)
    .order("name");

  const studentMap = Object.fromEntries((students ?? []).map(s => [s.id, s.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Справочник</h1>
        <Link
          href="/tutor/reference/new"
          className="px-4 py-2 rounded-xl font-semibold text-white text-sm"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
        >
          + Новая статья
        </Link>
      </div>

      {!articles || articles.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{
          background: "rgba(253, 248, 240, 0.9)",
          borderColor: "var(--brown-pale)",
          boxShadow: "var(--shadow-card)",
        }}>
          <p className="mb-4" style={{ color: "var(--brown-mid)" }}>
            Здесь будут статьи справочника — правила, таблицы, объяснения.
          </p>
          <Link href="/tutor/reference/new"
            className="inline-block px-6 py-2 rounded-xl font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            Создать первую статью
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(a => {
            const assignedIds = a.reference_article_students.map((r: { student_id: string }) => r.student_id);
            const assignedNames = assignedIds.map((id: string) => studentMap[id]).filter(Boolean);

            return (
              <div key={a.id} className="rounded-xl border p-4 flex items-start gap-4" style={{
                background: "rgba(253, 248, 240, 0.9)",
                borderColor: "var(--brown-pale)",
                boxShadow: "var(--shadow-card)",
              }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--brown-mid)" }}>
                    {a.assign_to_all
                      ? "Все ученики"
                      : assignedNames.length > 0
                        ? assignedNames.join(", ")
                        : "Никому не назначено"}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/tutor/reference/${a.id}/edit`}
                    className="text-sm px-3 py-1 rounded-lg border transition-all hover:opacity-70"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
                  >
                    Изменить
                  </Link>
                  <form action={async () => {
                    "use server";
                    await deleteArticle(a.id);
                  }}>
                    <button
                      type="submit"
                      className="text-sm px-3 py-1 rounded-lg border transition-all hover:opacity-70"
                      style={{ borderColor: "#f0d0c0", color: "#c07060" }}
                    >
                      Удалить
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
