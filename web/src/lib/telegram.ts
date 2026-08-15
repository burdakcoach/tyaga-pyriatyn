// Sends a plain-text/HTML notification to the venue owner's Telegram chat.
// Uses the SAME TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID env vars as the
// bot workspace — the web and bot processes run side-by-side in one Railway
// service (see root package.json "start" script), so they share one env.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
export { escapeHtml };

export async function notifyAdmin(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn("TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID not set — skipping admin notification.");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("Telegram notifyAdmin failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Telegram notifyAdmin error:", e);
  }
}
