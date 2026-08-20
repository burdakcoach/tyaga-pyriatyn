import { NextResponse } from "next/server";
import { eq, like, sql } from "drizzle-orm";
import { db, siteVisits } from "@/lib/db";
import { kyivDay, kyivMonth } from "@/lib/day";
import { guarded } from "@/lib/api";

// Відвідуваність сайту для адмінки. Рахуємо рядки в site_visits: там уже
// один рядок на людину за день, тож окремий distinct не потрібен для «сьогодні».
// Для місяця беремо distinct за хешем — щоб постійний гість, який заходить
// щодня, не рахувався тридцять разів.
export async function GET() {
  return guarded("відвідувачі", () => {
  const today = kyivDay();
  const month = kyivMonth();

  const todayRow = db
    .select({ n: sql<number>`count(*)` })
    .from(siteVisits)
    .where(eq(siteVisits.day, today))
    .get();

  const monthVisitsRow = db
    .select({ n: sql<number>`count(*)` })
    .from(siteVisits)
    .where(like(siteVisits.day, `${month}-%`))
    .get();

  // Саме monthHash, а не visitorHash: останній містить дату, тож постійний
  // гість мав би різні хеші щодня і рахувався б по разу за кожен візит.
  const monthPeopleRow = db
    .select({ n: sql<number>`count(distinct ${siteVisits.monthHash})` })
    .from(siteVisits)
    .where(like(siteVisits.day, `${month}-%`))
    .get();

  return {
    today: todayRow?.n ?? 0,
    // Скільки різних людей за місяць.
    month: monthPeopleRow?.n ?? 0,
    // Скільки разом візитів за місяць (людина, що приходила 5 днів, дасть 5).
    monthVisits: monthVisitsRow?.n ?? 0,
    day: today,
  };
  });
}
