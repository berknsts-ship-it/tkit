export function localToUTC(date: string, time: string, tz: string): string {
  const utcNaive = new Date(`${date}T${time}:00Z`);
  const tzStr = utcNaive.toLocaleString("sv-SE", { timeZone: tz });
  const tzDate = new Date(tzStr.replace(" ", "T") + "Z");
  const offset = utcNaive.getTime() - tzDate.getTime();
  return new Date(utcNaive.getTime() + offset).toISOString();
}

// Returns UTC ISO string of the next occurrence of a weekly recurrence.
// days: [1,3,5] = Mon, Wed, Fri (JS: 0=Sun … 6=Sat)
export function nextOccurrenceUTC(days: number[], time: string, tz: string): string {
  const now = new Date();
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const dateStr = candidate.toLocaleDateString("sv-SE", { timeZone: tz });
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(y, mo - 1, d).getDay();
    if (days.includes(dayOfWeek)) {
      const utcTime = localToUTC(dateStr, time, tz);
      if (new Date(utcTime) > now) return utcTime;
    }
  }
  const fb = new Date(now);
  fb.setDate(now.getDate() + 7);
  return fb.toISOString();
}
