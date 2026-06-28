"use client";

import { useState, useRef } from "react";
import WhiteboardCanvas, { WhiteboardRef } from "@/components/shared/WhiteboardCanvas";
import type { BoardMaterial } from "@/components/shared/WhiteboardCanvas";
import SyncedAudio from "@/components/shared/SyncedAudio";
import SyncedVideo from "@/components/shared/SyncedVideo";
import { getSnapshotItems } from "@/app/actions/board";
import PushSubscribeButton from "@/components/student/PushSubscribeButton";
import {
  CalendarDays, ClipboardList, BookOpen, BookMarked, PenLine,
  ChevronDown, ChevronUp, Dumbbell, RotateCcw, ArrowLeft, ArrowRight,
  BookOpen as BookOpenIcon, Globe, Languages, Feather, Scroll,
  Calculator, Atom, FlaskConical, Microscope, Zap, Binary,
  Landmark, Map, Compass, GraduationCap, Star,
} from "lucide-react";
import StudentMaterials from "./StudentMaterials";
import MarkdownContent from "@/components/shared/MarkdownContent";

// ─── Темы по предмету ───────────────────────────────────────────────────────
const SUBJECT_THEME: Record<string, { gradient: string; icons: React.ElementType[] }> = {
  "Русский язык":              { gradient: "linear-gradient(135deg, #7a3535 0%, #c07060 100%)", icons: [BookOpenIcon, Feather, PenLine, Scroll, Languages, Globe] },
  "Иностранный язык":          { gradient: "linear-gradient(135deg, #7a3535 0%, #c07060 100%)", icons: [Globe, Languages, Feather, BookOpenIcon, PenLine, Scroll] },
  "Литература":                { gradient: "linear-gradient(135deg, #6b3a28 0%, #b87050 100%)", icons: [BookOpenIcon, Scroll, Feather, PenLine, BookOpenIcon, Scroll] },
  "Математика":                { gradient: "linear-gradient(135deg, #2d3250 0%, #5a6898 100%)", icons: [Calculator, Binary, Zap, Calculator, Binary, Atom] },
  "Физика":                    { gradient: "linear-gradient(135deg, #1e3a5f 0%, #4a7ab5 100%)", icons: [Zap, Atom, Binary, Microscope, Zap, Calculator] },
  "Химия":                     { gradient: "linear-gradient(135deg, #1a4a3a 0%, #3a9070 100%)", icons: [FlaskConical, Microscope, Atom, FlaskConical, Zap, Binary] },
  "Биология":                  { gradient: "linear-gradient(135deg, #1a4020 0%, #4a8040 100%)", icons: [Microscope, Atom, FlaskConical, Microscope, Atom, Feather] },
  "Информатика":               { gradient: "linear-gradient(135deg, #1a2a4a 0%, #3a5a8a 100%)", icons: [Binary, Zap, Calculator, Binary, Zap, Atom] },
  "История и обществознание":  { gradient: "linear-gradient(135deg, #3d2d14 0%, #8a6030 100%)", icons: [Landmark, Map, Compass, Scroll, Globe, BookOpenIcon] },
};

const DEFAULT_THEME = {
  gradient: "linear-gradient(135deg, #5c3d20 0%, #a07040 100%)",
  icons: [GraduationCap, BookOpenIcon, Star, Feather, PenLine, GraduationCap],
};

const ICON_POSITIONS = [
  { top: "8%",  left: "4%",   size: 64, opacity: 0.13, rotate: -18 },
  { top: "12%", right: "5%",  size: 52, opacity: 0.11, rotate:  22 },
  { top: "40%", left: "2%",   size: 44, opacity: 0.09, rotate:   8 },
  { top: "35%", right: "3%",  size: 70, opacity: 0.10, rotate: -12 },
  { top: "68%", left: "6%",   size: 48, opacity: 0.08, rotate:  14 },
  { top: "72%", right: "4%",  size: 40, opacity: 0.09, rotate: -20 },
];

// ─── Типы ────────────────────────────────────────────────────────────────────
interface Lesson    { id: string; scheduled_at: string; duration_min?: number; notes?: string | null; }
interface HW        { id: string; title: string; description?: string | null; due_date?: string | null; status: string; }
type Material = BoardMaterial;
interface Article   { id: string; title: string; content: string; }
interface Snapshot  { id: string; title: string; created_at: string; }
interface VocabWord  { id: string; word: string; translation: string; example?: string | null; }
interface VocabTopic { id: string; title: string; words: VocabWord[]; }

