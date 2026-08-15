import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pickupOrders, orderItems, flavors } from "@/lib/db";

export async function GET() {
  const orders = db.select().from(pickupOrders).all();
  const items = db
    .select({
      orderId: orderItems.orderId,
      flavorId: orderItems.flavorId,
      weightGrams: orderItems.weightGrams,
      flavorName: flavors.name,
    })
    .from(orderItems)
    .leftJoin(flavors, eq(orderItems.flavorId, flavors.id))
    .all();

  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
    itemsByOrder.get(it.orderId)!.push(it);
  }

  const result = orders
    .map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return NextResponse.json({ orders: result });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Потрібні id і status" }, { status: 400 });
  }
  db.update(pickupOrders).set({ status: body.status }).where(eq(pickupOrders.id, body.id)).run();
  return NextResponse.json({ ok: true });
}
