import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TutorNav from "@/components/tutor/TutorNav";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: tutor } = await supabase
    .from("tutors")
    .select("name, plan, plan_expires_at")
    .eq("id", user.id)
    .single();

  const isPro =
    tutor?.plan === "pro" &&
    tutor?.plan_expires_at &&
    new Date(tutor.plan_expires_at) > new Date();

  return (
    <div className="flex flex-col min-h-screen">
      <TutorNav tutorName={tutor?.name ?? user.email ?? "Репетитор"} isPro={!!isPro} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
