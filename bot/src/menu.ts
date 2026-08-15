import { Telegraf, Scenes, Markup } from "telegraf";
import { eq } from "drizzle-orm";
import { db, brands, flavors } from "@tyaga/db";
import { STRENGTH_LABEL, escapeHtml } from "./lib/format.js";

const PAGE_SIZE = 8;

export function registerMenuHandlers(bot: Telegraf<Scenes.WizardContext>) {
  bot.action("menu:brands", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const rows = db.select().from(brands).all().sort((a, b) => a.name.localeCompare(b.name));
      const buttons = rows.map((b) => [Markup.button.callback(b.name, `menu:brand:${b.id}:0`)]);
      buttons.push([Markup.button.callback("⬅️ Назад", "menu:home")]);
      await ctx.editMessageText("Оберіть бренд тютюну:", Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error("menu:brands failed:", err);
      await ctx.reply("Не вдалося завантажити список брендів. Спробуйте /menu ще раз.").catch(() => {});
    }
  });

  bot.action(/^menu:brand:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const brandId = ctx.match[1];
      const page = parseInt(ctx.match[2], 10);
      const brand = db.select().from(brands).where(eq(brands.id, brandId)).get();
      const items = db
        .select()
        .from(flavors)
        .where(eq(flavors.brandId, brandId))
        .all()
        .filter((f) => f.available)
        .sort((a, b) => a.name.localeCompare(b.name));

      const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
      const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      const buttons = pageItems.map((f) => [
        Markup.button.callback(
          `${f.strength ? STRENGTH_LABEL[f.strength].split(" ")[0] : "⚪"} ${f.name}`,
          `menu:flavor:${f.id}`
        ),
      ]);

      const nav = [];
      if (page > 0) nav.push(Markup.button.callback("⬅️", `menu:brand:${brandId}:${page - 1}`));
      nav.push(Markup.button.callback(`${page + 1}/${totalPages}`, "noop"));
      if (page < totalPages - 1) nav.push(Markup.button.callback("➡️", `menu:brand:${brandId}:${page + 1}`));
      buttons.push(nav);
      buttons.push([Markup.button.callback("⬅️ Усі бренди", "menu:brands")]);

      await ctx.editMessageText(
        `<b>${escapeHtml(brand?.name || "Бренд")}</b>\n${items.length} смаків`,
        { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) }
      );
    } catch (err) {
      console.error("menu:brand failed:", err);
      await ctx.reply("Не вдалося завантажити смаки цього бренду. Спробуйте /menu ще раз.").catch(() => {});
    }
  });

  bot.action(/^menu:flavor:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const id = ctx.match[1];
      const f = db.select().from(flavors).where(eq(flavors.id, id)).get();
      if (!f) {
        await ctx.reply("Цей смак більше недоступний. Спробуйте /menu ще раз.").catch(() => {});
        return;
      }
      const brand = f.brandId ? db.select().from(brands).where(eq(brands.id, f.brandId)).get() : null;

      const lines = [`<b>${escapeHtml(f.name)}</b>`];
      if (brand) lines.push(`Бренд: ${escapeHtml(brand.name)}`);
      if (f.strength) lines.push(`Міцність: ${STRENGTH_LABEL[f.strength]}`);
      if (f.description) lines.push(`\n${escapeHtml(f.description)}`);
      if (f.weightGrams) lines.push(`\nВага: ${f.weightGrams} г`);

      await ctx.editMessageText(lines.join("\n"), {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📦 Замовити на самовивіз", `ord:quick:${f.id}`)],
          [Markup.button.callback("⬅️ Назад", `menu:brand:${f.brandId}:0`)],
          [Markup.button.callback("🏠 Головне меню", "menu:home")],
        ]),
      });
    } catch (err) {
      console.error("menu:flavor failed:", err);
      await ctx.reply("Не вдалося відкрити цей смак. Спробуйте /menu ще раз.").catch(() => {});
    }
  });

  bot.action("noop", async (ctx) => ctx.answerCbQuery().catch(() => {}));
}
