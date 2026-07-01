import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTutorId } from "@/lib/creatorMode";
import { redirect } from "next/navigation";
import { Upload, FileText, Trash2, BookOpen } from "lucide-react";
import { deleteMaterial } from "@/app/actions/materials";
import MaterialAssignPanel from "./MaterialAssignPanel";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const tutorId = await getEffectiveTutorId(user);

  const admin = createAdminClient();

  const [
    { data: materials },
    { data: students },
  ] = await Promise.all([
    admin.from("materials")
      .select("*, material_assignments(student_id)")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false }),
    admin.from("students")
      .select("id, name")
      .eq("tutor_id", tutorId)
      .order("name"),
  ]);

  const cardStyle = {
    background: "rgba(253, 248, 240, 0.95)",
    borderColor: "var(--brown-pale)",
    boxShadow: "var(--shadow-card)",
  };

  function getFileIcon(fileName: string | null) {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (["jpg", "jpeg", "png", "gif"].includes(ext ?? "")) return "🖼️";
    if (["doc", "docx"].includes(ext ?? "")) return "📝";
    if (["ppt", "pptx"].includes(ext ?? "")) return "📊";
    return "📎";
  }

  const allStudents = students ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Материалы</h1>
        <Link
          href="/tutor/materials/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
        >
          <Upload size={16} />
          Загрузить
        </Link>
      </div>

      {!materials || materials.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={cardStyle}>
          <FileText size={40} className="mx-auto mb-3" style={{ color: "var(--brown-pale)" }} />
          <p className="font-medium" style={{ color: "var(--brown-mid)" }}>Материалов пока нет</p>
          <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>
            Загрузите учебники, PDF или другие файлы — потом назначите нужным ученикам
          </p>
          <Link
            href="/tutor/materials/new"
            className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            Загрузить первый материал
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map(m => {
            const assignedIds: string[] = (m.material_assignments as { student_id: string }[] | null)
              ?.map(a => a.student_id) ?? [];
            const assignedNames = assignedIds
              .map(id => allStudents.find(s => s.id === id)?.name)
              .filter(Boolean);

            return (
              <div key={m.id} className="rounded-xl border p-4" style={cardStyle}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">{getFileIcon(m.file_name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: "var(--brown-dark)" }}>
                      {m.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {assignedNames.length === 0 ? (
                        <span className="text-xs" style={{ color: "var(--brown-light)" }}>
                          Никому не назначен
                        </span>
                      ) : (
                        assignedNames.map((name, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "#e8f0ff", color: "#2060d0" }}
                          >
                            {name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {m.file_url && (
                      <Link
                        href={`/tutor/materials/view?url=${encodeURIComponent(m.file_url)}&name=${encodeURIComponent(m.title)}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                        style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}
                        title="Читать"
                      >
                        <BookOpen size={15} />
                        Читать
                      </Link>
                    )}
                    <MaterialAssignPanel
                      materialId={m.id}
                      allStudents={allStudents}
                      assignedIds={assignedIds}
                    />
                    <form action={async () => { "use server"; await deleteMaterial(m.id); }}>
                      <button
                        type="submit"
                        className="p-2 rounded-lg border transition-all hover:opacity-70"
                        style={{ borderColor: "var(--brown-pale)", color: "var(--brown-light)" }}
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
