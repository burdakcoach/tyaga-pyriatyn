import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] || fallback;
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
// Set once the website is deployed with HTTPS to open real Telegram Mini App
// screens instead of the text-based bot flows below (both keep working).
export const WEBAPP_URL = process.env.WEBAPP_URL || "";

export { required };
