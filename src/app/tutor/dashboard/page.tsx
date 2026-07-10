import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tutorId = await getEffectiveTutorId(user!);
  const db = createAdminClient();

  const [
    { count: studentsCount },
    { count: lessonsCount },
    { count: hwCount },
    { data: unpaidLessons },
    { data: tutorPlan },
  ] = await Promise.all([
    db.from("students").select("*", { count: "exact", head: true }).eq("tutor_id", tutorId),
    db.from("lessons").select("*", { count: "exact", head: true })
      .eq("tutor_id", tutorId).eq("status", "scheduled"),
    db.from("homework").select("*", { count: "exact", head: true })
      .eq("tutor_id", tutorId).eq("status", "pending"),
    db.from("lessons").select("price_rub")
      .eq("tutor_id", tutorId)
      .eq("payment_status", "unpaid")
      .neq("status", "cancelled"),
    db.from("tutors").select("plan, plan_expires_at").eq("id", tutorId).single(),
  ]);

  const unpaidTotal = (unpaidLessons ?? []).reduce((s, l) => s + (l.price_rub ?? 0), 0);

  const plan = tutorPlan?.plan ?? "free";
  const expiresAt = tutorPlan?.plan_expires_at ? new Date(tutorPlan.plan_expires_at) : null;
  const isPermanent = expiresAt && expiresAt.getFullYear() >= 2099;
  const daysLeft = expiresAt && !isPermanent
    ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  const cardStyle = {
    background: "white",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Главная</h1>

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
