"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navLinks = [
  { href: "/tutor/dashboard", label: "Главная" },
  { href: "/tutor/students", label: "Ученики" },
  { href: "/tutor/schedule", label: "Расписание" },
  { href: "/tutor/homework", label: "Домашние задания" },
  { href: "/tutor/materials", label: "Материалы" },
  { href: "/tutor/reference", label: "Справочник", proOnly: true },
  { href: "/tutor/vocabulary", label: "Словарь", proOnly: true },
];

export default function TutorNav({
  tutorName,
  isPro,
}: {
  tutorName: string;
  isPro: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <nav className="sticky top-0 z-50 border-b px-4 py-3" style={{
      background: "rgba(253, 248, 240, 0.95)",
      borderColor: "var(--brown-pale)",
      boxShadow: "var(--shadow-nav)",
      backdropFilter: "blur(8px)",
    }}>
      <div className="max-w-5xl mx-auto flex items-center gap-4 flex-wrap">
        <span className="font-bold text-lg mr-4" style={{
          fontFamily: "var(--font-lora), Georgia, serif",
          color: "var(--brown-dark)",
        }}>
          T-Kit
        </span>

        {navLinks.map(link => {
          if (link.proOnly && !isPro) return null;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium px-3 py-1 rounded-lg transition-all"
              style={{
                color: active ? "var(--brown-dark)" : "var(--brown-mid)",
                background: active ? "var(--brown-pale)" : "transparent",
              }}
            >
              {link.label}
            </Link>
          );
        })}

        {!isPro && (
          <Link
            href="/tutor/subscription"
            className="text-xs font-semibold px-3 py-1 rounded-full ml-auto"
            style={{
              background: "var(--gradient-primary)",
              color: "white",
            }}
          >
            PRO
          </Link>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm" style={{ color: "var(--brown-mid)" }}>{tutorName}</span>
          <button
            onClick={handleSignOut}
            className="text-sm px-3 py-1 rounded-lg border transition-all hover:opacity-70"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
          >
            Выйти
          </button>
        </div>
      </div>
    </nav>
  );
}
