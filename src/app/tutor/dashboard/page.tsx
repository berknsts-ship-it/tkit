import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import Link from "next/link";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import WelcomeModal from "@/components/WelcomeModal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tutorId = await getEffectiveTutorId(user!);
  const db = createAdminClient();

  const [
    { data: tutorData },
    { count: studentsCount },
    { count: lessonsCount },
    { count: hwCount },
    { data: unpaidLessons },
  ] = await Promise.all([
    db.from("tutors")
      .select("plan, plan_expires_at, onboarding_steps, onboarding_completed, welcome_shown, subject_profile")
      .eq("id", tutorId).single(),
    db.from("students").select("*", { count: "exact", head: true }).eq("tutor_id", tutorId),
    db.from("lessons").select("*", { count: "exact", head: true })
      .eq("tutor_id", tutorId).eq("status", "scheduled"),
    db.from("homework").select("*", { count: "exact", head: true })
      .eq("tutor_id", tutorId).eq("status", "pending"),
    db.from("lessons").select("price_rub")
      .eq("tutor_id", tutorId)
      .eq("payment_status", "unpaid")
      .neq("status", "cancelled"),
  ]);

  const unpaidTotal = (unpaidLessons ?? []).reduce((s, l) => s + (l.price_rub ?? 0), 0);

  const plan = tutorData?.plan ?? "free";
  const expiresAt = tutorData?.plan_expires_at ? new Date(tutorData.plan_expires_at) : null;
  const isPermanent = expiresAt && expiresAt.getFullYear() >= 2099;
  const daysLeft = expiresAt && !isPermanent
    ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  // ── Онбординг ──────────────────────────────────────────────────────────
  const onboardingCompleted = tutorData?.onboarding_completed ?? true;
  const welcomeShown = tutorData?.welcome_shown ?? true;
  const storedSteps = (tutorData?.onboarding_steps ?? {}) as Record<string, boolean>;

  type StepItem = { key: string; label: string; href: string; done: boolean };
  let onboardingSteps: StepItem[] = [];

  if (!onboardingCompleted) {
    // Получаем id демо-ученика чтобы исключить из проверок
    const { data: demoList } = await db
      .from("students").select("id")
      .eq("tutor_id", tutorId).eq("is_demo", true);
    const demoIds = (demoList ?? []).map(s => s.id as string);

    const [{ count: realSC }, { count: realLC }] = await Promise.all([
      db.from("students").select("*", { count: "exact", head: true })
        .eq("tutor_id", tutorId).eq("is_demo", false),
      demoIds.length > 0
        ? db.from("lessons").select("*", { count: "exact", head: true })
            .eq("tutor_id", tutorId).eq("status", "scheduled")
            .not("student_id", "in", `(${demoIds.join(",")})`)
        : db.from("lessons").select("*", { count: "exact", head: true })
            .eq("tutor_id", tutorId).eq("status", "scheduled"),
    ]);

    const computed: Record<string, boolean> = {
      add_student:      (realSC ?? 0) > 0,
      setup_schedule:   (realLC ?? 0) > 0,
      open_board:       !!storedSteps.open_board,
      settings_profile: !!storedSteps.settings_profile,
    };

    // Сохраняем в БД если шаги были выполнены
    const updates: Record<string, boolean> = {};
    for (const [key, done] of Object.entries(computed)) {
      if (done && !storedSteps[key]) updates[key] = true;
    }
    if (Object.keys(updates).length > 0) {
      await db.from("tutors")
        .update({ onboarding_steps: { ...storedSteps, ...updates } })
        .eq("id", tutorId);
    }

    const finalSteps = { ...storedSteps, ...updates, ...computed };
    onboardingSteps = [
      { key: "add_student",      label: "Добавьте своего первого ученика",          href: "/tutor/students/new", done: finalSteps.add_student ?? false },
      { key: "setup_schedule",   label: "Настройте расписание",                     href: "/tutor/schedule",     done: finalSteps.setup_schedule ?? false },
      { key: "open_board",       label: "Откройте доску и попробуйте инструменты",  href: "/tutor/board",        done: finalSteps.open_board ?? false },
      { key: "settings_profile", label: "Выберите профиль предмета в настройках",   href: "/tutor/settings",     done: finalSteps.settings_profile ?? false },
    ];
  }

  const cardStyle = {
    background: "white",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div>
      <WelcomeModal show={!welcomeShown} />

      <h1 className="text-2xl font-bold mb-6">Главная</h1>

      {/* Чеклист онбординга */}
      {!onboardingCompleted && onboardingSteps.length > 0 && (
        <OnboardingChecklist steps={onboardingSteps} />
      )}

      {/* Баннер тарифного плана */}
      {plan === "free" && (
        <Link href="/tutor/subscription"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-6 border"
          style={{ background: "#fff8e6", borderColor: "#f0c040", color: "#a06800" }}>
          <span className="text-sm font-medium">Пробный период завершён — узнать о тарифах</span>
          <span className="text-sm font-semibold shrink-0">Подробнее →</span>
        </Link>
      )}
      {plan === "pro" && daysLeft !== null && daysLeft <= 14 && (
        <Link href="/tutor/subscription"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-6 border"
          style={{ background: daysLeft <= 3 ? "#fff0f0" : "#fff8e6",
                   borderColor: daysLeft <= 3 ? "#f09090" : "#f0c040",
                   color: daysLeft <= 3 ? "#c03030" : "#a06800" }}>
          <span className="text-sm font-medium">
            {daysLeft <= 0 ? "Тариф истёк" : `До окончания тарифа: ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}`}
          </span>
          <span className="text-sm font-semibold shrink-0">Продлить →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link href="/tutor/students" className="rounded-2xl p-5 border quick-action transition-all" style={cardStyle}>
          <div className="text-3xl font-bold" style={{ color: "var(--brown-mid)" }}>{studentsCount ?? 0}</div>
          <div className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>Учеников</div>
        </Link>
        <Link href="/tutor/schedule" className="rounded-2xl p-5 border quick-action transition-all" style={cardStyle}>
          <div className="text-3xl font-bold" style={{ color: "var(--brown-mid)" }}>{lessonsCount ?? 0}</div>
          <div className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>Занятий</div>
        </Link>
        <Link href="/tutor/homework" className="rounded-2xl p-5 border quick-action transition-all" style={cardStyle}>
          <div className="text-3xl font-bold" style={{ color: "var(--brown-mid)" }}>{hwCount ?? 0}</div>
          <div className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>Домашних</div>
        </Link>
        <Link href="/tutor/schedule" className="rounded-2xl p-5 border quick-action transition-all"
          style={{ ...cardStyle, borderColor: unpaidTotal > 0 ? "#f0d090" : "var(--brown-pale)" }}>
          <div className="text-3xl font-bold" style={{ color: unpaidTotal > 0 ? "#c07800" : "var(--brown-mid)" }}>
            {unpaidTotal > 0 ? `${unpaidTotal.toLocaleString("ru")} ₽` : "—"}
          </div>
          <div className="text-sm mt-1" style={{ color: unpaidTotal > 0 ? "#c07800" : "var(--brown-mid)" }}>
            Не оплачено
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: "/tutor/students/new", label: "Добавить ученика" },
          { href: "/tutor/schedule",     label: "Расписание" },
          { href: "/tutor/homework/new", label: "Задать домашнее задание" },
          { href: "/tutor/materials/new",label: "Загрузить материал" },
        ].map(action => (
          <Link key={action.href} href={action.href}
            className="rounded-xl p-4 border quick-action text-center font-medium transition-all"
            style={{ ...cardStyle, color: "var(--brown-dark)" }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
