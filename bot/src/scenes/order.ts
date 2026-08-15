import { Scenes, Markup } from "telegraf";
import { eq, inArray } from "drizzle-orm";
import { db, flavors, brands, pickupOrders, orderItems, cuid } from "@tyaga/db";
import { upcomingDays, TIME_SLOTS } from "../lib/dates.js";
import { COAL_LABEL } from "../lib/format.js";
import { ADMIN_CHAT_ID } from "../env.js";

const PAGE_SIZE = 6;
const MAX_MIX = 4;
const cancelRow = [Markup.button.callback("❌ Скасувати", "ord:cancel")];

function flavorListSorted() {
  const rows = db
    .select({ id: flavors.id, name: flavors.name, brandName: brands.name })
    .from(flavors)
    .leftJoin(brands, eq(flavors.brandId, brands.id))
    .all()
    .filter((f) => true);
  return rows.sort((a, b) => (a.brandName || "").localeCompare(b.brandName || "") || a.name.localeCompare(b.name));
}

function renderFlavorPage(page: number, selected: string[]) {
  const all = flavorListSorted();
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const items = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const buttons = items.map((f) => [
    Markup.button.callback(
      `${selected.includes(f.id) ? "✅" : "▫️"} ${f.name} (${f.brandName})`,
      `ord:toggle:${f.id}:${page}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback("⬅️", `ord:page:${page - 1}`));
  nav.push(Markup.button.callback(`${page + 1}/${totalPages}`, "noop"));
  if (page < totalPages - 1) nav.push(Markup.button.callback("➡️", `ord:page:${page + 1}`));
  buttons.push(nav);

  buttons.push([Markup.button.callback(`✅ Готово (${selected.length}/${MAX_MIX})`, "ord:done")]);
  buttons.push(cancelRow);

  return { text: `Оберіть до ${MAX_MIX} смаків для міксу:`, markup: Markup.inlineKeyboard(buttons) };
}

export const orderWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "order",

  // Step 0 — enter, show flavor picker
  async (ctx) => {
    // Coming from "📦 Замовити на самовивіз" on a specific flavor card — pre-select it.
    const preselected = (ctx.scene.state as any)?.preselected as string | undefined;
    const selected = preselected ? [preselected] : [];
    (ctx.wizard.state as any).selected = selected;
    (ctx.wizard.state as any).page = 0;
    const { text, markup } = renderFlavorPage(0, selected);
    await ctx.reply(`Забивка на самовивіз 📦\n\n${text}`, markup);
    return ctx.wizard.next();
  },

  // Step 1 — handle toggling/paging/done
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "ord:cancel") return cancelOrder(ctx);
    if (cb === "noop") return ctx.answerCbQuery();

    const state = ctx.wizard.state as any;

    const pageMatch = cb.match(/^ord:page:(\d+)$/);
    if (pageMatch) {
      await ctx.answerCbQuery();
      state.page = parseInt(pageMatch[1], 10);
      const { text, markup } = renderFlavorPage(state.page, state.selected);
      await ctx.editMessageText(text, markup);
      return;
    }

    const toggleMatch = cb.match(/^ord:toggle:(.+):(\d+)$/);
    if (toggleMatch) {
      const id = toggleMatch[1];
      const page = parseInt(toggleMatch[2], 10);
      if (state.selected.includes(id)) {
        state.selected = state.selected.filter((x: string) => x !== id);
      } else if (state.selected.length < MAX_MIX) {
        state.selected.push(id);
      } else {
        await ctx.answerCbQuery(`Максимум ${MAX_MIX} смаки в міксі`);
        return;
      }
      await ctx.answerCbQuery();
      const { text, markup } = renderFlavorPage(page, state.selected);
      await ctx.editMessageText(text, markup);
      return;
    }

    if (cb === "ord:done") {
      if (state.selected.length === 0) {
        await ctx.answerCbQuery("Оберіть хоча б один смак");
        return;
      }
      await ctx.answerCbQuery();
      const buttons = Object.entries(COAL_LABEL).map(([k, v]) => [
        Markup.button.callback(v, `ord:coal:${k}`),
      ]);
      buttons.push(cancelRow);
      await ctx.editMessageText("Яке вугілля?", Markup.inlineKeyboard(buttons));
      return ctx.wizard.next();
    }
  },

  // Step 2 — receive coal, ask date
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "ord:cancel") return cancelOrder(ctx);
    const match = cb.match(/^ord:coal:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    (ctx.wizard.state as any).coalType = match[1];

    const days = upcomingDays(6);
    const buttons = days.map((d) => [Markup.button.callback(d.label, `ord:date:${d.iso}`)]);
    buttons.push(cancelRow);
    await ctx.editMessageText("Коли забрати замовлення?", Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 3 — receive date, ask time
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "ord:cancel") return cancelOrder(ctx);
    const match = cb.match(/^ord:date:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    (ctx.wizard.state as any).pickupDate = match[1];

    const buttons: any[] = [];
    for (let i = 0; i < TIME_SLOTS.length; i += 3) {
      buttons.push(TIME_SLOTS.slice(i, i + 3).map((t) => Markup.button.callback(t, `ord:time:${t}`)));
    }
    buttons.push(cancelRow);
    await ctx.editMessageText("О котрій годині?", Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },

  // Step 4 — receive time, ask name
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) {
      await ctx.reply("Скористайтесь кнопками вище 🙏");
      return;
    }
    if (cb === "ord:cancel") return cancelOrder(ctx);
    const match = cb.match(/^ord:time:(.+)$/);
    if (!match) return;
    await ctx.answerCbQuery();
    (ctx.wizard.state as any).pickupTime = match[1];

    await ctx.editMessageText("Як вас звати?");
    return ctx.wizard.next();
  },

  // Step 5 — receive name, ask phone
  async (ctx) => {
    const text = "text" in (ctx.message || {}) ? (ctx.message as any).text?.trim() : null;
    if (!text) {
      await ctx.reply("Напишіть, будь ласка, ваше ім'я.");
      return;
    }
    (ctx.wizard.state as any).name = text;
    await ctx.reply(
      "Номер телефону? Можете написати або поділитись контактом.",
      Markup.keyboard([Markup.button.contactRequest("📱 Поділитись номером")])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },

  // Step 6 — receive phone, show summary
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
    const chosen = db
      .select()
      .from(flavors)
      .where(inArray(flavors.id, s.selected))
      .all();

    await ctx.reply(
      `Перевірте замовлення:\n\n` +
        `Смаки: ${chosen.map((f) => f.name).join(", ")}\n` +
        `Вугілля: ${COAL_LABEL[s.coalType]}\n` +
        `Самовивіз: ${s.pickupDate} о ${s.pickupTime}\n` +
        `Ім'я: ${s.name}\n` +
        `Телефон: ${phone}`,
      { ...Markup.removeKeyboard() }
    );
    await ctx.reply(
      "Оформити замовлення?",
      Markup.inlineKeyboard([[Markup.button.callback("✅ Підтвердити", "ord:confirm")], cancelRow])
    );
    return ctx.wizard.next();
  },

  // Step 7 — confirm and save
  async (ctx) => {
    const cb = (ctx.callbackQuery as any)?.data as string | undefined;
    if (!cb) return;
    if (cb === "ord:cancel") return cancelOrder(ctx);
    if (cb !== "ord:confirm") return;
    await ctx.answerCbQuery();

    const s = ctx.wizard.state as any;
    const orderId = cuid("order");
    db.insert(pickupOrders)
      .values({
        id: orderId,
        customerName: s.name,
        phone: s.phone,
        telegramUserId: String(ctx.from?.id || ""),
        telegramUsername: ctx.from?.username || null,
        pickupDate: s.pickupDate,
        pickupTime: s.pickupTime,
        coalType: s.coalType,
        status: "PENDING",
      })
      .run();
    for (const flavorId of s.selected as string[]) {
      db.insert(orderItems).values({ id: cuid("item"), orderId, flavorId, weightGrams: 25 }).run();
    }

    await ctx.editMessageText("✅ Замовлення прийнято! Ми зателефонуємо для підтвердження.");

    if (ADMIN_CHAT_ID) {
      const chosen = db.select().from(flavors).where(inArray(flavors.id, s.selected)).all();
      await ctx.telegram
        .sendMessage(
          ADMIN_CHAT_ID,
          `🆕 Нове замовлення на самовивіз\nСмаки: ${chosen.map((f) => f.name).join(", ")}\nВугілля: ${COAL_LABEL[s.coalType]}\n${s.pickupDate} о ${s.pickupTime}\nІм'я: ${s.name}\nТелефон: ${s.phone}`
        )
        .catch(() => {});
    }

    return ctx.scene.leave();
  }
);

async function cancelOrder(ctx: any) {
  await ctx.answerCbQuery?.();
  await ctx.editMessageText?.("Замовлення скасовано. Повернутись у меню — /start").catch(() => {});
  return ctx.scene.leave();
}
