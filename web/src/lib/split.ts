// Розділення рахунку між гостями за одним столом.
//
// Правило одне: позиція або персональна (guestNo = 1, 2, 3...) — тоді її
// платить конкретний гість, або спільна (guestNo = null) — тоді її вартість
// ділиться порівну між усіма. Якщо нічого не розподіляти, всі позиції спільні
// і виходить звичайне ділення порівну.
//
// Рахуємо в копійках цілими числами: 0.1 + 0.2 у плаваючій комі дає 0.30000000000000004,
// і на довгому чеку такі хвости накопичуються в реальну розбіжність.

export type SplitItem = {
  price: number;
  qty: number;
  guestNo: number | null;
};

export type GuestShare = {
  guestNo: number;
  /** Скільки цей гість платить разом. */
  total: number;
  /** З них — його персональні позиції. */
  own: number;
  /** З них — його частка спільних. */
  shared: number;
};

export type SplitResult = {
  total: number;
  sharedTotal: number;
  guests: GuestShare[];
};

const toCents = (n: number) => Math.round(n * 100);
const toUah = (cents: number) => cents / 100;

/**
 * Рахує, скільки платить кожен гість.
 *
 * Гарантія: сума часток усіх гостей копійка в копійку дорівнює сумі чека.
 * Залишок від ділення спільних позицій роздається по одній копійці першим
 * гостям — інакше на трьох гостях і чеку 100 ₴ вийшло б 33.33 × 3 = 99.99.
 */
export function splitCheck(items: SplitItem[], guestCount: number): SplitResult {
  const count = Math.max(1, Math.floor(guestCount) || 1);

  let sharedCents = 0;
  const ownCents = new Array<number>(count).fill(0);

  for (const item of items) {
    const lineCents = toCents(item.price) * item.qty;
    // Позиція, приписана гостю, якого вже немає (зменшили кількість гостей),
    // вважається спільною — інакше її сума просто зникла б з рахунку.
    if (item.guestNo && item.guestNo >= 1 && item.guestNo <= count) {
      ownCents[item.guestNo - 1] += lineCents;
    } else {
      sharedCents += lineCents;
    }
  }

  const base = Math.floor(sharedCents / count);
  const remainder = sharedCents - base * count;

  const guests: GuestShare[] = [];
  for (let i = 0; i < count; i++) {
    // Перші `remainder` гостей доплачують по копійці.
    const sharePart = base + (i < remainder ? 1 : 0);
    guests.push({
      guestNo: i + 1,
      own: toUah(ownCents[i]),
      shared: toUah(sharePart),
      total: toUah(ownCents[i] + sharePart),
    });
  }

  const totalCents = ownCents.reduce((a, b) => a + b, 0) + sharedCents;

  return {
    total: toUah(totalCents),
    sharedTotal: toUah(sharedCents),
    guests,
  };
}
