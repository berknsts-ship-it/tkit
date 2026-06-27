import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TutorNav from "@/components/tutor/TutorNav";
import TutorBackground from "@/components/tutor/TutorBackground";
import { isCreator, getCreatorViewAs } from "@/lib/creatorMode";
import { clearViewAs } from "@/app/actions/creator";
import { getThemeKey, THEMES } from "@/lib/themes";
import type { CSSProperties } from "react";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const viewingAs = isCreator(user.email) ? await getCreatorViewAs() : null;
  const effectiveId = viewingAs ?? user.id;

  const admin = createAdminClient();
  const { data: tutor } = await admin
    .from("tutors")
    .select("name, plan, plan_expires_at, subject")
    .eq("id", effectiveId)
    .single();

  const isPro =
    tutor?.plan === "pro" &&
    tutor?.plan_expires_at &&
    new Date(tutor.plan_expires_at) > new Date();

  const themeKey = getThemeKey(tutor?.subject);
  const t = THEMES[themeKey];

  const themeVars: CSSProperties = {
    "--brown-dark":       t.dark,
    "--brown-mid":        t.mid,
    "--brown-light":      t.light,
    "--brown-pale":       t.pale,
    "--cream":            t.bg,
    "--background":       t.bg,
    "--gradient-primary": t.gradient,
    "--gradient-soft":    t.gradientSoft,
    "--shadow-button":    `0 2px 10px ${t.shadow}`,
    "--shadow-card":      `0 2px 16px ${t.shadowCard}`,
    "--shadow-nav":       `0 2px 24px ${t.shadowCard}`,
    "--shadow-hover":     `0 4px 20px ${t.shadowCard}`,
    "--nav-bg":           t.navBg,
  } as CSSProperties;

  return (
    <div className="flex flex-col min-h-screen" style={themeVars}>
      <TutorBackground themeKey={themeKey} />

      {viewingAs && (
        <div className="sticky top-0 z-[60] flex items-center justify-between px-4 py-2 text-sm font-medium"
          style={{ background: "#1a3a2a", color: "#a0f0b0" }}>
          <span>👀 Режим просмотра: <strong>{tutor?.name ?? viewingAs}</strong></span>
          <form action={clearViewAs}>
            <button type="submit" className="underline hover:opacity-70">
              Выйти из просмотра →
            </button>
          </form>
        </div>
      )}

      <TutorNav tutorName={tutor?.name ?? user.email ?? "Репетитор"} isPro={!!isPro} isCreatorUser={isCreator(user.email)} />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
