"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Deck CRUD ──────────────────────────────────────────────────────────────

export async function createDeck(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const title       = (formData.get("title") as string)?.trim();
  const subject     = (formData.get("subject") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  if (!title) return { error: "Введите название" };

  const { data, error } = await supabase
    .from("trainer_decks")
    .insert({ tutor_id: user.id, title, subject, description })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/tutor/trainer/${data.id}`);
}

export async function updateDeck(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const title       = (formData.get("title") as string)?.trim();
  const subject     = (formData.get("subject") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  if (!title) return { error: "Введите название" };

  const { error } = await supabase
    .from("trainer_decks")
    .update({ title, subject, description })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/trainer/${id}`);
  return { ok: true };
}

export async function deleteDeck(id: string) {
  const supabase = await createClient();
  await supabase.from("trainer_decks").delete().eq("id", id);
  revalidatePath("/tutor/trainer");
  redirect("/tutor/trainer");
}

// ── Card CRUD ──────────────────────────────────────────────────────────────

export async function addCard(deckId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const type    = formData.get("type") as string;
  const front   = (formData.get("front") as string)?.trim();
  const back    = (formData.get("back") as string)?.trim();
  const rawOpts = (formData.get("options") as string)?.trim();

  if (!front || !back) return { error: "Заполните оба поля" };

  const options = rawOpts
    ? rawOpts.split("\n").map(s => s.trim()).filter(Boolean)
    : null;

  // Position = last + 1
  const { data: last } = await supabase
    .from("trainer_cards")
    .select("position")
    .eq("deck_id", deckId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("trainer_cards").insert({
    deck_id: deckId, type, front, back,
    options: options ? options : null,
    position,
  });

  if (error) return { error: error.message };
  revalidatePath(`/tutor/trainer/${deckId}`);
  return { ok: true };
}

export async function updateCard(cardId: string, deckId: string, formData: FormData) {
  const supabase = await createClient();
  const front    = (formData.get("front") as string)?.trim();
  const back     = (formData.get("back") as string)?.trim();
  const rawOpts  = (formData.get("options") as string)?.trim();
  const type     = formData.get("type") as string;

  if (!front || !back) return { error: "Заполните оба поля" };

  const options = rawOpts
    ? rawOpts.split("\n").map(s => s.trim()).filter(Boolean)
    : null;

  const { error } = await supabase
    .from("trainer_cards")
    .update({ front, back, type, options: options ?? null })
    .eq("id", cardId);

  if (error) return { error: error.message };
  revalidatePath(`/tutor/trainer/${deckId}`);
  return { ok: true };
}

export async function deleteCard(cardId: string, deckId: string) {
  const supabase = await createClient();
  await supabase.from("trainer_cards").delete().eq("id", cardId);
  revalidatePath(`/tutor/trainer/${deckId}`);
}

export async function bulkAddCards(
  deckId: string,
  cards: { type: string; front: string; back: string; options: string[] }[],
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const db = createAdminClient();

  const { data: last } = await db
    .from("trainer_cards")
    .select("position")
    .eq("deck_id", deckId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const basePos = (last?.position ?? -1) + 1;
  const rows = cards.map((c, i) => ({
    deck_id: deckId,
    type: c.type,
    front: c.front,
    back: c.back,
    options: c.options.length > 0 ? c.options : null,
    position: basePos + i,
  }));

  const { error } = await db.from("trainer_cards").insert(rows);
  if (error) return { error: error.message };
  revalidatePath(`/tutor/trainer/${deckId}`);
  return { ok: true };
}

// ── Assignments ────────────────────────────────────────────────────────────

export async function assignDeck(deckId: string, studentIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  // Remove all existing, then insert selected
  await supabase.from("trainer_assignments").delete().eq("deck_id", deckId);

  if (studentIds.length > 0) {
    const rows = studentIds.map(student_id => ({
      deck_id: deckId, student_id, tutor_id: user.id,
    }));
    const { error } = await supabase.from("trainer_assignments").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/tutor/trainer/${deckId}`);
  return { ok: true };
}

// ── Progress (called from client via API route) ────────────────────────────

export async function saveProgress(
  studentId: string,
  results: { cardId: string; deckId: string; correct: boolean }[]
) {
  const db = createAdminClient();

  for (const r of results) {
    const { data: existing } = await db
      .from("trainer_progress")
      .select("id, correct_count, incorrect_count")
      .eq("student_id", studentId)
      .eq("card_id", r.cardId)
      .maybeSingle();

    if (existing) {
      await db.from("trainer_progress").update({
        correct_count:   existing.correct_count   + (r.correct ? 1 : 0),
        incorrect_count: existing.incorrect_count + (r.correct ? 0 : 1),
        last_practiced: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await db.from("trainer_progress").insert({
        student_id:      studentId,
        card_id:         r.cardId,
        deck_id:         r.deckId,
        correct_count:   r.correct ? 1 : 0,
        incorrect_count: r.correct ? 0 : 1,
      });
    }
  }
  return { ok: true };
}

// ── Student deck list ──────────────────────────────────────────────────────

export async function getStudentDecks(studentId: string) {
  const db = createAdminClient();

  const { data: assignments } = await db
    .from("trainer_assignments")
    .select("deck_id, trainer_decks(id, title, subject, description)")
    .eq("student_id", studentId);

  if (!assignments) return [];

  return assignments.map(a => a.trainer_decks).filter(Boolean) as unknown as {
    id: string; title: string; subject: string | null; description: string | null;
  }[];
}

export async function getStudentDeckWithProgress(studentId: string, deckId: string) {
  const db = createAdminClient();

  const [{ data: cards }, { data: progress }] = await Promise.all([
    db.from("trainer_cards").select("*").eq("deck_id", deckId).order("position"),
    db.from("trainer_progress").select("*").eq("student_id", studentId).eq("deck_id", deckId),
  ]);

  const progressMap = new Map(
    (progress ?? []).map(p => [p.card_id, p])
  );

  return (cards ?? []).map(c => ({
    ...c,
    progress: progressMap.get(c.id) ?? null,
  }));
}
