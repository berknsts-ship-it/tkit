import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import StudentCabinet from "@/components/student/StudentCabinet";

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

  if (!student) redirect(`/student?error=not_found&code=${encodeURIComponent(code)}`);

  const [
    { data: lessons },
    { data: homework },
    { data: directMaterials },
    { data: assignedRows },
    { data: allArticles },
    { data: snapshots },
    { data: topicsRaw },
    { data: unreadNotifs },
    { data: tutor },
    { data: readRows },
    { data: sentNotifications },
  ] = await Promise.all([
    supabase.from("lessons").select("id, scheduled_at, duration_min, notes").eq("student_id", student.id)
      .eq("status", "scheduled").order("scheduled_at"),
    supabase.from("homework").select("id, title, description, due_date, status").eq("student_id", student.id)
      .in("status", ["pending", "submitted"]).order("due_date"),
    supabase.from("materials").select("*")
      .eq("tutor_id", student.tutor_id)
      .or(`student_id.eq.${student.id},student_id.is.null`)
      .order("created_at", { ascending: false }),
    supabase.from("material_assignments").select("material_id")
      .eq("student_id", student.id),
    supabase.from("reference_articles")
      .select("id, title, content, assign_to_all, reference_article_students(student_id)")
      .eq("tutor_id", student.tutor_id)
      .order("sort_order").order("created_at"),
    supabase.from("board_snapshots")
      .select("id, title, created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase.from("vocabulary_topics")
      .select("id, title, language, vocabulary_words(id, word, translation, example)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase.from("notification_recipients").select("notification_id")
      .eq("student_id", student.id),
    supabase.from("tutors").select("subject, meeting_url").eq("id", student.tutor_id).single(),
    supabase.from("notification_reads").select("notification_id").eq("student_id", student.id),
    supabase.from("notifications")
      .select("id, title, body, sent_at")
      .eq("tutor_id", student.tutor_id)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);

  // Resolve unread notifications
  const recipientIds = new Set((unreadNotifs ?? []).map(r => (r as { notification_id: string }).notification_id));
  const readIds = new Set((readRows ?? []).map(r => r.notification_id));
  const unreadNotifications = (sentNotifications ?? [])
    .filter(n => recipientIds.has(n.id) && !readIds.has(n.id))
    .map(n => ({ id: n.id, title: n.title, body: n.body }));

  // Merge direct + junction-table assigned materials (dedup by id)
  const directIds = new Set((directMaterials ?? []).map(m => m.id));
  const junctionIds = (assignedRows ?? []).map(r => r.material_id).filter(id => !directIds.has(id));
  let junctionMaterials: typeof directMaterials = [];
  if (junctionIds.length > 0) {
    const { data } = await supabase.from("materials").select("*").in("id", junctionIds);
    junctionMaterials = data ?? [];
  }
  const materials = [
    ...(directMaterials ?? []),
    ...junctionMaterials,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const articles = (allArticles ?? []).filter(a =>
    a.assign_to_all ||
    a.reference_article_students.some((r: { student_id: string }) => r.student_id === student.id)
  );

  // Fetch trainer decks in two steps: assignments → cards
  type TrainerDeckData = {
    id: string;
    title: string;
    subject: string | null;
    description: string | null;
    cards: { id: string; deck_id: string; type: string; front: string; back: string; options: string[] | null }[];
  };
  let trainerDecks: TrainerDeckData[] = [];

  const { data: trainerAssignments } = await supabase
    .from("trainer_assignments")
    .select("deck_id, trainer_decks(id, title, subject, description)")
    .eq("student_id", student.id);

  if (trainerAssignments && trainerAssignments.length > 0) {
    const deckIds = trainerAssignments.map(a => a.deck_id).filter(Boolean);
    if (deckIds.length > 0) {
      const { data: trainerCards } = await supabase
        .from("trainer_cards")
        .select("id, deck_id, type, front, back, options")
        .in("deck_id", deckIds)
        .order("position");

      trainerDecks = trainerAssignments
        .map(a => {
          const deck = a.trainer_decks as unknown as { id: string; title: string; subject: string | null; description: string | null } | null;
          if (!deck) return null;
          return {
            id: deck.id,
            title: deck.title,
            subject: deck.subject,
            description: deck.description,
            cards: (trainerCards ?? []).filter(c => c.deck_id === deck.id),
          };
        })
        .filter((d): d is TrainerDeckData => d !== null);
    }
  }

  return (
    <StudentCabinet
      studentId={student.id}
      student={{ name: student.name }}
      subject={tutor?.subject ?? null}
      meetingUrl={tutor?.meeting_url ?? null}
      lessons={lessons ?? []}
      homework={homework ?? []}
      materials={materials}
      unreadNotifications={unreadNotifications}
      articles={articles.map(a => ({ id: a.id, title: a.title, content: a.content }))}
      snapshots={snapshots ?? []}
      topics={(topicsRaw ?? []).map(t => ({
        id: t.id, title: t.title, language: t.language ?? "en-US",
        words: (t.vocabulary_words ?? []) as { id: string; word: string; translation: string; example?: string | null }[],
      }))}
      trainerDecks={trainerDecks}
    />
  );
}
