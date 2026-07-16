"use client";

import { useState } from "react";
import { markWelcomeShown } from "@/app/actions/onboarding";

export default function WelcomeModal({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  if (!visible) return null;

  async function handleClose() {
    setVisible(false);
    await markWelcomeShown();
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(59, 42, 26, 0.45)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border overflow-hidden"
        style={{
          background: "var(--cream)",
          borderColor: "var(--brown-pale)",
          boxShadow: "0 16px 56px rgba(59, 42, 26, 0.20)",
        }}
      >
        <div className="px-6 pt-6 pb-4" style={{ background: "var(--gradient-primary)" }}>
          <div className="text-3xl mb-2">👋</div>
          <h2 className="text-xl font-bold text-white">Добро пожаловать в T-Kit!</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm mb-2" style={{ color: "var(--brown-dark)" }}>
            Мы создали демо-ученика <strong>Марию</strong>, чтобы вы могли осмотреться — расписание, домашние задания и словарь уже заполнены для примера.
          </p>
          <p className="text-sm mb-5" style={{ color: "var(--brown-mid)" }}>
            Когда будете готовы начать — следуйте чеклисту ниже.
          </p>
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-button)" }}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
