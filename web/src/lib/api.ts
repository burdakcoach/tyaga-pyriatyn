import { NextResponse } from "next/server";

/**
 * Обгортка для адмінських роутів: якщо всередині щось падає, віддаємо не
 * безлике «Internal Server Error», а справжній текст помилки.
 *
 * Це роути під Basic Auth, тому текст бачить лише власник — зате коли після
 * деплою щось не сходиться (наприклад, у базі бракує колонки), причина видно
 * одразу в панелі, а не тільки в логах Railway.
 */
export async function guarded<T>(
  label: string,
  handler: () => T | Promise<T>
): Promise<NextResponse> {
  try {
    return NextResponse.json(await handler());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[${label}] ${message}`, e);
    return NextResponse.json({ error: message, where: label }, { status: 500 });
  }
}
