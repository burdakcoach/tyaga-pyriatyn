import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, homeOrders } from "@/lib/db";

export async function GET() {
  const rows = db.select().from(homeOrders).all();
  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ homeOrders: rows });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Потрібні id і status" }, { status: 400 });
  }
  db.update(homeOrders).set({ status: body.status }).where(eq(homeOrders.id, body.id)).run();
  return NextResponse.json({ ok: true });
}
