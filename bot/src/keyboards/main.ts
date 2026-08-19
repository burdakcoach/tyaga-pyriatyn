import { Markup } from "telegraf";
import { WEBAPP_URL } from "../env.js";

// Адреса сайту для звичайного посилання. Окрема змінна SITE_URL на випадок,
// якщо колись з'явиться власний домен і він відрізнятиметься від WEBAPP_URL.
const SITE_URL = process.env.SITE_URL || WEBAPP_URL;

export function mainMenuKeyboard() {
  const rows = [
    [Markup.button.callback("📋 Меню смаків", "menu:brands")],
    WEBAPP_URL
      ? [Markup.button.webApp("🍽 Забронювати столик", `${WEBAPP_URL}/booking`)]
      : [Markup.button.callback("🍽 Забронювати столик", "booking:start")],
    WEBAPP_URL
      ? [Markup.button.webApp("📦 Забивка на самовивіз", `${WEBAPP_URL}/order`)]
      : [Markup.button.callback("📦 Забивка на самовивіз", "order:start")],
    // Саме url, а НЕ webApp. Mini App відкривається у вікні з назвою бота —
    // для гостя це виглядає як той самий бот, а не перехід на сайт. Звичайне
    // посилання показує адресу сайту і дає відкрити його у справжньому браузері.
    ...(SITE_URL ? [[Markup.button.url("🌐 Перейти на сайт", SITE_URL)]] : []),
    [Markup.button.callback("ℹ️ Про заклад", "info")],
  ];
  return Markup.inlineKeyboard(rows);
}
