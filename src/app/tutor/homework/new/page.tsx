import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import { createGroupHomework } from "@/app/actions/groups";

export default async function NewHomeworkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);
  const db = createAdminClient();

  const [{ data: students }, { data: groups }] = await Promise.all([
    db.from("students").select("id, name").eq("tutor_id", tutorId).order("name"),
    db.from("groups").select("id, name").eq("tutor_id", tutorId).order("name"),
  ]);

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };
  const inputStyle = { borderColor: "var(--brown-pale)", background: "#fdf8f0", color: "var(--brown-dark)" };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Задать домашнее задание</h1>
      <div className="rounded-2xl border p-6" style={card}>
        <form action={createGroupHomework} className="space-y-4">
          {/* Кому: ученик или группа */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Ученик
            </label>
            <select name="student_id" className="w-full px-4 py-2 rounded-xl border outline-none" style={inputStyle}>
              <option value="">— без конкретного ученика —</option>
              {(students ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {(groups ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
                Или группа
              </label>
              <select name="group_id" className="w-full px-4 py-2 rounded-xl border outline-none" style={inputStyle}>
                <option value="">— без группы —</option>
                {(groups ?? []).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--brown-light)" }}>
                При выборе группы задание создаётся для каждого её ученика
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Задание *
            </label>
            <input name="title" type="text" required placeholder="Упражнение 5, задания 1–8"
              className="w-full px-4 py-2 rounded-xl border outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Описание (необязательно)
            </label>
            <textarea name="description" rows={3} placeholder="Подробности, на что обратить внимание..."
              className="w-full px-4 py-2 rounded-xl border outline-none resize-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Срок сдачи
            </label>
            <input name="due_date" type="date"
              className="w-full px-4 py-2 rounded-xl border outline-none" style={inputStyle} />
          </div>

          <div className="flex gap-3 pt-2">
            <a href="/tutor/homework"
              className="flex-1 py-2 rounded-xl border font-medium text-center"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
              Отмена
            </a>
            <button type="submit"
              className="flex-1 py-2 rounded-xl font-semibold text-white"
              style={{ background: "var(--gradient-primary)" }}>
              Задать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
