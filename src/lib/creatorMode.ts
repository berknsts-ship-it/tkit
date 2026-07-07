import { cookies } from "next/headers";

export function isCreator(email: string | undefined | null): boolean {
  const creatorEmail = process.env.CREATOR_EMAIL;
  return !!creatorEmail && email === creatorEmail;
}

export async function getEffectiveTutorId(user: { id: string; email?: string | null }): Promise<string> {
  if (!isCreator(user.email)) return user.id;
  const cookieStore = await cookies();
  return cookieStore.get("creator_view_as")?.value ?? user.id;
}

export async function getCreatorViewAs(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("creator_view_as")?.value ?? null;
}

export async function getCreatorSubject(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("creator_subject")?.value ?? null;
}
