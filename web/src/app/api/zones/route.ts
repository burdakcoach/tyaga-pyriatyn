import { NextRequest, NextResponse } from "next/server";
import { eq, ne, and } from "drizzle-orm";
import { db, zones, tableSpots, bookings } from "@/lib/db";

// Returns all zones with their tables. If `date` and `time` query params are
// given, each table also gets `isBooked` for that slot so the floor plan can
// grey out unavailable spots.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  const zoneRows = db.select().from(zones).all();
  zoneRows.sort((a, b) => a.sortOrder - b.sortOrder);

  const tableRows = db.select().from(tableSpots).where(eq(tableSpots.active, true)).all();

  let bookedTableIds = new Set<string>();
  if (date && time) {
    const existing = db
      .select({ tableSpotId: bookings.tableSpotId })
      .from(bookings)
      .where(and(eq(bookings.date, date), eq(bookings.timeSlot, time), ne(bookings.status, "CANCELLED")))
      .all();
    bookedTableIds = new Set(existing.map((b) => b.tableSpotId));
  }

  const result = zoneRows.map((zone) => ({
    ...zone,
    tables: tableRows
      .filter((t) => t.zoneId === zone.id)
      .map((t) => ({ ...t, isBooked: bookedTableIds.has(t.id) }))
      .sort((a, b) => a.number - b.number),
  }));

  return NextResponse.json({ zones: result });
}
