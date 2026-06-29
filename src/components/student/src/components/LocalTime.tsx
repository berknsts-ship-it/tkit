"use client";

// Naive datetime display — extracts time/date parts directly from the ISO string
// without any timezone conversion. "17:00" stored = "17:00" shown everywhere.

function pad(s: string) { return s.padStart(2, "0"); }

// "2026-06-28T17:00:00" or "2026-06-28T17:00:00+03:00" → "17:00"
function extractTime(iso: string): string {
  const t = iso.slice(11, 16);
  return t || iso;
}

// → day number as integer
function extractDay(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

// → short month in Russian using UTC to match the stored date
function extractMonth(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  const d = parseInt(iso.slice(8, 10), 10);
  return new Date(Date.UTC(y, m, d)).toLocaleDateString("ru", { month: "short", timeZone: "UTC" });
}

// → weekday in Russian using UTC
function extractWeekday(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  const d = parseInt(iso.slice(8, 10), 10);
  return new Date(Date.UTC(y, m, d)).toLocaleDateString("ru", { weekday: "long", timeZone: "UTC" });
}

export function LocalTime({ iso, format = "time" }: {
  iso: string;
  format?: "time" | "weekday";
}) {
  if (format === "weekday") return <>{extractWeekday(iso)}</>;
  return <>{extractTime(iso)}</>;
}

export function LocalDay({ iso }: { iso: string }) {
  return <>{extractDay(iso)}</>;
}

export function LocalMonth({ iso }: { iso: string }) {
  return <>{extractMonth(iso)}</>;
}
