const DAY_LABELS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

export function isoDate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Next `count` days starting today, as { iso, label } pairs for quick-pick buttons. */
export function upcomingDays(count = 6): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    const dayLabel = i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : `${DAY_LABELS[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ iso, label: dayLabel });
  }
  return out;
}

export const TIME_SLOTS = [
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00",
];