interface Props {
  studentId: string;
  student: { name: string };
  subject: string | null;
  lessons: Lesson[];
  homework: HW[];
  materials: Material[];
  articles: Article[];
  snapshots: Snapshot[];
  topics: VocabTopic[];
}

const TABS = [
  { id: "lessons",   label: "Занятия",    Icon: CalendarDays  },
  { id: "homework",  label: "Задания",    Icon: ClipboardList },
  { id: "board",     label: "Доска",      Icon: PenLine       },
  { id: "notes",     label: "Конспекты",  Icon: BookMarked    },
  { id: "trainer",   label: "Тренажёр",   Icon: Dumbbell      },
  { id: "materials", label: "Материалы",  Icon: BookOpen      },
  { id: "reference", label: "Справочник", Icon: BookMarked    },
];

export default function StudentCabinet({ studentId, student, subject, lessons, homework, materials, articles, snapshots, topics }: Props) {
  const [tab,          setTab]          = useState("lessons");
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null);
  const canvasRef = useRef<WhiteboardRef>(null);

  const theme = (subject && SUBJECT_THEME[subject]) ? SUBJECT_THEME[subject] : DEFAULT_THEME;

  // ── Полноэкранный режим: Доска + просмотр конспекта ────────────────────────
  if (tab === "board" || (tab === "notes" && viewSnapshot)) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "white", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ height: 48, borderBottom: "1px solid var(--brown-pale)", background: "white" }}>
          <button
            onClick={() => tab === "notes" ? setViewSnapshot(null) : setTab("lessons")}
            className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg border hover:opacity-80"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            ← Назад
          </button>
          {tab === "notes" && viewSnapshot && (
            <span className="text-sm font-medium truncate" style={{ color: "var(--brown-dark)" }}>
              {snapshots.find(s => s.id === viewSnapshot)?.title}
            </span>
          )}
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {tab === "board" && (
            <>
              <WhiteboardCanvas ref={canvasRef} roomId={studentId} role="student" materials={materials} />
              <SyncedAudio roomId={studentId} role="student" />
              <SyncedVideo roomId={studentId} role="student" />
            </>
          )}
          {tab === "notes" && viewSnapshot && (
            <WhiteboardCanvas ref={canvasRef} roomId={`snapshot-${viewSnapshot}`} role="student" materials={[]} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-5 pt-8 pb-6" style={{ background: theme.gradient }}>

        {/* Иконки на фоне */}
        {ICON_POSITIONS.map((pos, i) => {
          const Icon = theme.icons[i % theme.icons.length];
          return (
            <div key={i} className="absolute pointer-events-none"
              style={{
                top: pos.top,
                left: "left" in pos ? (pos as { left: string }).left : undefined,
                right: "right" in pos ? (pos as { right: string }).right : undefined,
                transform: `rotate(${pos.rotate}deg)`,
                opacity: pos.opacity,
                color: "white",
              }}>
              <Icon size={pos.size} strokeWidth={1.2} />
            </div>
          );
        })}

        <p className="relative text-sm mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>Привет,</p>
        <h1 className="relative text-3xl font-bold mb-4 drop-shadow-sm"
          style={{ color: "#ffffff", fontFamily: "var(--font-lora), Georgia, serif", textShadow: "0 1px 8px rgba(0,0,0,0.25)" }}>
          {student.name}!
        </h1>

        <div className="relative flex gap-2 flex-wrap items-center">
          <Chip icon="📋" label={`${homework.length} ${plural(homework.length, "задание","задания","заданий")}`} />
          <Chip icon="📅" label={`${lessons.length} ${plural(lessons.length, "урок","урока","уроков")}`} />
          <PushSubscribeButton studentId={studentId} />
        </div>
      </div>

      {/* ── Табы ── */}
      <div className="flex overflow-x-auto border-b" style={{ borderColor: "var(--brown-pale)", background: "white" }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="flex flex-col items-center gap-1 px-4 py-3 text-xs font-medium shrink-0 border-b-2 transition-all"
              style={{
                borderBottomColor: active ? "var(--brown-dark)" : "transparent",
                color: active ? "var(--brown-dark)" : "var(--brown-light)",
              }}>
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Контент ── */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">

        {tab === "lessons" && (lessons.length === 0
          ? <EmptyState icon="📅" title="Ближайших уроков нет" sub="Здесь появятся твои запланированные уроки" />
          : lessons.map(l => {
            const dt = new Date(l.scheduled_at);
            return (
              <div key={l.id} className="rounded-xl border p-4 flex gap-4 items-start bg-white"
                style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
                <div className="shrink-0 w-12 text-center rounded-lg py-1" style={{ background: theme.gradient }}>
                  <div className="text-[10px] text-white opacity-80">{dt.toLocaleDateString("ru", { month: "short" })}</div>
                  <div className="text-xl font-bold text-white leading-tight">{dt.getDate()}</div>
                </div>
                <div>
                  <div className="font-medium" style={{ color: "var(--brown-dark)" }}>
                    {dt.toLocaleDateString("ru", { weekday: "long" })}, {dt.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {l.duration_min && <div className="text-sm mt-0.5" style={{ color: "var(--brown-mid)" }}>{l.duration_min} мин</div>}
                  {l.notes && <p className="text-sm mt-1" style={{ color: "var(--brown-light)" }}>{l.notes}</p>}
                </div>
              </div>
            );
          })
        )}

        {tab === "homework" && (homework.length === 0
          ? <EmptyState icon="📋" title="Заданий нет" sub="Репетитор ещё не задал домашнее задание" />
          : homework.map(hw => (
            <div key={hw.id} className="rounded-xl border p-4 bg-white"
              style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{hw.title}</div>
                <span className="shrink-0 text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: hw.status === "submitted" ? "#dcfce7" : "var(--brown-pale)",
                    color: hw.status === "submitted" ? "#16a34a" : "var(--brown-mid)",
                  }}>
                  {hw.status === "submitted" ? "Сдано" : "Задано"}
                </span>
              </div>
              {hw.description && <p className="text-sm mt-2" style={{ color: "var(--brown-mid)" }}>{hw.description}</p>}
              {hw.due_date && (
                <div className="text-xs mt-2 font-medium" style={{ color: "var(--brown-light)" }}>
                  Срок: {new Date(hw.due_date).toLocaleDateString("ru", { day: "numeric", month: "long" })}
                </div>
              )}
            </div>
          ))
        )}

        {tab === "notes" && (snapshots.length === 0
          ? <EmptyState icon="📓" title="Конспектов пока нет" sub="Репетитор сохранит конспекты после уроков" />
          : (
            <div className="space-y-2">
              {snapshots.map(snap => (
                <button key={snap.id}
                  onClick={async () => {
                    const items = await getSnapshotItems(snap.id);
                    setViewSnapshot(snap.id);
                    setTimeout(() => canvasRef.current?.loadItems(items as Parameters<WhiteboardRef["loadItems"]>[0]), 100);
                  }}
                  className="w-full text-left rounded-xl border p-4 bg-white hover:opacity-80 transition-all"
                  style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📓</span>
                    <div>
                      <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{snap.title}</div>
                      <div className="text-sm mt-0.5" style={{ color: "var(--brown-light)" }}>
                        {new Date(snap.created_at).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === "trainer" && <VocabTrainer topics={topics} />}

        {tab === "materials" && (materials.length === 0
          ? <EmptyState icon="📚" title="Материалов пока нет" sub="Здесь появятся учебники и файлы от репетитора" />
          : <StudentMaterials materials={materials} />
        )}

        {tab === "reference" && (articles.length === 0
          ? <EmptyState icon="📖" title="Справочник пуст" sub="Репетитор ещё не добавил статьи" />
          : articles.map(a => <ArticleCard key={a.id} article={a} />)
        )}

      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
      {icon} {label}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-semibold text-base mb-1" style={{ color: "var(--brown-dark)" }}>{title}</p>
      <p className="text-sm" style={{ color: "var(--brown-light)" }}>{sub}</p>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden bg-white"
      style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-all">
        <span className="font-medium" style={{ color: "var(--brown-dark)" }}>{article.title}</span>
        {open
          ? <ChevronUp size={16} style={{ color: "var(--brown-light)" }} />
          : <ChevronDown size={16} style={{ color: "var(--brown-light)" }} />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: "var(--brown-pale)" }}>
          <MarkdownContent text={article.content} />
        </div>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function VocabTrainer({ topics }: { topics: VocabTopic[] }) {
  const [topicId, setTopicId] = useState<string | null>(topics.length === 1 ? topics[0].id : null);
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);

  const topic = topics.find(t => t.id === topicId) ?? null;
  const words  = topic?.words ?? [];
  const word   = words[idx] ?? null;

  const goNext  = () => { setFlipped(false); setIdx(i => i + 1); };
  const goPrev  = () => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); };
  const restart = () => { setIdx(0); setFlipped(false); };
  const back    = () => { setTopicId(null); setIdx(0); setFlipped(false); };

  if (topics.length === 0) {
    return <EmptyState icon="🏋️" title="Тем для тренировки нет" sub="Репетитор ещё не добавил словари для тебя" />;
  }

  if (!topicId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-center mb-4 font-medium" style={{ color: "var(--brown-mid)" }}>
          Выбери тему для тренировки
        </p>
        {topics.map(t => (
          <button key={t.id}
            onClick={() => { setTopicId(t.id); setIdx(0); setFlipped(false); }}
            className="w-full text-left rounded-xl border p-4 bg-white hover:opacity-80 transition-all flex items-center justify-between"
            style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
            <div>
              <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{t.title}</div>
              <div className="text-sm mt-0.5" style={{ color: "var(--brown-light)" }}>
                {t.words.length} {plural(t.words.length, "слово", "слова", "слов")}
              </div>
            </div>
            <ArrowRight size={16} style={{ color: "var(--brown-light)" }} />
          </button>
        ))}
      </div>
    );
  }

  if (!word) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <div className="text-5xl">🎉</div>
        <p className="font-semibold text-lg" style={{ color: "var(--brown-dark)" }}>Все карточки пройдены!</p>
        <button onClick={restart}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "var(--gradient-primary)" }}>
          <RotateCcw size={14} /> Начать снова
        </button>
        {topics.length > 1 && (
          <button onClick={back}
            className="text-sm px-4 py-2 rounded-xl border"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            ← Другая тема
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {topics.length > 1
          ? <button onClick={back} className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg border"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
              <ArrowLeft size={13} /> Темы
            </button>
          : <span />}
        <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{topic?.title}</span>
        <span className="text-sm" style={{ color: "var(--brown-light)" }}>{idx + 1} / {words.length}</span>
      </div>

      <button onClick={() => setFlipped(f => !f)}
        className="w-full rounded-2xl border-2 bg-white hover:opacity-90 active:scale-[0.98] transition-all"
        style={{
          borderColor: flipped ? "var(--brown-mid)" : "var(--brown-pale)",
          boxShadow: "0 4px 20px rgba(59,42,26,0.12)",
          minHeight: 200,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "32px 24px", gap: 10,
        }}>
        {!flipped ? (
          <>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--brown-light)" }}>Слово</div>
            <div className="text-3xl font-bold text-center"
              style={{ color: "var(--brown-dark)", fontFamily: "var(--font-lora), Georgia, serif" }}>
              {word.word}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--brown-light)" }}>нажми чтобы увидеть перевод</div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--brown-light)" }}>Перевод</div>
            <div className="text-2xl font-bold text-center"
              style={{ color: "var(--brown-dark)", fontFamily: "var(--font-lora), Georgia, serif" }}>
              {word.translation}
            </div>
            {word.example && (
              <div className="text-sm text-center mt-1 italic" style={{ color: "var(--brown-mid)" }}>
                &ldquo;{word.example}&rdquo;
              </div>
            )}
          </>
        )}
      </button>

      <div className="flex items-center justify-between mt-4 gap-3">
        <button onClick={goPrev} disabled={idx === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:opacity-80 disabled:opacity-30"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          <ArrowLeft size={14} /> Назад
        </button>
        <button onClick={goNext}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80"
          style={{ background: "var(--gradient-primary)" }}>
          {idx < words.length - 1 ? "Следующая" : "Готово"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
