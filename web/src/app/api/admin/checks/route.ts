import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, checks, checkItems, products, tableSpots, zones, cuid } from "@/lib/db";

// Чеки за столиками. Роут під /api/admin/*, отже за Basic Auth (middleware.ts).
// Гості цих даних не бачать — публічні роути дізнаються лише сам факт
// «столик зайнятий», без сум і позицій.

type ItemRow = {
  id: string;
  checkId: string;
  productId: string | null;
  name: string;
  price: number;
  qty: number;
};

function sumItems(items: ItemRow[]) {
  return Math.round(items.reduce((acc, i) => acc + i.price * i.qty, 0) * 100) / 100;
}

export async function GET() {
  const checkRows = db.select().from(checks).all();
  const itemRows = db.select().from(checkItems).all() as ItemRow[];
  const tableRows = db.select().from(tableSpots).all();
  const zoneRows = db.select().from(zones).all();

  const zoneById = new Map(zoneRows.map((z) => [z.id, z]));
  const tableById = new Map(tableRows.map((t) => [t.id, t]));

  const itemsByCheck = new Map<string, ItemRow[]>();
  for (const it of itemRows) {
    if (!itemsByCheck.has(it.checkId)) itemsByCheck.set(it.checkId, []);
    itemsByCheck.get(it.checkId)!.push(it);
  }

  const decorated = checkRows.map((c) => {
    const items = itemsByCheck.get(c.id) || [];
    const table = tableById.get(c.tableSpotId);
    const zone = table ? zoneById.get(table.zoneId) : undefined;
    return {
      ...c,
      // Для відкритого чека сума жива, для закритого — та, що зафіксована.
      total: c.status === "OPEN" ? sumItems(items) : c.total,
      tableNumber: table?.number ?? null,
      zoneName: zone?.name ?? null,
      items,
    };
  });

  const open = decorated
    .filter((c) => c.status === "OPEN")
    .sort((a, b) => (a.openedAt || "").localeCompare(b.openedAt || ""));

  const closed = decorated
    .filter((c) => c.status === "CLOSED")
    .sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || ""));

  return NextResponse.json({ open, closed });
}

// Відкрити чек на столик.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const tableSpotId = body?.tableSpotId;
  if (!tableSpotId) {
    return NextResponse.json({ error: "Потрібен tableSpotId" }, { status: 400 });
  }

  const table = db.select().from(tableSpots).where(eq(tableSpots.id, tableSpotId)).get();
  if (!table) {
    return NextResponse.json({ error: "Столик не знайдено" }, { status: 404 });
  }

  const alreadyOpen = db
    .select()
    .from(checks)
    .where(and(eq(checks.tableSpotId, tableSpotId), eq(checks.status, "OPEN")))
    .get();
  if (alreadyOpen) {
    return NextResponse.json({ error: "На цьому столику вже є відкритий чек", id: alreadyOpen.id }, { status: 409 });
  }

  const id = cuid("check");
  db.insert(checks)
    .values({
      id,
      tableSpotId,
      status: "OPEN",
      guests: typeof body?.guests === "number" ? body.guests : null,
      // Ставимо час явно в ISO з часовим поясом. Дефолт SQLite (current_timestamp)
      // пише UTC без позначки, і браузер потім показував би час на 3 години назад.
      openedAt: new Date().toISOString(),
    })
    .run();

  return NextResponse.json({ ok: true, id }, { status: 201 });
}

// Дії над відкритим чеком: додати/прибрати позицію, закрити.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const checkId = body?.checkId;
  const action = body?.action;

  if (!checkId || !action) {
    return NextResponse.json({ error: "Потрібні checkId і action" }, { status: 400 });
  }

  const check = db.select().from(checks).where(eq(checks.id, checkId)).get();
  if (!check) {
    return NextResponse.json({ error: "Чек не знайдено" }, { status: 404 });
  }
  if (check.status === "CLOSED") {
    return NextResponse.json({ error: "Чек уже закрито" }, { status: 409 });
  }

  if (action === "add") {
    const product = db.select().from(products).where(eq(products.id, body.productId)).get();
    if (!product) {
      return NextResponse.json({ error: "Позицію не знайдено в прайсі" }, { status: 404 });
    }
    // Якщо така сама позиція вже в чеку — просто збільшуємо кількість,
    // щоб рахунок не перетворювався на довгий список однакових рядків.
    const existing = db
      .select()
      .from(checkItems)
      .where(and(eq(checkItems.checkId, checkId), eq(checkItems.productId, product.id)))
      .get();
    if (existing) {
      db.update(checkItems)
        .set({ qty: existing.qty + 1 })
        .where(eq(checkItems.id, existing.id))
        .run();
    } else {
      db.insert(checkItems)
        .values({
          id: cuid("citem"),
          checkId,
          productId: product.id,
          name: product.unit ? `${product.name} (${product.unit})` : product.name,
          price: product.price,
          qty: 1,
        })
        .run();
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    const item = db.select().from(checkItems).where(eq(checkItems.id, body.itemId)).get();
    if (!item || item.checkId !== checkId) {
      return NextResponse.json({ error: "Рядок не знайдено" }, { status: 404 });
    }
    if (item.qty > 1) {
      db.update(checkItems)
        .set({ qty: item.qty - 1 })
        .where(eq(checkItems.id, item.id))
        .run();
    } else {
      db.delete(checkItems).where(eq(checkItems.id, item.id)).run();
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "close") {
    const items = db.select().from(checkItems).where(eq(checkItems.checkId, checkId)).all() as ItemRow[];
    db.update(checks)
      .set({
        status: "CLOSED",
        total: sumItems(items),
        closedAt: new Date().toISOString(),
        comment: typeof body?.comment === "string" ? body.comment.trim() || null : check.comment,
      })
      .where(eq(checks.id, checkId))
      .run();
    return NextResponse.json({ ok: true });
  }

  if (action === "setGuests") {
    const guests = Number(body?.guests);
    db.update(checks)
      .set({ guests: Number.isFinite(guests) && guests > 0 ? guests : null })
      .where(eq(checks.id, checkId))
      .run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Невідома дія" }, { status: 400 });
}

// Скасувати помилково відкритий чек. Закриті чеки не видаляємо — це історія
// виторгу, вона має лишатись цілою.
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Потрібен id" }, { status: 400 });
  }
  const check = db.select().from(checks).where(eq(checks.id, id)).get();
  if (!check) {
    return NextResponse.json({ error: "Чек не знайдено" }, { status: 404 });
  }
  if (check.status === "CLOSED") {
    return NextResponse.json({ error: "Закритий чек видалити не можна" }, { status: 409 });
  }
  db.delete(checkItems).where(eq(checkItems.checkId, id)).run();
  db.delete(checks).where(eq(checks.id, id)).run();
  return NextResponse.json({ ok: true });
}
