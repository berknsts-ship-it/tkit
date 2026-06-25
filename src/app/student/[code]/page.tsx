import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function StudentPage({ params }: Props) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, tutor_id, notes")
    .eq("access_code", code.toUpperCase())
    .single();

  if (!student) notFound();

  const [
    { data: lessons },
    { data: homework },
    { data: materials },
    { data: allArticles },
  ] = await Promise.all([
    supabase.from("lessons").select("*").eq("student_id", student.id)
      .eq("status", "scheduled").order("scheduled_at"),
    supabase.from("homework").select("*").eq("student_id", student.id)
      .in("status", ["pending", "submitted"]).order("due_date"),
    supabase.from("materials").select("*").eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase.from("reference_articles")
      .select("id, title, content, assign_to_all, reference_article_students(student_id)")
      .eq("tutor_id", student.tutor_id)
      .order("sort_order").order("created_at"),
  ]);

  // Статьи, которые видит этот ученик
  const articles = (allArticles ?? []).filter(a =>
    a.assign_to_all ||
    a.reference_article_students.some((r: { student_id: string }) => r.student_id === student.id)
  );

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.9)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="diary-bg-fixed" />

      <h1 className="text-2xl font-bold">Привет, {student.name}!</h1>

      {/* Расписание */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Ближайшие занятия</h2>
        {lessons && lessons.length > 0 ? (
          <div className="space-y-2">
            {lessons.map(l => (
              <div key={l.id} className="rounded-xl p-4 border" style={cardStyle}>
                <div className="font-medium">
                  {new Date(l.scheduled_at).toLocaleString("ru", {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                {l.duration_min && (
                  <div className="text-sm" style={{ color: "var(--brown-mid)" }}>
                    {l.duration_min} мин
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--brown-mid)" }}>Нет запланированных занятий</p>
        )}
      </section>

      {/* Домашнее задание */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Домашнее задание</h2>
        {homework && homework.length > 0 ? (
          <div className="space-y-2">
            {homework.map(hw => (
              <div key={hw.id} className="rounded-xl p-4 border" style={cardStyle}>
                <div className="font-medium">{hw.title}</div>
                {hw.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>{hw.description}</p>
                )}
                {hw.due_date && (
                  <div className="text-xs mt-1" style={{ color: "var(--brown-light)" }}>
                    До {new Date(hw.due_date).toLocaleDateString("ru")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--brown-mid)" }}>Нет домашнего задания</p>
        )}
      </section>

      {/* Материалы */}
      {materials && materials.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Материалы</h2>
          <div className="space-y-2">
            {materials.map(m => (
              <div key={m.id} className="rounded-xl p-4 border" style={cardStyle}>
                <div className="font-medium">{m.title}</div>
                {m.file_url && (
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                    style={{ color: "var(--brown-mid)" }}
                  >
                    {m.file_name ?? "Открыть файл"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Справочник */}
      {articles.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Справочник</h2>
          <div className="space-y-3">
            {articles.map(a => (
              <details key={a.id} className="rounded-xl border" style={cardStyle}>
                <summary className="px-4 py-3 font-medium cursor-pointer select-none" style={{
                  listStyle: "none",
                  color: "var(--brown-dark)",
                }}>
                  <span className="mr-2" style={{ color: "var(--brown-light)" }}>▸</span>
                  {a.title}
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm whitespace-pre-wrap border-t" style={{
                  borderColor: "var(--brown-pale)",
                  color: "var(--brown-mid)",
                  lineHeight: 1.75,
                }}>
                  {a.content}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
