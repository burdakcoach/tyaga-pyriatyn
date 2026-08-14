export const STRENGTH_LABEL: Record<string, string> = {
  LIGHT: "🟢 Легкий",
  MEDIUM: "🟡 Середній",
  STRONG: "🔴 Міцний",
};

export const COAL_LABEL: Record<string, string> = {
  COCONUT: "Кокосове вугілля",
  QUICKLIGHT: "Швидкозаймисте",
  NONE: "Без вугілля",
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
