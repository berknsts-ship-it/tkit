import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import { Plus, Bell, Trash2, Send, Clock, RefreshCw } from "lucide-react";
import { deleteNotification } from "@/app/actions/notifications";

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const admin = createAdminClient();
  const { data: notifications } = await admin.from("notifications")
    .select("*, notification_recipients(student_id, students(name))")
    .eq("tutor_id", tutorId)
    .order("scheduled_at", { ascending: false });

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.95)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        <Link href="/tutor/notifications/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
          <Plus size={16} />
          Создать
        </Link>
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={cardStyle}>
          <Bell size={40} className="mx-auto mb-3" style={{ color: "var(--brown-pale)" }} />
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Уведомлений пока нет</p>
          <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>
            Создай уведомление — оно придёт ученику в нужное время и будет висеть на экране до подтверждения
          </p>
          <Link href="/tutor/notifications/new"
            className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            Создать первое уведомление
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const isRecurring = !!n.recurrence_days;
            const isSent = !!n.sent_at;
            const scheduledLocal = new Date(n.scheduled_at).toLocaleString("ru", {
              timeZone: n.timezone,
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            });
            const recipients = (n.notification_recipients as { student_id: string; students: { name: string } | null }[]) ?? [];
            const names = recipients.map(r => r.students?.name).filter(Boolean);
            const daysStr = isRecurring
              ? (n.recurrence_days as number[]).sort((a: number, b: number) => {
                  const order = [1,2,3,4,5,6,0];
                  return order.indexOf(a) - order.indexOf(b);
                }).map((d: number) => DAY_LABELS[d]).join(", ")
              : null;

            return (
              <div key={n.id} className="rounded-xl border p-4" style={cardStyle}>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: isRecurring ? "#e8f0ff" : isSent ? "#d8f5e0" : "var(--brown-pale)" }}>
                    {isRecurring
                      ? <RefreshCw size={15} style={{ color: "#2060d0" }} />
                      : isSent
                      ? <Send size={15} style={{ color: "#1a7a3a" }} />
                      : <Clock size={15} style={{ color: "var(--brown-mid)" }} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>{n.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={isRecurring
                          ? { background: "#e8f0ff", color: "#2060d0" }
                          : isSent
                          ? { background: "#d8f5e0", color: "#1a7a3a" }
                          : { background: "#fff3cc", color: "#c07800" }}>
                        {isRecurring ? "Повторяется" : isSent ? "Отправлено" : "Ожидает"}
                      </span>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--brown-mid)" }}>{n.body}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs" style={{ color: "var(--brown-light)" }}>
                      {isRecurring
                        ? <span>{daysStr} · {n.recurrence_time} ({n.timezone.split("/").pop()}) · след.: {scheduledLocal}</span>
                        : <span>{scheduledLocal} ({n.timezone.split("/").pop()})</span>}
                      <span>
                        {names.length === 0 ? "Получатели не выбраны"
                          : names.length <= 3 ? names.join(", ")
                          : `${names.slice(0, 2).join(", ")} + ещё ${names.length - 2}`}
                      </span>
                    </div>
                  </div>

                  <form action={async () => { "use server"; await deleteNotification(n.id); }}>
                    <button type="submit"
                      className="shrink-0 p-2 rounded-lg border transition-all hover:opacity-70"
                      style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}
                      title="Удалить">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
