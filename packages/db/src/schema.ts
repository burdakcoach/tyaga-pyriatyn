// Tyaga Pyriatyn — shared database schema (Drizzle ORM + SQLite).
// Used by both the website (Next.js API routes) and the Telegram bot.

import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

function cuid(prefix: string) {
  // Small dependency-free unique id generator (good enough for this app's scale).
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
export { cuid };

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const flavors = sqliteTable(
  "flavors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    strength: text("strength", { enum: ["LIGHT", "MEDIUM", "STRONG"] }),
    weightGrams: integer("weight_grams"),
    category: text("category"),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    imageUrl: text("image_url"),
    sourceNote: text("source_note"),
    brandId: text("brand_id").references(() => brands.id),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    brandIdx: index("flavors_brand_idx").on(t.brandId),
  })
);

export const zones = sqliteTable("zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tableSpots = sqliteTable(
  "table_spots",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id),
    capacity: integer("capacity").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    shape: text("shape").notNull().default("round"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => ({
    zoneNumberIdx: uniqueIndex("table_spots_zone_number_idx").on(t.zoneId, t.number),
  })
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    tableSpotId: text("table_spot_id")
      .notNull()
      .references(() => tableSpots.id),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    telegramUserId: text("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    date: text("date").notNull(), // YYYY-MM-DD
    timeSlot: text("time_slot").notNull(), // HH:MM
    guests: integer("guests").notNull(),
    comment: text("comment"),
    status: text("status", { enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    tableDateIdx: index("bookings_table_date_idx").on(t.tableSpotId, t.date),
  })
);

export const pickupOrders = sqliteTable("pickup_orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  telegramUserId: text("telegram_user_id"),
  telegramUsername: text("telegram_username"),
  pickupDate: text("pickup_date").notNull(),
  pickupTime: text("pickup_time").notNull(),
  coalType: text("coal_type", { enum: ["COCONUT", "QUICKLIGHT", "NONE"] })
    .notNull()
    .default("COCONUT"),
  comment: text("comment"),
  status: text("status", {
    enum: ["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED"],
  })
    .notNull()
    .default("PENDING"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const homeOrders = sqliteTable("home_orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  telegramUserId: text("telegram_user_id"),
  telegramUsername: text("telegram_username"),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  guests: integer("guests"),
  comment: text("comment"),
  status: text("status", {
    enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"],
  })
    .notNull()
    .default("PENDING"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

// --- Прайс-лист (ТІЛЬКИ для адмінки) ----------------------------------------
// Бар, кухня та послуги з цінами. Ця таблиця свідомо НЕ віддається жодним
// публічним API-роутом і не рендериться на сайті — ціни потрібні лише для
// внутрішніх калькуляцій власника (рахунок гостя, виторг за зміну).
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // DRINK — безалкогольне, BEER — пиво, SNACK — снеки, SERVICE — послуги.
    category: text("category", { enum: ["DRINK", "BEER", "SNACK", "SERVICE", "OTHER"] })
      .notNull()
      .default("OTHER"),
    // Ціна продажу в гривнях.
    price: real("price").notNull().default(0),
    // Закупівельна ціна — опційна, для розрахунку маржі.
    costPrice: real("cost_price"),
    // Фасування/одиниця: "0.5 л", "банка 0.33", "порція" тощо.
    unit: text("unit"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => ({
    categoryIdx: index("products_category_idx").on(t.category),
  })
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => pickupOrders.id, { onDelete: "cascade" }),
    flavorId: text("flavor_id")
      .notNull()
      .references(() => flavors.id),
    weightGrams: integer("weight_grams").notNull().default(25),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
  })
);

// --- Чеки за столиками (ТІЛЬКИ для адмінки) ---------------------------------
// Адмін відкриває чек на столик, коли гості сіли, накидає позиції та закриває
// його, коли гості пішли. Поки чек відкритий, столик вважається зайнятим і не
// бронюється ні з сайту, ні з бота. Закриті чеки лишаються назавжди — з них
// рахується виторг за день у вкладці «Тотал».
export const checks = sqliteTable(
  "checks",
  {
    id: text("id").primaryKey(),
    tableSpotId: text("table_spot_id")
      .notNull()
      .references(() => tableSpots.id),
    status: text("status", { enum: ["OPEN", "CLOSED"] })
      .notNull()
      .default("OPEN"),
    // Підсумок фіксується в момент закриття. Для відкритого чека рахується
    // на льоту з позицій, тут лишається 0.
    total: real("total").notNull().default(0),
    guests: integer("guests"),
    comment: text("comment"),
    openedAt: text("opened_at").notNull().default(sql`(current_timestamp)`),
    closedAt: text("closed_at"),
  },
  (t) => ({
    statusIdx: index("checks_status_idx").on(t.status),
    tableIdx: index("checks_table_idx").on(t.tableSpotId),
  })
);

export const checkItems = sqliteTable(
  "check_items",
  {
    id: text("id").primaryKey(),
    checkId: text("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    // Посилання на прайс лишаємо для звітів, але назву й ціну зберігаємо
    // копією: якщо завтра ціна кальяна зміниться, вчорашній чек має лишитись
    // таким, яким гість його оплатив.
    productId: text("product_id").references(() => products.id),
    name: text("name").notNull(),
    price: real("price").notNull(),
    qty: integer("qty").notNull().default(1),
  },
  (t) => ({
    checkIdx: index("check_items_check_idx").on(t.checkId),
  })
);

// --- Relations (for query().with() style joins) -----------------------------

export const brandsRelations = relations(brands, ({ many }) => ({
  flavors: many(flavors),
}));

export const flavorsRelations = relations(flavors, ({ one, many }) => ({
  brand: one(brands, { fields: [flavors.brandId], references: [brands.id] }),
  orderItems: many(orderItems),
}));

export const zonesRelations = relations(zones, ({ many }) => ({
  tables: many(tableSpots),
}));

export const tableSpotsRelations = relations(tableSpots, ({ one, many }) => ({
  zone: one(zones, { fields: [tableSpots.zoneId], references: [zones.id] }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  tableSpot: one(tableSpots, { fields: [bookings.tableSpotId], references: [tableSpots.id] }),
}));

export const pickupOrdersRelations = relations(pickupOrders, ({ many }) => ({
  items: many(orderItems),
}));

export const checksRelations = relations(checks, ({ one, many }) => ({
  tableSpot: one(tableSpots, { fields: [checks.tableSpotId], references: [tableSpots.id] }),
  items: many(checkItems),
}));

export const checkItemsRelations = relations(checkItems, ({ one }) => ({
  check: one(checks, { fields: [checkItems.checkId], references: [checks.id] }),
  product: one(products, { fields: [checkItems.productId], references: [products.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(pickupOrders, { fields: [orderItems.orderId], references: [pickupOrders.id] }),
  flavor: one(flavors, { fields: [orderItems.flavorId], references: [flavors.id] }),
}));
