// Розділення рахунку між гостями за одним столом + знижки.
//
// Правило розділення одне: позиція або персональна (guestNo = 1, 2, 3...) —
// тоді її платить конкретний гість, або спільна (guestNo = null) — тоді її
// вартість ділиться порівну між усіма. Якщо нічого не розподіляти, всі позиції
// спільні і виходить звичайне ділення порівну.
//
// Правило знижок: персональна знижка гостя ЗАМІНЮЄ загальну знижку столу для
// цього гостя (а не додається до неї). Так «столу 15%, а Олегу 50%» означає
// рівно те, що очікуєш: Олег платить −50%, решта −15%.
//
// Рахуємо в копійках цілими числами: 0.1 + 0.2 у плаваючій комі дає
// 0.30000000000000004, і на довгому чеку такі хвости стають реальною
// розбіжністю між сумою чека і сумою того, що платять гості.

export type SplitItem = {
  price: number;
  qty: number;
  guestNo: number | null;
};

export type SplitOptions = {
  /** Знижка на весь стіл, відсоток 0..100. */
  tableDiscount?: number;
  /** Персональні знижки: { [номер гостя]: відсоток }. */
  guestDiscounts?: Record<number, number>;
};

export type GuestShare = {
  guestNo: number;
  /** Персональні позиції гостя. */
  own: number;
  /** Його частка спільних позицій. */
  shared: number;
  /** own + shared, до знижки. */
  gross: number;
  /** Який відсоток знижки застосовано саме до нього. */
  discountPercent: number;
  /** Скільки гривень знижки. */
  discount: number;
  /** Скільки платить по факту. */
  total: number;
};

export type SplitResult = {
  /** Сума до знижок. */
  subtotal: number;
  /** Скільки всього знижено. */
  discount: number;
  /** До сплати: subtotal − discount. */
  total: number;
  sharedTotal: number;
  guests: GuestShare[];
};

const toCents = (n: number) => Math.round(n * 100);
const toUah = (cents: number) => cents / 100;

function clampPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/**
 * Рахує, скільки платить кожен гість.
 *
 * Гарантія: сума того, що платять гості, копійка в копійку дорівнює
 * підсумку чека. Залишок від ділення спільних позицій роздається по одній
 * копійці першим гостям — інакше на трьох гостях і чеку 100 ₴ вийшло б
 * 33.33 × 3 = 99.99.
 */
export function splitCheck(
  items: SplitItem[],
  guestCount: number,
  options: SplitOptions = {}
): SplitResult {
  const count = Math.max(1, Math.floor(guestCount) || 1);
  const tableDiscount = clampPercent(options.tableDiscount);
  const guestDiscounts = options.guestDiscounts || {};

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
  let subtotalCents = 0;
  let discountCents = 0;

  for (let i = 0; i < count; i++) {
    // Перші `remainder` гостей доплачують по копійці.
    const sharePart = base + (i < remainder ? 1 : 0);
    const grossCents = ownCents[i] + sharePart;

    const personal = clampPercent(guestDiscounts[i + 1]);
    const percent = personal > 0 ? personal : tableDiscount;
    const cutCents = Math.round((grossCents * percent) / 100);

    subtotalCents += grossCents;
    discountCents += cutCents;

    guests.push({
      guestNo: i + 1,
      own: toUah(ownCents[i]),
      shared: toUah(sharePart),
      gross: toUah(grossCents),
      discountPercent: percent,
      discount: toUah(cutCents),
      total: toUah(grossCents - cutCents),
    });
  }

  return {
    subtotal: toUah(subtotalCents),
    discount: toUah(discountCents),
    total: toUah(subtotalCents - discountCents),
    sharedTotal: toUah(sharedCents),
    guests,
  };
}

/** Скільки решти видати гостю. Від'ємне значення означає, що грошей не вистачає. */
export function changeDue(amountGiven: number, amountDue: number): number {
  return toUah(toCents(amountGiven) - toCents(amountDue));
}

/**
 * Зручні купюри для швидкого розрахунку: точна сума, далі округлення вгору
 * до 50/100/200/500/1000 і найближчі реальні купюри. Без дублікатів
 * і без варіантів, менших за суму до сплати.
 */
export function cashSuggestions(amountDue: number): number[] {
  if (amountDue <= 0) return [];
  const steps = [50, 100, 200, 500, 1000];
  const options = new Set<number>([Math.ceil(amountDue * 100) / 100]);

  for (const step of steps) {
    const rounded = Math.ceil(amountDue / step) * step;
    if (rounded >= amountDue) options.add(rounded);
  }
  // Плюс типові купюри, якими реально розраховуються.
  for (const note of [200, 500, 1000, 2000]) {
    if (note >= amountDue) options.add(note);
  }

  return Array.from(options)
    .sort((a, b) => a - b)
    .slice(0, 5);
}
