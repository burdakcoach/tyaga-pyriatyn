import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, pickupOrders, orderItems, flavors, cuid } from "@/lib/db";

type OrderBody = {
  customerName: string;
  phone: string;
  pickupDate: string;
  pickupTime: string;
  coalType?: "COCONUT" | "QUICKLIGHT" | "NONE";
  comment?: string;
  items: { flavorId: string; weightGrams?: number }[];
  telegramUserId?: string;
  telegramUsername?: string;
};

export async function POST(request: NextRequest) {
  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невалідний запит" }, { status: 400 });
  }

  const { customerName, phone, pickupDate, pickupTime, items } = body;

  if (!customerName?.trim() || !phone?.trim() || !pickupDate || !pickupTime || !items?.length) {
    return NextResponse.json(
      { error: "Заповніть ім'я, телефон, час самовивозу і оберіть хоча б один смак" },
      { status: 400 }
    );
  }
  if (items.length > 4) {
    return NextResponse.json({ error: "Максимум 4 смаки в одній забивці" }, { status: 400 });
  }

  const flavorIds = items.map((i) => i.flavorId);
  const foundFlavors = db.select().from(flavors).where(inArray(flavors.id, flavorIds)).all();
  if (foundFlavors.length !== new Set(flavorIds).size) {
    return NextResponse.json({ error: "Один із обраних смаків недоступний" }, { status: 400 });
  }

  const orderId = cuid("order");
  db.insert(pickupOrders)
    .values({
      id: orderId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      pickupDate,
      pickupTime,
      coalType: body.coalType || "COCONUT",
      comment: body.comment?.trim() || null,
      telegramUserId: body.telegramUserId || null,
      telegramUsername: body.telegramUsername || null,
      status: "PENDING",
    })
    .run();

  for (const item of items) {
    db.insert(orderItems)
      .values({
        id: cuid("item"),
        orderId,
        flavorId: item.flavorId,
        weightGrams: item.weightGrams || 25,
      })
      .run();
  }

  const created = db.select().from(pickupOrders).where(eq(pickupOrders.id, orderId)).get();
  return NextResponse.json({ order: created }, { status: 201 });
}
