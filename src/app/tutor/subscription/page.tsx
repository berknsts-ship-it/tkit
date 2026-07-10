import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const { data: tutor } = await db
    .from("tutors")
    .select("name, email, plan, plan_expires_at")
    .eq("id", tutorId)
    .single();

  const plan = tutor?.plan ?? "free";
  const expiresAt = tutor?.plan_expires_at ? new Date(tutor.plan_expires_at) : null;
  const isPermanent = expiresAt && expiresAt.getFullYear() >= 2099;

  let statusLabel = "";
  let statusColor = "";
  if (plan === "free") {
    statusLabel = "Пробный период завершён";
    statusColor = "#c03030";
  } else if (isPermanent) {
    statusLabel = "Pro — бета-доступ (бессрочно)";
    statusColor = "#2a7a2a";
  } else if (expiresAt) {
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 0) {
      statusLabel = "Pro — истёк";
      statusColor = "#c03030";
    } else {
      statusLabel = `Pro — активен, ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}`;
      statusColor = daysLeft <= 7 ? "#a06800" : "#2a7a2a";
    }
  }

  const cardStyle = {
    background: "white",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Тарифный план</h1>

      {/* Текущий план */}
      <div className="rounded-2xl p-6 border mb-6" style={cardStyle}>
        <div className="text-sm mb-1" style={{ color: "var(--brown-light)" }}>Текущий статус</div>
        <div className="text-xl font-bold mb-4" style={{ color: statusColor }}>{statusLabel}</div>

        <div className="space-y-2 text-sm" style={{ color: "var(--brown-mid)" }}>
          <div className="flex justify-between">
            <span>Email</span>
            <span className="font-medium" style={{ color: "var(--brown-dark)" }}>{tutor?.email}</span>
          </div>
          {expiresAt && !isPermanent && (
            <div className="flex justify-between">
              <span>Действует до</span>
              <span className="font-medium" style={{ color: "var(--brown-dark)" }}>
                {expiresAt.toLocaleDateString("ru-RU")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Что входит в Pro */}
      <div className="rounded-2xl p-6 border mb-6" style={cardStyle}>
        <div className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>Pro включает</div>
        <ul className="space-y-2 text-sm" style={{ color: "var(--brown-mid)" }}>
          {[
            "Интерактивная доска с синхронизацией",
            "Карточки слов и словари",
            "LaTeX-формулы и редактор кода",
            "Приватные фреймы для учеников группы",
            "Материалы, домашние задания, расписание",
            "Кабинет ученика с личным доступом",
            "Уведомления и справочные статьи",
            "Тренажёр (тест-карточки)",
          ].map(f => (
            <li key={f} className="flex items-start gap-2">
              <span style={{ color: "#2a7a2a" }}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 border text-center" style={cardStyle}>
        <div className="font-semibold mb-2" style={{ color: "var(--brown-dark)" }}>
          Продление и оплата
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--brown-mid)" }}>
          Для продления тарифа или вопросов по оплате напишите нам:
        </p>
        <a href="mailto:support@t-kit.ru"
          className="inline-block px-6 py-3 rounded-xl font-semibold text-white text-sm"
          style={{ background: "var(--brown-mid)" }}>
          support@t-kit.ru
        </a>
      </div>

      <div className="mt-4">
        <Link href="/tutor/dashboard" className="text-sm" style={{ color: "var(--brown-light)" }}>
          ← На главную
        </Link>
      </div>
    </div>
  );
}
