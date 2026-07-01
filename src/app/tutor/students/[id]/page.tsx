import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SubscriptionCard from "@/components/tutor/SubscriptionCard";
import CreateSubscriptionForm from "@/components/tutor/CreateSubscriptionForm";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: student }, { data: subscriptions }] = await Promise.all([
    db.from("students").select("*").eq("id", id).eq("tutor_id", tutorId).single(),
    db.from("subscriptions").select("*").eq("student_id", id).eq("tutor_id", tutorId).order("created_at", { ascending: false }),
  ]);

  if (!student) redirect("/tutor/students");

  const activeSub = subscriptions?.find(s => s.status === "active") ?? null;

  // Уроки, привязанные к активному абонементу
  let subLessons: Record<string, unknown>[] = [];
  if (activeSub) {
    const { data } = await db.from("lessons")
      .select("id, scheduled_at, duration_min, price_rub, status, deducted_amount, notes")
      .eq("subscription_id", activeSub.id)
      .order("scheduled_at");
    subLessons = (data as Record<string, unknown>[]) ?? [];
  }

  return (
    <div className="max-w-2xl">
      <Link href="/tutor/students"
        className="flex items-center gap-1 text-sm mb-5 hover:opacity-70 transition-all"
        style={{ color: "var(--brown-mid)" }}>
        <ChevronLeft size={16}/> Все ученики
      </Link>

      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
          style={{ background: "var(--gradient-primary)" }}>
          {student.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>{student.name}</h1>
          {student.notes && <p className="text-sm" style={{ color: "var(--brown-mid)" }}>{student.notes}</p>}
        </div>
      </div>

      {/* Абонемент */}
      {activeSub ? (
        <SubscriptionCard
          subscription={activeSub}
          student={student}
          lessons={subLessons}
          studentId={id}
        />
      ) : (
        <CreateSubscriptionForm studentId={id} studentName={student.name} />
      )}

      {/* Архив отменённых абонементов */}
      {subscriptions && subscriptions.filter(s => s.status === "cancelled").length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium mb-2" style={{ color: "var(--brown-light)" }}>Закрытые абонементы</p>
          {subscriptions.filter(s => s.status === "cancelled").map(s => (
            <div key={s.id} className="rounded-xl border px-4 py-3 mb-2 opacity-50"
              style={{ borderColor: "var(--brown-pale)", background: "white" }}>
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-sm ml-3" style={{ color: "var(--brown-light)" }}>
                {s.total_amount.toLocaleString("ru")} ₽ · остаток {s.balance.toLocaleString("ru")} ₽
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
