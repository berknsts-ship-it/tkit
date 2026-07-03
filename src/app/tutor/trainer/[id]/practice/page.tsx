import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import TrainerPractice from "@/components/trainer/TrainerPractice";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: deck }, { data: cards }] = await Promise.all([
    db.from("trainer_decks").select("id, title").eq("id", id).eq("tutor_id", tutorId).single(),
    db.from("trainer_cards").select("*").eq("deck_id", id).order("position"),
  ]);

  if (!deck) redirect("/tutor/trainer");

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tutor/trainer/${id}`}
          className="text-sm px-3 py-1 rounded-lg border"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          ← {deck.title}
        </Link>
      </div>

      <TrainerPractice
        deckId={id}
        cards={(cards ?? []) as Parameters<typeof TrainerPractice>[0]["cards"]}
      />
    </div>
  );
}
