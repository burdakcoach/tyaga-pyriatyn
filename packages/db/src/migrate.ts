import { sqlite } from "./index";

// Явна міграція колонок. Запускається ПЕРЕД drizzle-kit push.
//
// Навіщо це взагалі потрібно. `drizzle-kit push`, коли треба додати NOT NULL
// колонку до таблиці, В ЯКІЙ УЖЕ Є РЯДКИ, вважає операцію ризикованою і питає
// підтвердження. На Railway термінала немає, тож він падає з «Interactive
// prompts require a TTY» — але виходить з кодом 0. Через це деплой світиться
// зеленим, а база лишається старою, і сайт починає віддавати 500.
//
// Запускати push з --force не можна: перевірено — він перестворює таблицю і
// ЗНИЩУЄ наявні рядки, тобто зніс би всю історію закритих чеків.
//
// Тому нові колонки додаємо самі через ALTER TABLE ADD COLUMN. Ця операція
// в SQLite безпечна: дані лишаються на місці, а існуючі рядки отримують
// значення за замовчуванням. Скрипт ідемпотентний — те, що вже є, пропускає.
// Створення нових ТАБЛИЦЬ залишаємо за push: воно нічого не питає й не псує.

type ColumnDef = {
  table: string;
  column: string;
  /** Тип і обмеження рівно так, як їх розуміє SQLite. */
  ddl: string;
};

const COLUMNS: ColumnDef[] = [
  // Знижки на чек.
  { table: "checks", column: "subtotal", ddl: "real NOT NULL DEFAULT 0" },
  { table: "checks", column: "discount_percent", ddl: "real NOT NULL DEFAULT 0" },
  { table: "checks", column: "guests", ddl: "integer" },
  { table: "checks", column: "comment", ddl: "text" },
  // Розділення рахунку між гостями.
  { table: "check_items", column: "guest_no", ddl: "integer" },
  // Лічильник відвідувачів: хеш у межах місяця.
  { table: "site_visits", column: "month_hash", ddl: "text NOT NULL DEFAULT ''" },
  { table: "site_visits", column: "first_path", ddl: "text" },
  // Прайс.
  { table: "products", column: "cost_price", ddl: "real" },
  { table: "products", column: "unit", ddl: "text" },
  // Фото тютюну.
  { table: "flavors", column: "image_url", ddl: "text" },
];

function tableExists(name: string): boolean {
  const row = sqlite
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { n: number };
  return row.n > 0;
}

function columnExists(table: string, column: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function main() {
  let added = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const def of COLUMNS) {
    // Таблиці ще немає — її створить push, і одразу з потрібними колонками.
    if (!tableExists(def.table)) {
      skipped += 1;
      continue;
    }
    if (columnExists(def.table, def.column)) {
      skipped += 1;
      continue;
    }
    sqlite.exec(`ALTER TABLE ${def.table} ADD COLUMN ${def.column} ${def.ddl}`);
    console.log(`  + ${def.table}.${def.column}`);
    added += 1;
  }

  // Контрольна перевірка. Якщо колонки досі бракує — краще зупинити деплой
  // гучно, ніж підняти сайт, який сипле 500 на кожен запит чеків.
  for (const def of COLUMNS) {
    if (tableExists(def.table) && !columnExists(def.table, def.column)) {
      missing.push(`${def.table}.${def.column}`);
    }
  }

  if (missing.length > 0) {
    console.error(`Міграція не вдалася, бракує: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Чеки, закриті ще до появи знижок, отримали subtotal = 0. Це не помилка
  // розрахунку, але у звіті виглядало б дивно. Ставимо subtotal = total:
  // знижок тоді не існувало, тож сума до знижки дорівнює сплаченій.
  let backfilled = 0;
  if (tableExists("checks") && columnExists("checks", "subtotal")) {
    const res = sqlite
      .prepare("UPDATE checks SET subtotal = total WHERE status = 'CLOSED' AND subtotal = 0 AND total > 0")
      .run();
    backfilled = res.changes;
  }

  console.log(
    `Міграція: додано ${added}, вже було ${skipped}` +
      (backfilled ? `, підправлено ${backfilled} старих чек(ів)` : "") +
      "."
  );
}

main();
