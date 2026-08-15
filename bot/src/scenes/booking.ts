import { Scenes, Markup } from "telegraf";
import { eq, and, ne } from "drizzle-orm";
import { db, zones, tableSpots, bookings, checks, cuid } from "@tyaga/db";
import { upcomingDays, TIME_SLOTS } from "../lib/dates.js";
import { ADMIN_CHAT_ID } from "../env.js";

const cancelRow = [Markup.button.callback("❌ Скасувати", "bk:cancel")];

export const bookingWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "booking",

  // Step 0 — ask guests count
  async (ctx) => {
    await ctx.reply(
      "Бронювання столика 🍽\n\nНа скільки гостей? Напишіть число (1–12).",
      Markup.inlineKeyboard([cancelRow])
    );
    return ctx.wizard.next();
  },

  // Step 1 — receive guests, show zones
  async (ctx) => {
    const text = "text" in (ctx.message || {}) ? (ctx.message as any).text?.trim() : null;
    const guests = text ? parseInt(text, 10) : NaN;
    if (!guests || guests < 1 || guests > 12) {
      await ctx.reply("Введіть, будь ласка, число гостей від 1 до 12.");
      return; // stay on this step
    }
    (ctx.wizard.state as any).guests = guests;

    const zoneRows = db.select().from(zones).all().sort((a, b) => a.sortOrder - b.sortOrder);
    const buttons = zoneRows.map((z) => [Markup.button.callback(z.name, `bk:zone:${z.id}`)]);
    buttons.push(cancelRow);
    await ctx.reply("Оберіть зону:", Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 2 — receive zone, show dates
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "bk:cancel") return cancelBooking(ctx);
    const match = cb.match(/^bk:zone:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    const zoneId = match[1];
    const zone = db.select().from(zones).where(eq(zones.id, zoneId)).get();
    (ctx.wizard.state as any).zoneId = zoneId;
    (ctx.wizard.state as any).zoneName = zone?.name;

    const days = upcomingDays(6);
    const buttons = days.map((d) => [Markup.button.callback(d.label, `bk:date:${d.iso}`)]);
    buttons.push(cancelRow);
    await ctx.editMessageText(`Зона: ${zone?.name}\nОберіть дату:`, Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 3 — receive date, show time slots
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "bk:cancel") return cancelBooking(ctx);
    const match = cb.match(/^bk:date:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    const date = match[1];
    (ctx.wizard.state as any).date = date;

    const buttons: any[] = [];
    for (let i = 0; i < TIME_SLOTS.length; i += 3) {
      buttons.push(
        TIME_SLOTS.slice(i, i + 3).map((t) => Markup.button.callback(t, `bk:time:${t}`))
      );
    }
    buttons.push(cancelRow);
    await ctx.editMessageText(`Дата: ${date}\nОберіть час:`, Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 4 — receive time, show available tables
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "bk:cancel") return cancelBooking(ctx);
    const match = cb.match(/^bk:time:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    const time = match[1];
    (ctx.wizard.state as any).time = time;

    const state = ctx.wizard.state as any;
    const allTables = db
      .select()
      .from(tableSpots)
      .where(and(eq(tableSpots.zoneId, state.zoneId), eq(tableSpots.active, true)))
      .all();
    const existing = db
      .select({ tableSpotId: bookings.tableSpotId })
      .from(bookings)
      .where(and(eq(bookings.date, state.date), eq(bookings.timeSlot, time), ne(bookings.status, "CANCELLED")))
      .all();
    const bookedIds = new Set(existing.map((e) => e.tableSpotId));
    // Столики з відкритим чеком — там просто зараз сидять гості.
    const occupiedIds = new Set(
      db
        .select({ tableSpotId: checks.tableSpotId })
        .from(checks)
        .where(eq(checks.status, "OPEN"))
        .all()
        .map((c) => c.tableSpotId)
    );
    const available = allTables
      .filter((t) => !bookedIds.has(t.id) && !occupiedIds.has(t.id) && t.capacity >= state.guests)
      .sort((a, b) => a.number - b.number);

    if (available.length === 0) {
      const smokyCount = allTables.filter((t) => occupiedIds.has(t.id)).length;
      await ctx.editMessageText(
        `На жаль, у зоні «${state.zoneName}» немає вільних столиків на ${state.guests} гостей о ${time} ${state.date}.` +
          (smokyCount ? `\n\nЧастина місць зайнята просто зараз — там вже димно 🙂` : "") +
          `\n\nСпробуйте інший час або зону — /start`,
        Markup.inlineKeyboard([cancelRow])
      );
      return ctx.scene.leave();
    }

    const buttons = available.map((t) => [
      Markup.button.callback(`№${t.number} · до ${t.capacity} гостей`, `bk:table:${t.id}`),
    ]);
    buttons.push(cancelRow);
    await ctx.editMessageText(`Час: ${time}\nВільні столики:`, Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 5 — receive table, ask name
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "bk:cancel") return cancelBooking(ctx);
    const match = cb.match(/^bk:table:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    const table = db.select().from(tableSpots).where(eq(tableSpots.id, match[1])).get();
    (ctx.wizard.state as any).tableId = table?.id;
    (ctx.wizard.state as any).tableNumber = table?.number;

    await ctx.editMessageText(`Столик №${table?.number}\n\nЯк вас звати?`);
    return ctx.wizard.next();
  },

  // Step 6 — receive name, ask phone
  async (ctx) => {
    const text = "text" in (ctx.message || {}) ? (ctx.message as any).text?.trim() : null;
    if (!text) {
      await ctx.reply("Напишіть, будь ласка, ваше ім'я.");
      return;
    }
    (ctx.wizard.state as any).name = text;
    await ctx.reply(
      "Ваш номер телефону? Можете написати або поділитись контактом.",
      Markup.keyboard([Markup.button.contactRequest("📱 Поділитись номером")])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Step 7 — receive phone, show summary
  async (ctx) => {
    const contact = (ctx.message as any)?.contact;
    const text = "text" in (ctx.message || {}) ? (ctx.message as any).text?.trim() : null;
    const phone = contact?.phone_number || text;
    if (!phone) {
      await ctx.reply("Напишіть, будь ласка, номер телефону.");
      return;
    }
    (ctx.wizard.state as any).phone = phone;

    const s = ctx.wizard.state as any;
    await ctx.reply(
      `Перевірте бронювання:\n\n` +
        `Зона: ${s.zoneName}\n` +
        `Столик: №${s.tableNumber}\n` +
        `Дата: ${s.date} о ${s.time}\n` +
        `Гостей: ${s.guests}\n` +
        `Ім'я: ${s.name}\n` +
        `Телефон: ${phone}`,
      {
        ...Markup.removeKeyboard(),
      }
    );
    await ctx.reply(
      "Все вірно?",
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Підтвердити", "bk:confirm")],
        cancelRow,
      ])
    );
    return ctx.wizard.next();
  },

  // Step 8 — confirm and save
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) return;
    if (cb === "bk:cancel") return cancelBooking(ctx);
    if (cb !== "bk:confirm") return;
    await ctx.answerCbQuery();

    const s = ctx.wizard.state as any;
    // Поки гість заповнював ім'я й телефон, адмін міг посадити когось за цей
    // столик — перевіряємо ще раз перед записом.
    const openCheck = db
      .select()
      .from(checks)
      .where(and(eq(checks.tableSpotId, s.tableId), eq(checks.status, "OPEN")))
      .get();
    if (openCheck) {
      await ctx.editMessageText(
        "Тут вже димно 🙂 Цей столик щойно зайняли. Оберіть інший — /start"
      );
      return ctx.scene.leave();
    }

    const clash = db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tableSpotId, s.tableId),
          eq(bookings.date, s.date),
          eq(bookings.timeSlot, s.time),
          ne(bookings.status, "CANCELLED")
        )
      )
      .get();
    if (clash) {
      await ctx.editMessageText("На жаль, цей столик щойно забронювали. Спробуйте ще раз — /start");
      return ctx.scene.leave();
    }

    const id = cuid("booking");
    db.insert(bookings)
      .values({
        id,
        tableSpotId: s.tableId,
        customerName: s.name,
        phone: s.phone,
        telegramUserId: String(ctx.from?.id || ""),
        telegramUsername: ctx.from?.username || null,
        date: s.date,
        timeSlot: s.time,
        guests: s.guests,
        status: "PENDING",
      })
      .run();

    await ctx.editMessageText(
      "✅ Столик заброньовано! Ми зв'яжемось для підтвердження.\n\nДо зустрічі в Tyaga Pyriatyn 🍃"
    );

    if (ADMIN_CHAT_ID) {
      await ctx.telegram
        .sendMessage(
          ADMIN_CHAT_ID,
          `🆕 Нова бронь\nСтолик: №${s.tableNumber} (${s.zoneName})\n${s.date} о ${s.time}\nГостей: ${s.guests}\nІм'я: ${s.name}\nТелефон: ${s.phone}`
        )
        .catch(() => {});
    }

    return ctx.scene.leave();
  }
);

async function cancelBooking(ctx: any) {
  await ctx.answerCbQuery?.();
  await ctx.editMessageText?.("Бронювання скасовано. Повернутись у меню — /start").catch(() => {});
  return ctx.scene.leave();
}
