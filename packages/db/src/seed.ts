import { db, cuid } from "./index";
import { brands, flavors, zones, tableSpots } from "./schema";
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
    { zone: "Смарагдова кімната", number: 1, capacity: 2, x: 20, y: 25, shape: "square" },
    { zone: "Смарагдова кімната", number: 2, capacity: 7, x: 50, y: 25, shape: "sofa" },
    { zone: "Смарагдова кімната", number: 3, capacity: 7, x: 80, y: 25, shape: "sofa" },
    { zone: "Смарагдова кімната", number: 4, capacity: 3, x: 50, y: 75, shape: "square" },
    // Тераса: кутовий стіл на 8, стіл на 2-4, стіл на 2-6 (capacity = максимум).
    { zone: "Тераса", number: 5, capacity: 8, x: 15, y: 30, shape: "corner" },
    { zone: "Тераса", number: 6, capacity: 4, x: 55, y: 25, shape: "square" },
    { zone: "Тераса", number: 7, capacity: 6, x: 80, y: 65, shape: "sofa" },
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

  console.log(`Done. ${created} flavors, ${Object.keys(zoneIds).length} zones, ${tableDefs.length} tables.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
