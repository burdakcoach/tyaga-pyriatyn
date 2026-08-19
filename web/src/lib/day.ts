// Заклад живе за київським часом, а сервер Railway — за UTC. Якщо рахувати
// «сьогодні» по UTC, то з 00:00 до 03:00 за Києвом відвідувачі падали б у
// вчорашній день — тобто найактивніші години лаунжу опинялись би не в тій добі.
const KYIV = "Europe/Kyiv";

// sv-SE навмисно: цей формат дає рівно YYYY-MM-DD.
const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: KYIV,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Поточна дата в Пирятині у форматі YYYY-MM-DD. */
export function kyivDay(date = new Date()): string {
  return dayFormatter.format(date);
}

/** Поточний місяць у форматі YYYY-MM. */
export function kyivMonth(date = new Date()): string {
  return kyivDay(date).slice(0, 7);
}
