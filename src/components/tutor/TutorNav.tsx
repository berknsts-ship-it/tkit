"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu, X } from "lucide-react";
import TKitLogo from "@/components/TKitLogo";
import { SupportChatButton } from "@/components/SupportChat";
import { setSubjectOverride } from "@/app/actions/creator";
import { SUBJECT_THEME } from "@/lib/themes";

const SUBJECTS = Object.keys(SUBJECT_THEME);

const LANGUAGE_SUBJECT = "Иностранный язык";

const navLinks = [
  { href: "/tutor/dashboard",      label: "Главная" },
  { href: "/tutor/students",       label: "Ученики" },
  { href: "/tutor/groups",         label: "Группы" },
  { href: "/tutor/schedule",       label: "Расписание" },
  { href: "/tutor/homework",       label: "Задания" },
  { href: "/tutor/materials",      label: "Материалы" },
  { href: "/tutor/notifications",  label: "Уведомления" },
  { href: "/tutor/board",          label: "Доска" },
  { href: "/tutor/settings",       label: "Настройки" },
  { href: "/tutor/trainer",        label: "Тренажер",   proOnly: true },
  { href: "/tutor/reference",      label: "Справочник", proOnly: true },
  { href: "/tutor/vocabulary",     label: "Словарь",    proOnly: true, languageOnly: true },
];

export default function TutorNav({ tutorName, isPro, isCreatorUser, subject, subjectOverride }: {
  tutorName: string; isPro: boolean; isCreatorUser?: boolean; subject?: string | null; subjectOverride?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubjectChange(value: string) {
    startTransition(async () => {
      await setSubjectOverride(value || null);
      router.refresh();
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const isLanguage = subject === LANGUAGE_SUBJECT;
  const visibleLinks = navLinks.filter(l =>
    (!l.proOnly || isPro) && (!l.languageOnly || isLanguage)
  );

  return (
    <>
      <nav data-tutor-nav className="sticky top-0 z-50 border-b" style={{
        background: "var(--nav-bg)",
        borderColor: "var(--brown-pale)",
        boxShadow: "var(--shadow-nav)",
        backdropFilter: "blur(8px)",
      }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Логотип */}
          <Link href="/tutor/dashboard" className="shrink-0">
            <TKitLogo size="md" />
          </Link>

          {/* Десктоп-навигация */}
          <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
            {visibleLinks.map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                  style={{
                    color: active ? "var(--brown-dark)" : "var(--brown-mid)",
                    background: active ? "var(--brown-pale)" : "transparent",
                  }}>
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {isCreatorUser && (
              <>
                <select
                  value={subjectOverride ?? ""}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={pending}
                  className="text-xs rounded-full border px-2 py-1"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)", background: "transparent" }}>
                  <option value="">— предмет —</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Link href="/creator"
                  className="text-xs font-semibold px-3 py-1 rounded-full border"
                  style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
                  👀 Создатель
                </Link>
              </>
            )}
            {!isPro && (
              <Link href="/tutor/subscription"
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: "var(--gradient-primary)", color: "white" }}>
                PRO
              </Link>
            )}
            <SupportChatButton />
            <span className="text-sm max-w-[120px] truncate" style={{ color: "var(--brown-mid)" }}>{tutorName}</span>
            <button onClick={handleSignOut}
              className="text-sm px-3 py-1 rounded-lg border transition-all hover:opacity-70"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
              Выйти
            </button>
          </div>

          {/* Мобильный бургер */}
          <button onClick={() => setOpen(o => !o)} className="md:hidden p-2 rounded-lg"
            style={{ color: "var(--brown-dark)" }}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Мобильное меню */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col" style={{ background: "var(--nav-bg)", top: "56px" }}>
          <div className="flex flex-col px-4 py-4 gap-1 flex-1 overflow-y-auto">
            {visibleLinks.map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                  className="text-base font-medium px-4 py-3 rounded-xl transition-all"
                  style={{
                    color: active ? "var(--brown-dark)" : "var(--brown-mid)",
                    background: active ? "var(--brown-pale)" : "transparent",
                  }}>
                  {link.label}
                </Link>
              );
            })}
            {isCreatorUser && (
              <Link href="/creator" onClick={() => setOpen(false)}
                className="text-base font-medium px-4 py-3 rounded-xl mt-2"
                style={{ color: "var(--brown-mid)", background: "var(--brown-pale)" }}>
                👀 Панель создателя
              </Link>
            )}
            {!isPro && (
              <Link href="/tutor/subscription" onClick={() => setOpen(false)}
                className="text-base font-semibold px-4 py-3 rounded-xl text-white mt-2"
                style={{ background: "var(--gradient-primary)" }}>
                Перейти на PRO
              </Link>
            )}
          </div>
          <div className="border-t px-4 flex items-center justify-between"
            style={{ borderColor: "var(--brown-pale)", paddingTop: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <div className="flex items-center gap-3">
              <SupportChatButton dropUp alignLeft />
              <span className="text-sm" style={{ color: "var(--brown-mid)" }}>{tutorName}</span>
            </div>
            <button onClick={handleSignOut}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
              Выйти
            </button>
          </div>
        </div>
      )}
    </>
  );
}
