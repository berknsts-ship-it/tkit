import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: studentsCount }, { count: lessonsCount }, { count: hwCount }] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("tutor_id", user!.id),
    supabase.from("lessons").select("*", { count: "exact", head: true })
      .eq("tutor_id", user!.id).eq("status", "scheduled"),
    supabase.from("homework").select("*", { count: "exact", head: true })
      .eq("tutor_id", user!.id).eq("status", "pending"),
  ]);

  const stats = [
    { label: "Учеников", value: studentsCount ?? 0, href: "/tutor/students" },
    { label: "Занятий запланировано", value: lessonsCount ?? 0, href: "/tutor/schedule" },
    { label: "Домашних заданий", value: hwCount ?? 0, href: "/tutor/homework" },
  ];

  return (
    <div>
      <div className="diary-bg-fixed" />

      <h1 className="text-2xl font-bold mb-6">Главная</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(stat => (
          <Link key={stat.href} href={stat.href} className="rounded-2xl p-5 border quick-action transition-all" style={{
            background: "rgba(253, 248, 240, 0.9)",
            borderColor: "var(--brown-pale)",
            boxShadow: "var(--shadow-card)",
          }}>
            <div className="text-3xl font-bold" style={{ color: "var(--brown-mid)" }}>
              {stat.value}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--brown-mid)" }}>
              {stat.label}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: "/tutor/students/new", label: "Добавить ученика" },
          { href: "/tutor/schedule", label: "Расписание" },
          { href: "/tutor/homework/new", label: "Задать домашнее задание" },
          { href: "/tutor/materials/new", label: "Загрузить материал" },
        ].map(action => (
          <Link key={action.href} href={action.href}
            className="rounded-xl p-4 border quick-action text-center font-medium transition-all"
            style={{
              background: "rgba(253, 248, 240, 0.9)",
              borderColor: "var(--brown-pale)",
              boxShadow: "var(--shadow-card)",
              color: "var(--brown-dark)",
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
