import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, bookings, tableSpots, zones } from "@/lib/db";

export async function GET() {
  const rows = db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      phone: bookings.phone,
      date: bookings.date,
      timeSlot: bookings.timeSlot,
      guests: bookings.guests,
      comment: bookings.comment,
      status: bookings.status,
      createdAt: bookings.createdAt,
      tableNumber: tableSpots.number,
      zoneName: zones.name,
    })
    .from(bookings)
    .leftJoin(tableSpots, eq(bookings.tableSpotId, tableSpots.id))
    .leftJoin(zones, eq(tableSpots.zoneId, zones.id))
    .all();

  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ bookings: rows });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Потрібні id і status" }, { status: 400 });
  }
  db.update(bookings).set({ status: body.status }).where(eq(bookings.id, body.id)).run();
  return NextResponse.json({ ok: true });
}
