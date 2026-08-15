import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, homeOrders, cuid } from "@/lib/db";
import { notifyAdmin, escapeHtml } from "@/lib/telegram";

type HomeOrderBody = {
  customerName: string;
  phone: string;
  address: string;
  eventDate: string;
  eventTime: string;
  guests?: number;
  comment?: string;
  telegramUserId?: string;
  telegramUsername?: string;
};

export async function POST(request: NextRequest) {
  let body: HomeOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невалідний запит" }, { status: 400 });
  }

  const { customerName, phone, address, eventDate, eventTime } = body;

  if (!customerName?.trim() || !phone?.trim() || !address?.trim() || !eventDate || !eventTime) {
    return NextResponse.json(
      { error: "Заповніть ім'я, телефон, адресу та бажані дату й час" },
      { status: 400 }
    );
  }

  const id = cuid("home");
  db.insert(homeOrders)
    .values({
      id,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      eventDate,
      eventTime,
      guests: body.guests || null,
      comment: body.comment?.trim() || null,
      telegramUserId: body.telegramUserId || null,
      telegramUsername: body.telegramUsername || null,
      status: "PENDING",
    })
    .run();

  const created = db.select().from(homeOrders).where(eq(homeOrders.id, id)).get();

  await notifyAdmin(
    `🆕 <b>Заявка "Кальян додому"</b> (сайт)\n` +
      `Адреса: ${escapeHtml(address.trim())}\n` +
      `Дата: ${escapeHtml(eventDate)} о ${escapeHtml(eventTime)}\n` +
      (body.guests ? `Гостей: ${body.guests}\n` : "") +
      `Ім'я: ${escapeHtml(customerName.trim())}\n` +
      `Телефон: ${escapeHtml(phone.trim())}` +
      (body.comment?.trim() ? `\nКоментар: ${escapeHtml(body.comment.trim())}` : "")
  );

  return NextResponse.json({ order: created }, { status: 201 });
}
