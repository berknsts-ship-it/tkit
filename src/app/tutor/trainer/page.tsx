import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Dumbbell, Users, BookOpen } from "lucide-react";

export default async function TrainerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: decks }, { data: students }] = await Promise.all([
    db.from("trainer_decks")
      .select("id, title, subject, description, created_at, trainer_cards(count), trainer_assignments(count)")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false }),
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--brown-dark)" }}>Тренажер</h1>
          <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>
            Карточки, сопоставление и тесты для любых предметов
          </p>
        </div>
        <Link href="/tutor/trainer/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white text-sm"
          style={{ background: "var(--gradient-primary)" }}>
          <Plus size={16} /> Новая колода
        </Link>
      </div>

      {(!decks || decks.length === 0) ? (
        <div className="rounded-2xl border p-12 text-center"
          style={{ borderColor: "var(--brown-pale)", background: "white" }}>
          <div className="text-5xl mb-4">🎴</div>
          <p className="font-semibold text-lg mb-2" style={{ color: "var(--brown-dark)" }}>
            Колод пока нет
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--brown-light)" }}>
            Создайте первую колоду с карточками, заданиями на сопоставление или тестами
          </p>
          <Link href="/tutor/trainer/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus size={16} /> Создать колоду
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {decks.map(deck => {
            const cardCount = (deck.trainer_cards as unknown as { count: number }[])?.[0]?.count ?? 0;
            const assignCount = (deck.trainer_assignments as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link key={deck.id} href={`/tutor/trainer/${deck.id}`}
                className="block rounded-2xl border p-5 bg-white hover:shadow-md transition-all"
                style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h2 className="font-semibold" style={{ color: "var(--brown-dark)" }}>{deck.title}</h2>
                    {deck.subject && (
                      <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                        style={{ background: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                        {deck.subject}
                      </span>
                    )}
                  </div>
                  <Dumbbell size={18} style={{ color: "var(--brown-light)", flexShrink: 0 }} />
                </div>
                {deck.description && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--brown-light)" }}>
                    {deck.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--brown-light)" }}>
                  <span className="flex items-center gap-1"><BookOpen size={12} /> {cardCount} карточек</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {assignCount} учеников</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
