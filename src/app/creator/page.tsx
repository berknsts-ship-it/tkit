import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCreator } from "@/lib/creatorMode";
import { setViewAs } from "@/app/actions/creator";
import { listBetaCodes } from "@/app/actions/beta";
import BetaCodesPanel from "./BetaCodesPanel";
import SupportInbox from "./SupportInbox";
import Link from "next/link";

export default async function CreatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isCreator(user.email)) redirect("/tutor/dashboard");

  const admin = createAdminClient();
  const { data: tutors } = await admin
    .from("tutors")
    .select("id, name, email, plan, subject, created_at")
    .order("created_at", { ascending: false });

  const [
    { count: totalStudents },
    { count: totalLessons },
    betaCodes,
    { data: supportMessages },
  ] = await Promise.all([
    admin.from("students").select("*", { count: "exact", head: true }),
    admin.from("lessons").select("*", { count: "exact", head: true }),
    listBetaCodes(),
    admin.from("support_messages").select("id, email, message, created_at, replied_at").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--brown-dark)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-lora), Georgia, serif" }}>
              Панель создателя
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>
              Только для {user.email}
            </p>
          </div>
          <Link href="/tutor/dashboard"
            className="text-sm px-4 py-2 rounded-xl border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Мой кабинет →
          </Link>
        </div>

        {/* Глобальная статистика */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Репетиторов", value: tutors?.length ?? 0 },
            { label: "Учеников всего", value: totalStudents ?? 0 },
            { label: "Занятий всего", value: totalLessons ?? 0 },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 border text-center"
              style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
              <div className="text-3xl font-bold" style={{ color: "var(--brown-mid)" }}>{s.value}</div>
              <div className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Бета-коды */}
        <h2 className="text-lg font-semibold mb-3">Бета-коды</h2>
        <div className="mb-8">
          <BetaCodesPanel initial={betaCodes as unknown as Parameters<typeof BetaCodesPanel>[0]["initial"]} />
        </div>

        {/* Обращения в поддержку */}
        <h2 className="text-lg font-semibold mb-3">
          Поддержка
          {(supportMessages?.filter(m => !m.replied_at).length ?? 0) > 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#fef3c7", color: "#92400e" }}>
              {supportMessages!.filter(m => !m.replied_at).length} новых
            </span>
          )}
        </h2>
        <div className="mb-8">
          <SupportInbox messages={(supportMessages ?? []) as Parameters<typeof SupportInbox>[0]["messages"]} />
        </div>

        {/* Список репетиторов */}
        <h2 className="text-lg font-semibold mb-3">Репетиторы</h2>
        <div className="flex flex-col gap-3">
          {tutors?.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex flex-col">
                <span className="font-medium">{t.name ?? "—"}</span>
                <span className="text-xs mt-0.5" style={{ color: "var(--brown-light)" }}>
                  {t.email} · {t.subject ?? "Предмет не указан"} · {t.plan ?? "free"}
                </span>
              </div>
              {t.id === user.id ? (
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                  Это вы
                </span>
              ) : (
                <form action={setViewAs.bind(null, t.id)}>
                  <button type="submit"
                    className="text-sm px-4 py-1.5 rounded-xl font-medium text-white transition-all hover:opacity-80"
                    style={{ background: "var(--gradient-primary)" }}>
                    Просмотреть
                  </button>
                </form>
              )}
            </div>
          ))}
          {(!tutors || tutors.length === 0) && (
            <p className="text-sm" style={{ color: "var(--brown-light)" }}>Репетиторов пока нет.</p>
          )}
        </div>
      </div>
    </div>
  );
}
