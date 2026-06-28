import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle, BookMarked, Pencil } from "lucide-react";
import { deleteTopic } from "@/app/actions/vocabulary";

export default async function VocabularyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const { data: topics } = await createAdminClient()
    .from("vocabulary_topics")
    .select("*, vocabulary_words(count), students(name)")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Тренажёр слов</h1>
        <Link href="/tutor/vocabulary/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
          <PlusCircle size={16} />
          Новая тема
        </Link>
      </div>

      {!topics || topics.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={card}>
          <BookMarked size={40} className="mx-auto mb-3" style={{ color: "var(--brown-pale)" }} />
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Тем пока нет</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--brown-light)" }}>
            Создайте тему со словами — ученик будет тренироваться и получать подсказки от ИИ
          </p>
          <Link href="/tutor/vocabulary/new"
            className="inline-block px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            Создать первую тему
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(t => {
            const wordCount = (t.vocabulary_words as { count: number }[])?.[0]?.count ?? 0;
            const student = t.students as { name: string } | null;
            return (
              <div key={t.id} className="rounded-xl border p-4 flex items-center gap-4" style={card}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{t.title}</div>
                  <div className="text-sm mt-0.5" style={{ color: "var(--brown-light)" }}>
                    {wordCount} слов · {student ? student.name : "Для всех"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/tutor/vocabulary/${t.id}`}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-all"
                    style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                    <Pencil size={13}/> Изменить
                  </Link>
                  <Link href={`/tutor/vocabulary/practice?topic=${t.id}`}
                    className="text-sm px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-all border"
                    style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                    Тренировать
                  </Link>
                  <form action={async () => { "use server"; await deleteTopic(t.id); }}>
                    <button type="submit"
                      className="text-sm px-3 py-1 rounded-lg border hover:opacity-70 transition-all"
                      style={{ borderColor: "#f0c0b0", color: "#c06040" }}>
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
