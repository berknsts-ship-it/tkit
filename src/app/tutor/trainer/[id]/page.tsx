import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import DeckEditor from "./DeckEditor";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: deck }, { data: cards }, { data: students }, { data: assigned }, { data: progress }] = await Promise.all([
    db.from("trainer_decks").select("*").eq("id", id).eq("tutor_id", tutorId).single(),
    db.from("trainer_cards").select("*").eq("deck_id", id).order("position"),
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("trainer_assignments").select("student_id").eq("deck_id", id),
    db.from("trainer_progress").select("student_id, card_id, correct_count, incorrect_count").eq("deck_id", id),
  ]);

  if (!deck) redirect("/tutor/trainer");

  const assignedIds = (assigned ?? []).map(a => a.student_id);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tutor/trainer" className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          ← Тренажер
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>{deck.title}</h1>
          {deck.subject && (
            <span className="text-xs" style={{ color: "var(--brown-light)" }}>{deck.subject}</span>
          )}
        </div>
      </div>

      <DeckEditor
        deckId={id}
        deckTitle={deck.title}
        cards={cards ?? []}
        students={students ?? []}
        assigned={assignedIds}
        progress={progress ?? []}
      />
    </div>
  );
}
