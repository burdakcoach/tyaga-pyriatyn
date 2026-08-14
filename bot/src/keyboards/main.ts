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
    [Markup.button.callback("ℹ️ Про заклад", "info")],
  ];
  return Markup.inlineKeyboard(rows);
}
