export const SITE_NAME = "Tyaga Pyriatyn";
export const SITE_CITY = "Пирятин";

// TODO: replace with the real bot username once the Telegram bot is deployed.
export const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || "https://t.me/tyaga_pyriatyn_bot";
export const INSTAGRAM_URL = "https://www.instagram.com/tyaga.pyriatin/";

export const STRENGTH_LABEL: Record<string, string> = {
  LIGHT: "Легкий",
  MEDIUM: "Середній",
  STRONG: "Міцний",
};

export const STRENGTH_COLOR: Record<string, string> = {
  LIGHT: "bg-emerald-light/20 text-emerald-light border-emerald-light/40",
  MEDIUM: "bg-brass/20 text-brass border-brass/40",
  STRONG: "bg-terracotta/30 text-amber-glow border-terracotta/50",
};

export const COAL_LABEL: Record<string, string> = {
  COCONUT: "Кокосове вугілля",
  QUICKLIGHT: "Швидкозаймисте",
  NONE: "Без вугілля",
};

export const WORKING_HOURS = "Щодня 14:00 – 00:00"; // TODO: confirm real hours
