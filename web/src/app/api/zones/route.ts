import { NextRequest, NextResponse } from "next/server";
import { eq, ne, and } from "drizzle-orm";
import { db, zones, tableSpots, bookings, checks } from "@/lib/db";

// Returns all zones with their tables. If `date` and `time` query params are
// given, each table also gets `isBooked` for that slot so the floor plan can
// grey out unavailable spots.
//
// `isOccupied` — на столику просто зараз відкритий чек, тобто там сидять гості.
// Віддаємо лише прапорець: ані сум, ані позицій чека гість не бачить.
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

  const occupiedTableIds = new Set(
    db
      .select({ tableSpotId: checks.tableSpotId })
      .from(checks)
      .where(eq(checks.status, "OPEN"))
      .all()
      .map((c) => c.tableSpotId)
  );

  const result = zoneRows.map((zone) => ({
    ...zone,
    tables: tableRows
      .filter((t) => t.zoneId === zone.id)
      .map((t) => ({
        ...t,
        isBooked: bookedTableIds.has(t.id),
        isOccupied: occupiedTableIds.has(t.id),
      }))
      .sort((a, b) => a.number - b.number),
  }));

  return NextResponse.json({ zones: result });
}
