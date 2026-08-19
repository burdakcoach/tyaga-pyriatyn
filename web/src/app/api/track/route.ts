import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db, siteVisits, cuid } from "@/lib/db";
import { kyivDay, kyivMonth } from "@/lib/day";

// Лічильник відвідувачів сайту. Викликається один раз при завантаженні
// сторінки з <VisitTracker />.
//
// Приватність: IP-адреса ніде не зберігається. З неї, User-Agent, дати й
// секретної солі рахується SHA-256, і в базу лягає тільки цей хеш. Оскільки
// дата входить у хеш, завтра та сама людина отримає інший — зв'язати візити
// між днями або відновити з хешу IP неможливо.

const BOT_UA =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|preview|monitor|uptime|curl|wget|headless|lighthouse|pingdom|semrush|ahrefs/i;

// period — це або день (YYYY-MM-DD), або місяць (YYYY-MM). Той самий відвідувач
// дає стабільний хеш у межах періоду і новий, щойно період змінюється.
function fingerprint(request: NextRequest, period: string) {
  // За проксі Railway справжній IP приходить у x-forwarded-for.
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  const ua = request.headers.get("user-agent") || "";
  const salt = process.env.ANALYTICS_SALT || "tyaga-pyriatyn";
  return createHash("sha256").update(`${salt}|${period}|${ip}|${ua}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";
  // Пошукових роботів і моніторинг не рахуємо — інакше цифра показувала б
  // не людей, а звернення Google і пінгів Railway.
  if (!ua || BOT_UA.test(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  const body = await request.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path.slice(0, 200) : null;

  // Свої ж заходи в адмінку не рахуємо як відвідування сайту.
  if (path && path.startsWith("/admin")) {
    return new NextResponse(null, { status: 204 });
  }

  const day = kyivDay();
  const month = kyivMonth();

  db.insert(siteVisits)
    .values({
      id: cuid("visit"),
      day,
      visitorHash: fingerprint(request, day),
      monthHash: fingerprint(request, month),
      firstPath: path,
      createdAt: new Date().toISOString(),
    })
    // Той самий відвідувач того самого дня — рядок уже є, нічого не робимо.
    .onConflictDoNothing()
    .run();

  return new NextResponse(null, { status: 204 });
}
