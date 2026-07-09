"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  renameGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
} from "@/app/actions/groups";

type Student = { id: string; name: string };
type Member = { student_id: string; students: { name: string } };
type Group = { id: string; name: string };

export default function GroupDetail({
  group,
  members,
  allStudents,
}: {
  group: Group;
  members: Member[];
  allStudents: Student[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(group.name);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set(members.map(m => m.student_id));
  const available = allStudents.filter(s => !memberIds.has(s.id));

  function handleRename() {
    if (!nameVal.trim() || nameVal.trim() === group.name) { setEditing(false); return; }
    startTransition(async () => {
      const res = await renameGroup(group.id, nameVal.trim());
      if (res && "error" in res) { setError(res.error ?? null); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Удалить группу «${group.name}»?`)) return;
    startTransition(async () => {
      await deleteGroup(group.id);
    });
  }

  function handleAdd() {
    if (!selectedStudentId) return;
    startTransition(async () => {
      const res = await addGroupMember(group.id, selectedStudentId);
      if (res && "error" in res) { setError(res.error ?? null); return; }
      setSelectedStudentId("");
      router.refresh();
    });
  }

  function handleRemove(studentId: string, name: string) {
    if (!confirm(`Удалить ${name} из группы?`)) return;
    startTransition(async () => {
      await removeGroupMember(group.id, studentId);
      router.refresh();
    });
  }

  const card = { background: "white", borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" };

  return (
    <div>
      {/* Заголовок с редактированием */}
      <div className="flex items-center gap-3 mb-6">
        {editing ? (
          <>
            <input
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="text-2xl font-bold border-b-2 outline-none bg-transparent flex-1"
              style={{ borderColor: "var(--brown-mid)", color: "var(--brown-dark)" }}
            />
            <button onClick={handleRename} disabled={pending}
              className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--brown-mid)" }}>
              <Check size={20} />
            </button>
            <button onClick={() => { setEditing(false); setNameVal(group.name); }}
              className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--brown-mid)" }}>
              <X size={20} />
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold flex-1" style={{ color: "var(--brown-dark)" }}>
              {group.name}
            </h1>
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--brown-mid)" }}>
              <Pencil size={18} />
            </button>
            <button onClick={handleDelete} disabled={pending}
              className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "#c0392b" }}>
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "#fff0f0", color: "#c0392b", border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {/* Добавить ученика */}
      {available.length > 0 && (
        <div className="rounded-xl border p-4 mb-6 flex gap-3 items-end" style={card}>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--brown-mid)" }}>
              Добавить ученика
            </label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                borderColor: "var(--brown-pale)",
                background: "var(--cream)",
                color: "var(--brown-dark)",
              }}
            >
              <option value="">— выберите ученика —</option>
              {available.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!selectedStudentId || pending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-40"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
          >
            <UserPlus size={16} />
            Добавить
          </button>
        </div>
      )}

      {/* Список участников */}
      <div className="space-y-2">
        {members.length === 0 ? (
          <div className="rounded-xl border p-8 text-center" style={card}>
            <p className="text-sm" style={{ color: "var(--brown-mid)" }}>В группе пока нет учеников</p>
          </div>
        ) : (
          members.map(m => (
            <div key={m.student_id} className="flex items-center gap-3 rounded-xl border p-3" style={card}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                {m.students.name[0].toUpperCase()}
              </div>
              <span className="flex-1 font-medium text-sm" style={{ color: "var(--brown-dark)" }}>
                {m.students.name}
              </span>
              <button
                onClick={() => handleRemove(m.student_id, m.students.name)}
                disabled={pending}
                className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-40"
                style={{ color: "var(--brown-light)" }}
              >
                <UserMinus size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {available.length === 0 && allStudents.length > 0 && members.length === allStudents.length && (
        <p className="mt-4 text-sm text-center" style={{ color: "var(--brown-light)" }}>
          Все ваши ученики уже в этой группе
        </p>
      )}
    </div>
  );
}
