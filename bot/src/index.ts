import { Telegraf, Scenes, session } from "telegraf";
import { BOT_TOKEN, WEBAPP_URL } from "./env.js";
import { mainMenuKeyboard } from "./keyboards/main.js";
import { registerMenuHandlers } from "./menu.js";
import { bookingWizard } from "./scenes/booking.js";
import { orderWizard } from "./scenes/order.js";
import { SITE_NAME, WORKING_HOURS, INSTAGRAM_URL } from "./lib/constants.js";

if (!BOT_TOKEN) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN. Create bot/.env from bot/.env.example and set it (get a token from @BotFather)."
  );
  process.exit(1);
}

const bot = new Telegraf<Scenes.WizardContext>(BOT_TOKEN);

const stage = new Scenes.Stage<Scenes.WizardContext>([bookingWizard, orderWizard]);

bot.use(session());
bot.use(stage.middleware());

const WELCOME = `Вітаємо в <b>${SITE_NAME}</b> 🍃\n\n${WORKING_HOURS}\n\nОберіть дію:`;

bot.start(async (ctx) => {
  // Logo as its own message (not a photo+caption combo) so every later screen
  // can keep using editMessageText on the WELCOME message below it.
  if (WEBAPP_URL) {
    await ctx.replyWithPhoto(`${WEBAPP_URL}/logo.png`).catch(() => {});
  }
  await ctx.reply(WELCOME, { parse_mode: "HTML", ...mainMenuKeyboard() });
});

bot.action("menu:home", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(WELCOME, { parse_mode: "HTML", ...mainMenuKeyboard() }).catch(async () => {
    await ctx.reply(WELCOME, { parse_mode: "HTML", ...mainMenuKeyboard() });
  });
});

bot.action("info", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `<b>${SITE_NAME}</b>\nКальян-лаунж у Пирятині.\n\n${WORKING_HOURS}\n\nInstagram: ${INSTAGRAM_URL}`,
    { parse_mode: "HTML", ...mainMenuKeyboard() }
  );
});

// Text-based fallback flows (used when WEBAPP_URL is not configured yet).
bot.action("booking:start", (ctx) => ctx.scene.enter("booking"));
bot.action("order:start", (ctx) => ctx.scene.enter("order"));

// "📦 Замовити на самовивіз" tapped from a flavor's detail card — jump straight
// into the order wizard with that flavor already selected.
bot.action(/^ord:quick:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const flavorId = ctx.match[1];
  return ctx.scene.enter("order", { preselected: flavorId });
});

bot.command("book", (ctx) => ctx.scene.enter("booking"));
bot.command("order", (ctx) => ctx.scene.enter("order"));
bot.command("menu", async (ctx) => {
  await ctx.reply(WELCOME, { parse_mode: "HTML", ...mainMenuKeyboard() });
});

registerMenuHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
  ctx.reply("Щось пішло не так. Спробуйте /menu ще раз або зверніться до закладу.").catch(() => {});
});

bot.launch().then(() => {
  console.log("Tyaga Pyriatyn bot is running.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
