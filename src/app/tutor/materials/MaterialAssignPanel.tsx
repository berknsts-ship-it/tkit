"use client";

import { useState, useTransition } from "react";
import { setMaterialAssignments } from "@/app/actions/materials";
import { Users } from "lucide-react";

interface Student { id: string; name: string; }

interface Props {
  materialId: string;
  allStudents: Student[];
  assignedIds: string[];
}

export default function MaterialAssignPanel({ materialId, allStudents, assignedIds }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(assignedIds));
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      await setMaterialAssignments(materialId, [...selected]);
      setOpen(false);
    });
  };

  const cancel = () => {
    setSelected(new Set(assignedIds));
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
        style={{
          borderColor: selected.size > 0 ? "var(--brown-mid)" : "var(--brown-pale)",
          color: selected.size > 0 ? "var(--brown-dark)" : "var(--brown-light)",
          background: "white",
        }}
      >
        <Users size={13} />
        {selected.size === 0 ? "Назначить" : `${selected.size} уч.`}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={cancel} />
          <div
            className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-xl overflow-hidden"
            style={{ background: "white", borderColor: "var(--brown-pale)", minWidth: 200 }}
          >
            <div className="max-h-60 overflow-y-auto">
              {allStudents.length === 0 && (
                <p className="px-4 py-3 text-sm" style={{ color: "var(--brown-light)" }}>
                  Нет учеников
                </p>
              )}
              {allStudents.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:opacity-80 transition-all border-b last:border-0"
                  style={{ borderColor: "var(--brown-pale)" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 accent-amber-700 cursor-pointer"
                  />
                  <span className="text-sm" style={{ color: "var(--brown-dark)" }}>{s.name}</span>
                </label>
              ))}
            </div>
            <div
              className="flex gap-2 px-3 py-2.5 border-t"
              style={{ borderColor: "var(--brown-pale)", background: "#fdf8f0" }}
            >
              <button
                onClick={save}
                disabled={pending}
                className="flex-1 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--gradient-primary)" }}
              >
                {pending ? "..." : "Сохранить"}
              </button>
              <button
                onClick={cancel}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
              >
                Отмена
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
