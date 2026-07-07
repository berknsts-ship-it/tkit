"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function assertCreator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const creatorEmail = process.env.CREATOR_EMAIL;
  if (!creatorEmail || user?.email !== creatorEmail) throw new Error("Not creator");
}

export async function setViewAs(tutorId: string) {
  await assertCreator();
  const cookieStore = await cookies();
  cookieStore.set("creator_view_as", tutorId, { httpOnly: true, path: "/", sameSite: "lax" });
  redirect("/tutor/dashboard");
}

export async function clearViewAs() {
  await assertCreator();
  const cookieStore = await cookies();
  cookieStore.delete("creator_view_as");
  redirect("/creator");
}

export async function setSubjectOverride(subject: string | null) {
  await assertCreator();
  const cookieStore = await cookies();
  if (subject) {
    cookieStore.set("creator_subject", subject, { httpOnly: true, path: "/", sameSite: "lax" });
  } else {
    cookieStore.delete("creator_subject");
  }
}
