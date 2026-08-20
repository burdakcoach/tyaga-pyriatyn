import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, products, cuid } from "@/lib/db";
import { guarded } from "@/lib/api";

// Прайс-лист. Роут живе під /api/admin/*, тому middleware.ts вимагає Basic Auth —
// ціни ніколи не віддаються анонімним відвідувачам сайту.

const CATEGORIES = ["DRINK", "BEER", "SNACK", "SERVICE", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

function parsePrice(value: unknown): number | null {
  // Приймаємо і 65, і "65", і "65,50" — кома як десятковий роздільник.
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function GET() {
  return guarded("прайс", () => {
  const rows = db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.name))
    .all();
  return { products: rows };
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = parsePrice(body?.price);

  if (!name) {
    return NextResponse.json({ error: "Вкажіть назву позиції" }, { status: 400 });
  }
  if (price === null) {
    return NextResponse.json({ error: "Ціна має бути невід'ємним числом" }, { status: 400 });
  }

  const category: Category = CATEGORIES.includes(body?.category) ? body.category : "OTHER";
  const unit = typeof body?.unit === "string" && body.unit.trim() ? body.unit.trim() : null;
  const costPrice = body?.costPrice === undefined ? null : parsePrice(body.costPrice);

  const id = cuid("prod");
  db.insert(products)
    .values({
      id,
      name,
      category,
      price,
      costPrice,
      unit,
      active: true,
      // Нові позиції — в кінець свого розділу.
      sortOrder: 900,
    })
    .run();

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "Потрібен id" }, { status: 400 });
  }

  const existing = db.select().from(products).where(eq(products.id, body.id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Позицію не знайдено" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Назва не може бути порожньою" }, { status: 400 });
    patch.name = name;
  }
  if (body.price !== undefined) {
    const price = parsePrice(body.price);
    if (price === null) {
      return NextResponse.json({ error: "Ціна має бути невід'ємним числом" }, { status: 400 });
    }
    patch.price = price;
  }
  if (body.costPrice !== undefined) {
    patch.costPrice = body.costPrice === null || body.costPrice === "" ? null : parsePrice(body.costPrice);
  }
  if (body.unit !== undefined) {
    patch.unit = String(body.unit).trim() || null;
  }
  if (body.category !== undefined && CATEGORIES.includes(body.category)) {
    patch.category = body.category;
  }
  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
  }

  db.update(products).set(patch).where(eq(products.id, body.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Потрібен id" }, { status: 400 });
  }
  db.delete(products).where(eq(products.id, id)).run();
  return NextResponse.json({ ok: true });
}
