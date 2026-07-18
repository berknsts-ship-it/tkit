"use client";

import { useState, useRef } from "react";
import WhiteboardCanvas, { WhiteboardRef } from "@/components/shared/WhiteboardCanvas";
import type { BoardMaterial } from "@/components/shared/WhiteboardCanvas";
import SyncedAudio from "@/components/shared/SyncedAudio";
import SyncedVideo from "@/components/shared/SyncedVideo";
import { getSnapshotItems } from "@/app/actions/board";
import { studentSubmitHomework, studentUnsubmitHomework } from "@/app/actions/homework";
import PushSubscribeButton from "@/components/student/PushSubscribeButton";
import NotificationBanner from "@/components/student/NotificationBanner";
import { speak } from "@/lib/speak";
import {
  CalendarDays, ClipboardList, BookOpen, BookMarked, PenLine,
  ChevronDown, ChevronUp, Dumbbell, RotateCcw, ArrowLeft, ArrowRight, Volume2,
  BookOpen as BookOpenIcon, Globe, Languages, Feather, Scroll,
  Calculator, Atom, FlaskConical, Microscope, Zap, Binary,
  Landmark, Map, Compass, GraduationCap, Star, Check, Undo2, Clock,
} from "lucide-react";
import StudentMaterials from "./StudentMaterials";
import MarkdownContent from "@/components/shared/MarkdownContent";
import TrainerPractice, { type TrainerCard } from "@/components/trainer/TrainerPractice";

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
interface VocabTopic { id: string; title: string; language: string; words: VocabWord[]; }

interface UnreadNotif { id: string; title: string; body: string; }

interface TrainerDeck {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  cards: { id: string; deck_id: string; type: string; front: string; back: string; options: string[] | null }[];
}

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
  unreadNotifications?: UnreadNotif[];
  trainerDecks?: TrainerDeck[];
  subjectProfile?: string;
  boardBg?: string;
  studentGroups?: { id: string; name: string }[];
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

