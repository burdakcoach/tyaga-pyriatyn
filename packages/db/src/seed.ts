import { db, cuid } from "./index";
import { brands, flavors, zones, tableSpots, products } from "./schema";
import { eq } from "drizzle-orm";
import flavorsRaw from "./flavors.json";

type RawFlavor = {
  num: number;
  brand: string;
  name: string;
  description: string | null;
  strength_raw: string | null;
  weight_raw: string | null;
  confidence: string | null;
  sourceFiles: string | null;
};

function mapStrength(raw: string | null): "LIGHT" | "MEDIUM" | "STRONG" | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "light") return "LIGHT";
  if (v === "medium") return "MEDIUM";
  if (v === "strong") return "STRONG";
  if (v === "soft") return "LIGHT";
  // "Sweet" / "Sour-Sweet" describe taste, not strength — left unset on purpose.
  return null;
}

function mapWeight(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function extraTasteNote(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (["sweet", "sour-sweet", "soft"].includes(v)) return raw.trim();
  return null;
}

async function upsertZone(name: string, sortOrder: number) {
  const existing = db.select().from(zones).where(eq(zones.name, name)).get();
  if (existing) return existing.id;
  const id = cuid("zone");
  db.insert(zones).values({ id, name, sortOrder }).run();
  return id;
}

async function upsertBrand(name: string) {
  const existing = db.select().from(brands).where(eq(brands.name, name)).get();
  if (existing) return existing.id;
  const id = cuid("brand");
  db.insert(brands).values({ id, name }).run();
  return id;
}

async function main() {
  console.log(`Seeding ${flavorsRaw.length} flavors...`);

  // --- Zones + tables: based on real interior photos (emerald indoor lounge +
  // pallet-wood outdoor terrace with fire pit). Positions are 0-100% so the floor
  // plan renders responsively. Adjust freely once numbering is fully confirmed.
  const zoneIds: Record<string, string> = {
    "Смарагдова кімната": await upsertZone("Смарагдова кімната", 1),
    Тераса: await upsertZone("Тераса", 2),
  };

  const tableDefs = [
    // Смарагдова кімната (indoor): 1 стіл на двох, 2 столи на сімох, 1 стіл на трьох.
    // Координати підібрані під реальне фото (web/public/interior/lounge-2.jpg).
    { zone: "Смарагдова кімната", number: 1, capacity: 2, x: 32, y: 30, shape: "square" },
    { zone: "Смарагдова кімната", number: 2, capacity: 7, x: 15, y: 58, shape: "sofa" },
    { zone: "Смарагдова кімната", number: 3, capacity: 7, x: 78, y: 52, shape: "sofa" },
    { zone: "Смарагдова кімната", number: 4, capacity: 3, x: 90, y: 85, shape: "square" },
    // Тераса: кутовий стіл на 8, стіл на 2-4, стіл на 2-6 (capacity = максимум).
    // Координати підібрані під реальне фото тераси (web/public/interior/terrace-1.jpg).
    { zone: "Тераса", number: 5, capacity: 8, x: 15, y: 22, shape: "corner" },
    { zone: "Тераса", number: 6, capacity: 4, x: 52, y: 25, shape: "square" },
    { zone: "Тераса", number: 7, capacity: 6, x: 60, y: 75, shape: "sofa" },
  ];

  for (const t of tableDefs) {
    const zoneId = zoneIds[t.zone];
    const existing = db
      .select()
      .from(tableSpots)
      .where(eq(tableSpots.zoneId, zoneId))
      .all()
      .find((row) => row.number === t.number);
    if (existing) {
      db.update(tableSpots)
        .set({ capacity: t.capacity, x: t.x, y: t.y, shape: t.shape, active: true })
        .where(eq(tableSpots.id, existing.id))
        .run();
    } else {
      db.insert(tableSpots)
        .values({
          id: cuid("table"),
          zoneId,
          number: t.number,
          capacity: t.capacity,
          x: t.x,
          y: t.y,
          shape: t.shape,
        })
        .run();
    }
  }

  // Deactivate any old table rows that are no longer part of the current floor
  // plan (e.g. the terrace used to have 5 tables, now has 3). We don't delete
  // them outright because past bookings reference their id as a foreign key —
  // marking them inactive just hides them from the floor plan going forward.
  for (const zoneName of Object.keys(zoneIds)) {
    const zoneId = zoneIds[zoneName];
    const currentNumbers = new Set(
      tableDefs.filter((t) => t.zone === zoneName).map((t) => t.number)
    );
    const rowsInZone = db.select().from(tableSpots).where(eq(tableSpots.zoneId, zoneId)).all();
    for (const row of rowsInZone) {
      if (!currentNumbers.has(row.number) && row.active) {
        db.update(tableSpots).set({ active: false }).where(eq(tableSpots.id, row.id)).run();
      }
    }
  }

  // --- Flavors, grouped by brand exactly as confirmed in the reviewed spreadsheet.
  let created = 0;
  for (const f of flavorsRaw as RawFlavor[]) {
    const brandId = await upsertBrand(f.brand || "Без бренду");
    const strength = mapStrength(f.strength_raw);
    const weightGrams = mapWeight(f.weight_raw);
    const taste = extraTasteNote(f.strength_raw);
    const description =
      [f.description, taste ? `Профіль: ${taste}` : null].filter(Boolean).join(" · ") || null;

    const id = `seed-${f.num}`;
    const existing = db.select().from(flavors).where(eq(flavors.id, id)).get();
    const values = {
      name: f.name,
      description,
      strength: strength ?? null,
      weightGrams,
      brandId,
      available: true,
      sourceNote: f.sourceFiles,
      imageUrl: `/tobacco/seed-${f.num}.jpg`,
    };
    if (existing) {
      db.update(flavors).set(values).where(eq(flavors.id, id)).run();
    } else {
      db.insert(flavors)
        .values({ id, ...values })
        .run();
    }
    created += 1;
  }

  // Remove brands left with zero flavors (e.g. after a rename in flavors.json —
  // upsertBrand creates the new name but doesn't touch the old row).
  const usedBrandIds = new Set(
    db.select({ brandId: flavors.brandId }).from(flavors).all().map((r) => r.brandId)
  );
  const allBrands = db.select().from(brands).all();
  let removedBrands = 0;
  for (const b of allBrands) {
    if (!usedBrandIds.has(b.id)) {
      db.delete(brands).where(eq(brands.id, b.id)).run();
      removedBrands += 1;
    }
  }

  // --- Прайс бару (тільки для адмінки) --------------------------------------
  // ВАЖЛИВО: позиції створюються один раз. Якщо рядок з таким id вже є в базі,
  // seed його НЕ чіпає — інакше ціна, яку власник поправив в адмін-панелі,
  // затиралася б назад на кожному деплої.
  const productDefs = [
    // Кальяни та забивки.
    { id: "prod-hookah-classic", name: "Кальян (класика)", category: "SERVICE", price: 460, unit: null, sortOrder: 1 },
    { id: "prod-hookah-premium", name: "Кальян (преміум)", category: "SERVICE", price: 500, unit: null, sortOrder: 2 },
    { id: "prod-takeaway-light", name: "Забивка на виніс (легка)", category: "SERVICE", price: 150, unit: null, sortOrder: 3 },
    { id: "prod-takeaway-medium", name: "Забивка на виніс (середня)", category: "SERVICE", price: 170, unit: null, sortOrder: 4 },
    { id: "prod-takeaway-strong", name: "Забивка на виніс (важка)", category: "SERVICE", price: 200, unit: null, sortOrder: 5 },
    // Ціну виїзду власник проставляє сам в адмінці.
    { id: "prod-hookah-home", name: "Кальян додому (виїзд)", category: "SERVICE", price: 0, unit: null, sortOrder: 6 },
    // Вугілля рахується поштучно — в калькуляторі просто тиснеш кілька разів.
    { id: "prod-coal-piece", name: "Вугілля", category: "SERVICE", price: 10, unit: "1 шт", sortOrder: 7 },
    // Безалкогольне.
    { id: "prod-tea", name: "Чай (в асортименті)", category: "DRINK", price: 120, unit: "чайник", sortOrder: 9 },
    { id: "prod-morshynska-lemonade", name: "Моршинська лимонад", category: "DRINK", price: 65, unit: null, sortOrder: 10 },
    { id: "prod-cola-can", name: "Кола (оригінал)", category: "DRINK", price: 55, unit: "залізна банка", sortOrder: 11 },
    { id: "prod-cola-zero-can", name: "Кола Zero", category: "DRINK", price: 55, unit: "залізна банка", sortOrder: 12 },
    { id: "prod-cola-05", name: "Кола (з цукром)", category: "DRINK", price: 60, unit: "пластик 0.5 л", sortOrder: 13 },
    { id: "prod-cola-zero-05", name: "Кола Zero", category: "DRINK", price: 60, unit: "пластик 0.5 л", sortOrder: 14 },
    // Пиво.
    { id: "prod-beer-opillia-zero", name: "Опілля Zero", category: "BEER", price: 85, unit: null, sortOrder: 20 },
    { id: "prod-beer-grimbergen", name: "Грімберген", category: "BEER", price: 85, unit: null, sortOrder: 21 },
    { id: "prod-beer-pravda", name: "Правда", category: "BEER", price: 75, unit: null, sortOrder: 22 },
    { id: "prod-beer-hike", name: "Хайк", category: "BEER", price: 65, unit: null, sortOrder: 23 },
    // Снеки.
    { id: "prod-chips", name: "Чіпси", category: "SNACK", price: 90, unit: null, sortOrder: 30 },
  ] as const;

  // Позиції, що були в попередніх версіях прайсу і більше не потрібні
  // (напр. одна спільна "Забивка на виніс" замість трьох за міцністю).
  // Прибираємо тільки якщо ціну там так і не проставили — щоб не знести
  // рядок, з яким власник уже працює.
  const retiredProductIds = ["prod-hookah-takeaway"];
  for (const id of retiredProductIds) {
    const row = db.select().from(products).where(eq(products.id, id)).get();
    if (row && row.price === 0) {
      db.delete(products).where(eq(products.id, id)).run();
    }
  }

  let newProducts = 0;
  let pricedProducts = 0;
  for (const p of productDefs) {
    const existing = db.select().from(products).where(eq(products.id, p.id)).get();
    if (existing) {
      // Рядок уже є. Ціну чіпаємо лише в одному випадку: вона досі 0 (тобто
      // її ніхто не проставляв), а в сіді з'явилося реальне число. Так ціни,
      // відредаговані в адмін-панелі, ніколи не затираються деплоєм.
      if (existing.price === 0 && p.price > 0) {
        db.update(products)
          .set({ price: p.price, updatedAt: new Date().toISOString() })
          .where(eq(products.id, p.id))
          .run();
        pricedProducts += 1;
      }
      continue;
    }
    db.insert(products)
      .values({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        unit: p.unit,
        sortOrder: p.sortOrder,
        active: true,
      })
      .run();
    newProducts += 1;
  }

  console.log(
    `Done. ${created} flavors, ${Object.keys(zoneIds).length} zones, ${tableDefs.length} tables` +
      (removedBrands ? `, ${removedBrands} empty brand(s) removed` : "") +
      (newProducts ? `, ${newProducts} price-list item(s) added` : "") +
      (pricedProducts ? `, ${pricedProducts} item(s) got a default price` : "") +
      "."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
