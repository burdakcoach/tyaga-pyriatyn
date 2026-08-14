import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db, bookings, tableSpots, cuid } from "@/lib/db";

type BookingBody = {
  tableSpotId: string;
  customerName: string;
  phone: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:MM
  guests: number;
  comment?: string;
  telegramUserId?: string;
  telegramUsername?: string;
};

export async function POST(request: NextRequest) {
  let body: BookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невалідний запит" }, { status: 400 });
  }

  const { tableSpotId, customerName, phone, date, timeSlot, guests, comment } = body;

  if (!tableSpotId || !customerName?.trim() || !phone?.trim() || !date || !timeSlot || !guests) {
    return NextResponse.json({ error: "Заповніть усі обов'язкові поля" }, { status: 400 });
  }

  const table = db.select().from(tableSpots).where(eq(tableSpots.id, tableSpotId)).get();
  if (!table) {
    return NextResponse.json({ error: "Столик не знайдено" }, { status: 404 });
  }
  if (guests > table.capacity) {
    return NextResponse.json(
      { error: `Цей столик вміщує максимум ${table.capacity} гостей` },
      { status: 400 }
    );
  }

  const clash = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.tableSpotId, tableSpotId),
        eq(bookings.date, date),
        eq(bookings.timeSlot, timeSlot),
        ne(bookings.status, "CANCELLED")
      )
    )
    .get();
  if (clash) {
    return NextResponse.json({ error: "Цей столик на обраний час вже заброньовано" }, { status: 409 });
  }

  const id = cuid("booking");
  db.insert(bookings)
    .values({
      id,
      tableSpotId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      date,
      timeSlot,
      guests,
      comment: comment?.trim() || null,
      telegramUserId: body.telegramUserId || null,
      telegramUsername: body.telegramUsername || null,
      status: "PENDING",
    })
    .run();

  const created = db.select().from(bookings).where(eq(bookings.id, id)).get();
  return NextResponse.json({ booking: created }, { status: 201 });
}
