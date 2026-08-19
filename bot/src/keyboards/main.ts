import { Markup } from "telegraf";
import { WEBAPP_URL } from "../env.js";

export function mainMenuKeyboard() {
  const rows = [
    [Markup.button.callback("📋 Меню смаків", "menu:brands")],
    WEBAPP_URL
      ? [Markup.button.webApp("🍽 Забронювати столик", `${WEBAPP_URL}/booking`)]
      : [Markup.button.callback("🍽 Забронювати столик", "booking:start")],
    WEBAPP_URL
      ? [Markup.button.webApp("📦 Забивка на самовивіз", `${WEBAPP_URL}/order`)]
      : [Markup.button.callback("📦 Забивка на самовивіз", "order:start")],
    // Сайт відкриваємо як Mini App — гість лишається в Telegram і бачить
    // головну з галереєю, каталогом і всіма розділами.
    ...(WEBAPP_URL ? [[Markup.button.webApp("🌐 Перейти на сайт", WEBAPP_URL)]] : []),
    [Markup.button.callback("ℹ️ Про заклад", "info")],
  ];
  return Markup.inlineKeyboard(rows);
}
