import Link from "next/link";
import TKitLogo from "@/components/TKitLogo";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="diary-bg-fixed" />

      {/* Хедер */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b" style={{
        borderColor: "var(--brown-pale)",
        background: "rgba(253, 248, 240, 0.9)",
      }}>
        <TKitLogo size="md" />
        <div className="flex gap-3">
          <Link href="/student" className="px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Я ученик
          </Link>
          <Link href="/auth/login" className="px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
            Войти
          </Link>
          <Link href="/auth/register" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
            Попробовать бесплатно
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 max-w-2xl" style={{
          fontFamily: "var(--font-lora), Georgia, serif",
          color: "var(--brown-dark)",
        }}>
          Всё для репетитора — в одном месте
        </h1>

        <p className="text-lg mb-8 max-w-xl" style={{ color: "var(--brown-mid)" }}>
          Расписание, домашние задания, материалы и личный кабинет для каждого ученика.
          Без лишнего — только то, что нужно в работе.
        </p>

        <Link href="/auth/register"
          className="px-8 py-4 rounded-2xl text-lg font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}>
          Начать бесплатно
        </Link>

        <p className="mt-3 text-sm" style={{ color: "var(--brown-light)" }}>
          Бесплатно навсегда: расписание + домашние задания
        </p>

        {/* Тарифы */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-16 w-full max-w-2xl">
          {/* Free */}
          <div className="rounded-2xl p-6 border text-left" style={{
            background: "rgba(253, 248, 240, 0.9)",
            borderColor: "var(--brown-pale)",
            boxShadow: "var(--shadow-card)",
          }}>
            <div className="font-bold text-lg mb-1">Бесплатно</div>
            <div className="text-2xl font-bold mb-4">0 ₽</div>
            <ul className="space-y-2 text-sm" style={{ color: "var(--brown-mid)" }}>
              <li>✓ Расписание занятий</li>
              <li>✓ Домашние задания</li>
              <li>✓ Материалы и файлы</li>
              <li>✓ Личный кабинет для каждого ученика</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-6 border text-left relative overflow-hidden" style={{
            background: "var(--gradient-primary)",
            borderColor: "transparent",
            boxShadow: "var(--shadow-button)",
            color: "white",
          }}>
            <div className="font-bold text-lg mb-1 opacity-90">PRO</div>
            <div className="text-2xl font-bold mb-4">490 ₽/мес</div>
            <ul className="space-y-2 text-sm opacity-90">
              <li>✓ Всё из бесплатного</li>
              <li>✓ Интерактивная доска</li>
              <li>✓ Тренажёр слов</li>
              <li>✓ Справочник / грамматика</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-sm" style={{ color: "var(--brown-light)" }}>
        T-Kit © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
