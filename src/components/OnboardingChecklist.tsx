"use client";

import { useState } from "react";
import Link from "next/link";
import { dismissOnboarding } from "@/app/actions/onboarding";

interface Step {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export default function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  async function handleDismiss() {
    setLoading(true);
    setDismissed(true);
    await dismissOnboarding();
  }

  return (
    <div
      className="rounded-2xl border mb-6 overflow-hidden"
      style={{
        background: "white",
        borderColor: "var(--brown-pale)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 border-b flex items-center justify-between gap-3"
        style={{ borderColor: "var(--brown-pale)", background: "var(--cream)" }}
      >
        <div>
          <h2 className="font-semibold text-sm" style={{ color: "var(--brown-dark)" }}>
            {allDone ? "Готово! 🎉" : "Начните работу"}
          </h2>
          {!allDone && (
            <p className="text-xs mt-0.5" style={{ color: "var(--brown-light)" }}>
              {doneCount} из {steps.length} шагов выполнено
            </p>
          )}
        </div>
        {allDone && (
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:opacity-70 shrink-0"
            style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}
          >
            Скрыть
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="p-3 flex flex-col gap-1.5">
        {steps.map(step => (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:opacity-80"
            style={{ background: step.done ? "#f0fdf4" : "var(--brown-pale)" }}
          >
            {/* Checkbox */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2"
              style={{
                borderColor: step.done ? "#16a34a" : "var(--brown-light)",
                background: step.done ? "#16a34a" : "transparent",
              }}
            >
              {step.done && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            <span
              className="text-sm font-medium flex-1"
              style={{
                color: step.done ? "#15803d" : "var(--brown-dark)",
                textDecoration: step.done ? "line-through" : "none",
              }}
            >
              {step.label}
            </span>

            {!step.done && (
              <span className="text-xs shrink-0" style={{ color: "var(--brown-light)" }}>
                →
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