export default function StudentCabinet({ studentId, student, subject, lessons, homework, materials, articles, snapshots, topics, unreadNotifications = [], trainerDecks = [], subjectProfile, boardBg, studentGroups = [] }: Props) {
  const [tab,          setTab]          = useState("lessons");
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null);
  const [boardRoomId,  setBoardRoomId]  = useState<string>(studentId);
  const canvasRef = useRef<WhiteboardRef>(null);

  const theme = (subject && SUBJECT_THEME[subject]) ? SUBJECT_THEME[subject] : DEFAULT_THEME;

  // ── Полноэкранный режим: Доска + просмотр конспекта ────────────────────────
  if (tab === "board" || (tab === "notes" && viewSnapshot)) {
    const boardLabel = boardRoomId === studentId
      ? "Моя доска"
      : (studentGroups.find(g => g.id === boardRoomId)?.name ?? "Доска группы");
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "white", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ height: 48, borderBottom: "1px solid var(--brown-pale)", background: "white" }}>
          <button
            onClick={() => tab === "notes" ? setViewSnapshot(null) : setTab("lessons")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:opacity-80"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            <ArrowLeft size={15}/> Назад
          </button>
          {tab === "board" && studentGroups.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => { setBoardRoomId(studentId); canvasRef.current?.loadItems([]); }}
                className="text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-all"
                style={{
                  borderColor: boardRoomId === studentId ? "var(--brown-mid)" : "var(--brown-pale)",
                  background:  boardRoomId === studentId ? "var(--brown-mid)" : "transparent",
                  color:       boardRoomId === studentId ? "white" : "var(--brown-mid)",
                }}>
                Моя доска
              </button>
              {studentGroups.map(g => (
                <button key={g.id}
                  onClick={() => { setBoardRoomId(g.id); canvasRef.current?.loadItems([]); }}
                  className="text-xs px-2.5 py-1 rounded-lg border shrink-0 transition-all"
                  style={{
                    borderColor: boardRoomId === g.id ? "var(--brown-mid)" : "var(--brown-pale)",
                    background:  boardRoomId === g.id ? "var(--brown-mid)" : "transparent",
                    color:       boardRoomId === g.id ? "white" : "var(--brown-mid)",
                  }}>
                  👥 {g.name}
                </button>
              ))}
            </div>
          )}
          {tab === "notes" && viewSnapshot && (
            <span className="text-sm font-medium truncate" style={{ color: "var(--brown-dark)" }}>
              {snapshots.find(s => s.id === viewSnapshot)?.title}
            </span>
          )}
          {tab === "board" && studentGroups.length === 0 && (
            <span className="text-sm font-medium" style={{ color: "var(--brown-dark)" }}>{boardLabel}</span>
          )}
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {tab === "board" && (
            <>
              <WhiteboardCanvas key={boardRoomId} ref={canvasRef} roomId={boardRoomId} role="student" materials={materials} subjectProfile={subjectProfile} boardBg={boardBg} currentStudentId={studentId} myName={student.name} />
              <SyncedAudio roomId={boardRoomId} role="student" />
              <SyncedVideo roomId={boardRoomId} role="student" />
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
      <NotificationBanner studentId={studentId} notifications={unreadNotifications} />

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
        <h1 className="relative text-3xl font-bold mb-3 drop-shadow-sm"
          style={{ color: "#ffffff", fontFamily: "var(--font-lora), Georgia, serif", textShadow: "0 1px 8px rgba(0,0,0,0.25)" }}>
          {student.name}!
        </h1>

        {/* Следующий урок */}
        {lessons.length > 0 && (() => {
          const next = lessons[0];
          const dt = new Date(next.scheduled_at);
          const now = new Date();
          const diffMs = dt.getTime() - now.getTime();
          const diffH = diffMs / 3600000;
          const timeStr = dt.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
          const label = diffH < 0 ? null
            : diffH < 1 ? `через ${Math.round(diffMs/60000)} мин`
            : diffH < 24 ? `сегодня в ${timeStr}`
            : diffH < 48 ? `завтра в ${timeStr}`
            : dt.toLocaleDateString("ru", { day: "numeric", month: "short" }) + ` в ${timeStr}`;
          return label ? (
            <div className="relative flex items-center gap-1.5 mb-3 text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.9)" }}>
              <Clock size={14} style={{ opacity: 0.8 }}/>
              Следующий урок: {label}
            </div>
          ) : null;
        })()}

        <div className="relative flex gap-2 flex-wrap items-center">
          <Chip icon="📋" label={`${homework.length} ${plural(homework.length, "задание","задания","заданий")}`} />
          <Chip icon="📅" label={`${lessons.length} ${plural(lessons.length, "урок","урока","уроков")}`} />
          <PushSubscribeButton studentId={studentId} />
        </div>
      </div>

      {/* ── Табы ── */}
      <div className="relative border-b" style={{ borderColor: "var(--brown-pale)", background: "white" }}>
        <div className="flex overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
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
        {/* Градиент-подсказка что можно скроллить вправо */}
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
          style={{ background: "linear-gradient(to right, transparent, white)" }} />
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
          : homework.map(hw => <HomeworkCard key={hw.id} hw={hw} studentId={studentId} />)
        )}

        {tab === "notes" && (snapshots.length === 0
          ? <EmptyState icon="📓" title="Конспектов пока нет" sub="Репетитор сохранит конспекты после уроков" />
          : (
            <div className="space-y-2">
              {snapshots.map(snap => (
                <button key={snap.id}
                  onClick={async () => {
                    try {
                      const items = await getSnapshotItems(snap.id);
                      setViewSnapshot(snap.id);
                      setTimeout(() => canvasRef.current?.loadItems(items as Parameters<WhiteboardRef["loadItems"]>[0]), 100);
                    } catch { /* malformed snapshot — skip */ }
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

        {tab === "trainer" && (
          <TrainerSection
            studentId={studentId}
            subject={subject}
            topics={topics}
            trainerDecks={trainerDecks}
          />
        )}

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

function HomeworkCard({ hw, studentId }: { hw: { id: string; title: string; description?: string | null; due_date?: string | null; status: string }; studentId: string }) {
  const [status, setStatus] = useState(hw.status);
  const [loading, setLoading] = useState(false);

  const overdue = hw.due_date && status !== "submitted" && new Date(hw.due_date) < new Date();

  async function toggleSubmit() {
    setLoading(true);
    try {
      if (status === "submitted") {
        await studentUnsubmitHomework(hw.id, studentId);
        setStatus("pending");
      } else {
        await studentSubmitHomework(hw.id, studentId);
        setStatus("submitted");
      }
    } catch {
      // статус не меняем при ошибке
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 bg-white"
      style={{
        borderColor: overdue ? "#fca5a5" : status === "submitted" ? "#86efac" : "var(--brown-pale)",
        boxShadow: "var(--shadow-card)",
        background: overdue ? "#fff5f5" : status === "submitted" ? "#f0fdf4" : "white",
      }}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{hw.title}</div>
        <span className="shrink-0 text-xs px-2 py-1 rounded-full font-medium"
          style={{
            background: status === "submitted" ? "#dcfce7" : overdue ? "#fee2e2" : "var(--brown-pale)",
            color: status === "submitted" ? "#16a34a" : overdue ? "#dc2626" : "var(--brown-mid)",
          }}>
          {status === "submitted" ? "Сдано" : overdue ? "Просрочено" : "Задано"}
        </span>
      </div>
      {hw.description && <p className="text-sm mt-2" style={{ color: "var(--brown-mid)" }}>{hw.description}</p>}
      {hw.due_date && (
        <div className="text-xs mt-2 font-medium flex items-center gap-1"
          style={{ color: overdue ? "#dc2626" : "var(--brown-light)" }}>
          {overdue && <Clock size={11} />}
          Срок: {new Date(hw.due_date).toLocaleDateString("ru", { day: "numeric", month: "long" })}
        </div>
      )}
      <button onClick={toggleSubmit} disabled={loading}
        className="mt-3 w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-60"
        style={{
          background: status === "submitted" ? "#f3f4f6" : "var(--gradient-primary)",
          color: status === "submitted" ? "var(--brown-mid)" : "white",
          border: status === "submitted" ? "1px solid var(--brown-pale)" : "none",
        }}>
        {loading ? "..." : status === "submitted"
          ? <><Undo2 size={14} /> Отменить сдачу</>
          : <><Check size={14} /> Отметить как выполнено</>}
      </button>
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

function TrainerSection({
  studentId, subject, topics, trainerDecks,
}: {
  studentId: string;
  subject: string | null;
  topics: VocabTopic[];
  trainerDecks: TrainerDeck[];
}) {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const isLanguage = subject === "Иностранный язык";

  if (selectedDeckId) {
    const deck = trainerDecks.find(d => d.id === selectedDeckId);
    return (
      <div>
        <button
          onClick={() => setSelectedDeckId(null)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border mb-4"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          <ArrowLeft size={13} /> Назад
        </button>
        <p className="font-semibold mb-4" style={{ color: "var(--brown-dark)" }}>{deck?.title}</p>
        <TrainerPractice
          deckId={selectedDeckId}
          cards={(deck?.cards ?? []) as TrainerCard[]}
          studentId={studentId}
          onDone={() => setSelectedDeckId(null)}
        />
      </div>
    );
  }

  const hasDecks = trainerDecks.length > 0;
  const hasVocab = isLanguage && topics.length > 0;

  if (!hasDecks && !hasVocab) {
    return <EmptyState icon="🏋️" title="Тренажёр пуст" sub="Репетитор ещё не назначил тебе задания" />;
  }

  return (
    <div className="space-y-3">
      {trainerDecks.map(deck => (
        <button key={deck.id}
          onClick={() => setSelectedDeckId(deck.id)}
          className="w-full text-left rounded-xl border p-4 bg-white hover:opacity-80 transition-all flex items-center justify-between"
          style={{ borderColor: "var(--brown-pale)", boxShadow: "var(--shadow-card)" }}>
          <div>
            <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{deck.title}</div>
            <div className="text-sm mt-0.5" style={{ color: "var(--brown-light)" }}>
              {deck.subject ? `${deck.subject} · ` : ""}{deck.cards.length} {plural(deck.cards.length, "карточка", "карточки", "карточек")}
            </div>
          </div>
          <ArrowRight size={16} style={{ color: "var(--brown-light)" }} />
        </button>
      ))}

      {isLanguage && topics.length > 0 && (
        <div>
          {trainerDecks.length > 0 && (
            <p className="text-xs font-medium mb-2 mt-4 uppercase tracking-wider" style={{ color: "var(--brown-light)" }}>
              Словарь
            </p>
          )}
          <VocabTrainer topics={topics} />
        </div>
      )}
    </div>
  );
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

      <div className="relative">
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
        <button
          onClick={e => { e.stopPropagation(); speak(word.word, topic?.language ?? "en-US"); }}
          className="absolute bottom-3 right-3 p-2 rounded-full border hover:opacity-80 transition-all"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "white" }}
          title="Произнести">
          <Volume2 size={15} />
        </button>
      </div>

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
