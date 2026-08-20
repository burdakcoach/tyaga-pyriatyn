"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { COAL_LABEL } from "@/lib/constants";
import type { ZoneDTO, TableDTO } from "@/types";
import { splitCheck, changeDue, cashSuggestions } from "@/lib/split";

type Booking = {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  timeSlot: string;
  guests: number;
  comment: string | null;
  status: string;
  createdAt: string;
  tableNumber: number | null;
  zoneName: string | null;
};

type PickupOrder = {
  id: string;
  customerName: string;
  phone: string;
  pickupDate: string;
  pickupTime: string;
  coalType: string;
  comment: string | null;
  status: string;
  createdAt: string;
  items: { flavorName: string | null; weightGrams: number }[];
};

type HomeOrder = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  eventDate: string;
  eventTime: string;
  guests: number | null;
  comment: string | null;
  status: string;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number | null;
  unit: string | null;
  active: boolean;
  sortOrder: number;
};

type CheckItem = {
  id: string;
  productId: string | null;
  name: string;
  price: number;
  qty: number;
  /** null — позиція спільна й ділиться порівну; число — платить цей гість. */
  guestNo: number | null;
};

type Check = {
  id: string;
  tableSpotId: string;
  status: "OPEN" | "CLOSED";
  total: number;
  /** Сума до знижок. */
  subtotal: number;
  /** Знижка на весь стіл, відсоток. */
  discountPercent: number;
  /** Персональні знижки: { [номер гостя]: відсоток }. */
  guestDiscounts: Record<number, number>;
  guests: number | null;
  comment: string | null;
  openedAt: string;
  closedAt: string | null;
  tableNumber: number | null;
  zoneName: string | null;
  items: CheckItem[];
};

type Stats = {
  today: number;
  month: number;
  monthVisits: number;
};

const TABS = [
  { key: "tables", label: "Столи" },
  { key: "bookings", label: "Бронювання" },
  { key: "orders", label: "Забивки на самовивіз" },
  { key: "home", label: "Кальян додому" },
  { key: "prices", label: "Бар і ціни" },
  { key: "total", label: "Тотал" },
] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-brass/20 text-brass border-brass/40",
  CONFIRMED: "bg-emerald-light/20 text-emerald-light border-emerald-light/40",
  READY: "bg-emerald-light/20 text-emerald-light border-emerald-light/40",
  COMPLETED: "bg-muted/20 text-muted border-muted/40",
  CANCELLED: "bg-terracotta/30 text-amber-glow border-terracotta/50",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Нове",
  CONFIRMED: "Підтверджено",
  READY: "Готово",
  COMPLETED: "Виконано",
  CANCELLED: "Скасовано",
};

const CATEGORY_LABEL: Record<string, string> = {
  SERVICE: "Кальяни та послуги",
  DRINK: "Напої",
  BEER: "Пиво",
  SNACK: "Снеки",
  OTHER: "Інше",
};

const CATEGORY_ORDER = ["SERVICE", "DRINK", "BEER", "SNACK", "OTHER"];

// Знижки, які реально дає заклад.
const DISCOUNTS = [15, 25, 50] as const;

function fmtDate(iso: string) {
  return iso;
}

function fmtMoney(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(2)} ₴`;
}

// Час у базі приходить у двох форматах: ISO з "Z" (ставимо ми) і
// "YYYY-MM-DD HH:MM:SS" (дефолт SQLite, це UTC). Приводимо обидва до Date.
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtTime(value: string | null) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : "—";
}

// Ключ дня в локальному часі власника (sv-SE дає рівно YYYY-MM-DD).
function dayKey(value: string | null) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("sv-SE") : "—";
}

function fmtDayLabel(key: string) {
  const today = new Date().toLocaleDateString("sv-SE");
  if (key === today) return "Сьогодні";
  const d = new Date(`${key}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", weekday: "short" });
}

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("tables");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [homeOrders, setHomeOrders] = useState<HomeOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [openChecks, setOpenChecks] = useState<Check[]>([]);
  const [closedChecks, setClosedChecks] = useState<Check[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Кожен запит тягнемо незалежно. Раніше тут був спільний Promise.all, і
  // варто було одному роуту впасти — вся панель лишалась порожньою без жодного
  // натяку на причину: порожні вкладки і прочерки замість чисел.
  const fetchJson = useCallback(async (url: string, label: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      setErrors((prev) => (prev.includes(label) ? prev : [...prev, label]));
      console.error(`Не вдалося завантажити ${url}`, e);
      return null;
    }
  }, []);

  const loadChecks = useCallback(async () => {
    const [c, z] = await Promise.all([
      fetchJson("/api/admin/checks", "чеки"),
      fetchJson("/api/zones", "столики"),
    ]);
    if (c) {
      setOpenChecks(c.open || []);
      setClosedChecks(c.closed || []);
    }
    if (z) setZones(z.zones || []);
  }, [fetchJson]);

  const load = useCallback(() => {
    setLoading(true);
    setErrors([]);
    Promise.all([
      fetchJson("/api/admin/bookings", "бронювання"),
      fetchJson("/api/admin/orders", "забивки"),
      fetchJson("/api/admin/home-orders", "кальян додому"),
      fetchJson("/api/admin/products", "прайс"),
      fetchJson("/api/admin/stats", "відвідувачі"),
      loadChecks(),
    ])
      .then(([b, o, h, p, s]) => {
        if (b) setBookings(b.bookings || []);
        if (o) setOrders(o.orders || []);
        if (h) setHomeOrders(h.homeOrders || []);
        if (p) setProducts(p.products || []);
        if (s) setStats(s);
      })
      .finally(() => setLoading(false));
  }, [fetchJson, loadChecks]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(kind: "bookings" | "orders" | "home", id: string, status: string) {
    const endpoint = kind === "home" ? "/api/admin/home-orders" : `/api/admin/${kind}`;
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  // --- Прайс -----------------------------------------------------------------

  async function patchProduct(id: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function deleteProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // --- Чеки ------------------------------------------------------------------

  async function openCheck(tableSpotId: string) {
    await fetch("/api/admin/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableSpotId }),
    });
    setSelectedTableId(tableSpotId);
    await loadChecks();
  }

  async function checkAction(checkId: string, payload: Record<string, unknown>) {
    await fetch("/api/admin/checks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkId, ...payload }),
    });
    await loadChecks();
  }

  async function cancelCheck(checkId: string) {
    await fetch(`/api/admin/checks?id=${encodeURIComponent(checkId)}`, { method: "DELETE" });
    await loadChecks();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const key = CATEGORY_ORDER.includes(p.category) ? p.category : "OTHER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [products]);

  const openByTable = useMemo(() => {
    const map = new Map<string, Check>();
    for (const c of openChecks) map.set(c.tableSpotId, c);
    return map;
  }, [openChecks]);

  const pendingCounts: Record<string, number> = {
    tables: openChecks.length,
    bookings: bookings.filter((b) => b.status === "PENDING").length,
    orders: orders.filter((o) => o.status === "PENDING").length,
    home: homeOrders.filter((h) => h.status === "PENDING").length,
    prices: 0,
    total: 0,
  };

  function StatusSelect({
    kind,
    id,
    status,
    options,
  }: {
    kind: "bookings" | "orders" | "home";
    id: string;
    status: string;
    options: string[];
  }) {
    return (
      <select
        value={status}
        onChange={(e) => setStatus(kind, id, e.target.value)}
        className={`text-xs rounded-full border px-2 py-1 bg-background/60 ${STATUS_COLOR[status] || ""}`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {STATUS_LABEL[o] || o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Адмін-панель Tyaga</h1>
        <button
          onClick={load}
          className="text-sm rounded-full border border-brass/30 px-3 py-1.5 hover:bg-brass/10 transition-colors"
        >
          🔄 Оновити
        </button>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-xl border border-terracotta/60 bg-terracotta/15 px-4 py-3">
          <p className="text-sm font-semibold text-amber-glow">
            Не завантажилось: {errors.join(", ")}
          </p>
          <p className="text-xs text-muted mt-1">
            Решта панелі працює. Найчастіша причина — база ще не оновилась після
            деплою: у Railway перезапустіть сервіс, щоб пройшла міграція.
          </p>
        </div>
      )}

      {/* Відвідуваність сайту — видно з будь-якої вкладки. */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-brass/20 bg-panel px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide">Відвідувачів сьогодні</p>
          <p className="text-2xl font-extrabold text-brass tabular-nums">
            {stats ? stats.today : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-brass/20 bg-panel px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide">Відвідувачів за місяць</p>
          <p className="text-2xl font-extrabold tabular-nums">{stats ? stats.month : "—"}</p>
          {stats && stats.monthVisits > stats.month && (
            <p className="text-xs text-muted mt-0.5">{stats.monthVisits} візитів разом</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {TABS.map((t) => {
          const count = pendingCounts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                tab === t.key
                  ? "bg-emerald border-emerald text-foreground"
                  : "border-brass/20 text-muted hover:border-brass/50"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-terracotta/80 text-[10px] w-4 h-4">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-muted">Завантаження...</p>
      ) : (
        <>
          {tab === "tables" && (
            <Tables
              zones={zones}
              openByTable={openByTable}
              grouped={grouped}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
              onOpenCheck={openCheck}
              onCheckAction={checkAction}
              onCancelCheck={cancelCheck}
            />
          )}

          {tab === "bookings" && (
            <div className="space-y-3">
              {bookings.length === 0 && <p className="text-muted">Бронювань поки немає.</p>}
              {bookings.map((b) => (
                <div key={b.id} className="rounded-xl border border-brass/20 bg-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {b.customerName} · {b.phone}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        Столик №{b.tableNumber} ({b.zoneName}) · {fmtDate(b.date)} о {b.timeSlot} ·{" "}
                        {b.guests} гостей
                      </p>
                      {b.comment && <p className="text-sm text-muted mt-0.5">💬 {b.comment}</p>}
                    </div>
                    <StatusSelect
                      kind="bookings"
                      id={b.id}
                      status={b.status}
                      options={["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-muted">Замовлень поки немає.</p>}
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl border border-brass/20 bg-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {o.customerName} · {o.phone}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        Смаки: {o.items.map((i) => i.flavorName).filter(Boolean).join(", ") || "—"}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        {COAL_LABEL[o.coalType] || o.coalType} · Самовивіз {fmtDate(o.pickupDate)} о{" "}
                        {o.pickupTime}
                      </p>
                      {o.comment && <p className="text-sm text-muted mt-0.5">💬 {o.comment}</p>}
                    </div>
                    <StatusSelect
                      kind="orders"
                      id={o.id}
                      status={o.status}
                      options={["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED"]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "home" && (
            <div className="space-y-3">
              {homeOrders.length === 0 && <p className="text-muted">Заявок поки немає.</p>}
              {homeOrders.map((h) => (
                <div key={h.id} className="rounded-xl border border-brass/20 bg-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {h.customerName} · {h.phone}
                      </p>
                      <p className="text-sm text-muted mt-0.5">📍 {h.address}</p>
                      <p className="text-sm text-muted mt-0.5">
                        {fmtDate(h.eventDate)} о {h.eventTime}
                        {h.guests ? ` · ${h.guests} гостей` : ""}
                      </p>
                      {h.comment && <p className="text-sm text-muted mt-0.5">💬 {h.comment}</p>}
                    </div>
                    <StatusSelect
                      kind="home"
                      id={h.id}
                      status={h.status}
                      options={["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "prices" && (
            <PriceList
              grouped={grouped}
              onPatch={patchProduct}
              onDelete={deleteProduct}
              onCreated={load}
            />
          )}

          {tab === "total" && <Total checks={closedChecks} />}
        </>
      )}
    </div>
  );
}

// --- Вкладка «Столи» ---------------------------------------------------------

function Tables({
  zones,
  openByTable,
  grouped,
  selectedTableId,
  onSelectTable,
  onOpenCheck,
  onCheckAction,
  onCancelCheck,
}: {
  zones: ZoneDTO[];
  openByTable: Map<string, Check>;
  grouped: { category: string; items: Product[] }[];
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
  onOpenCheck: (tableSpotId: string) => Promise<void>;
  onCheckAction: (checkId: string, payload: Record<string, unknown>) => Promise<void>;
  onCancelCheck: (checkId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Зберігаємо саме id чека, до якого належить підтвердження. Так при переході
  // на інший столик кнопка сама повертається у вихідний стан — і неможливо
  // випадково натиснути «Так, закрити» на чужому чеку.
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  // Кому приписувати нові позиції: null — у спільні, число — конкретному гостю.
  const [activeGuestByCheck, setActiveGuestByCheck] = useState<Record<string, number | null>>({});

  const allTables: TableDTO[] = zones.flatMap((z) => z.tables);
  const selectedTable = allTables.find((t) => t.id === selectedTableId) || null;
  const selectedZone = zones.find((z) => z.tables.some((t) => t.id === selectedTableId));
  const activeCheck = selectedTableId ? openByTable.get(selectedTableId) || null : null;
  const confirmClose = activeCheck !== null && confirmCloseId === activeCheck.id;

  const guestCount = Math.max(1, activeCheck?.guests || 1);
  // Прив'язуємо вибір до id чека, щоб при переході на інший стіл він скидався сам.
  const rawActiveGuest = activeCheck ? activeGuestByCheck[activeCheck.id] ?? null : null;
  // Зменшили кількість гостей — активним лишається валідний номер.
  const activeGuest = rawActiveGuest !== null && rawActiveGuest > guestCount ? null : rawActiveGuest;
  const setActiveGuest = (g: number | null) => {
    if (activeCheck) setActiveGuestByCheck((prev) => ({ ...prev, [activeCheck.id]: g }));
  };

  const split = splitCheck(
    (activeCheck?.items || []).map((i) => ({ price: i.price, qty: i.qty, guestNo: i.guestNo })),
    guestCount,
    {
      tableDiscount: activeCheck?.discountPercent || 0,
      guestDiscounts: activeCheck?.guestDiscounts || {},
    }
  );

  // Готівка: кого розраховуємо (null — весь стіл) і скільки дав гість.
  const [payTarget, setPayTarget] = useState<number | null>(null);
  const [cashGiven, setCashGiven] = useState<string>("");
  const payTargetValid = payTarget !== null && payTarget <= guestCount ? payTarget : null;
  const amountDue =
    payTargetValid === null
      ? split.total
      : split.guests[payTargetValid - 1]?.total ?? 0;
  const given = cashGiven === "" ? null : Number(cashGiven.replace(",", "."));
  const change = given === null || !Number.isFinite(given) ? null : changeDue(given, amountDue);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {zones.length === 0 && (
        <p className="text-muted">
          Столики не завантажились. Натисніть «Оновити» — якщо не допомогло,
          подивіться повідомлення про помилку вгорі.
        </p>
      )}
      {zones.map((zone) => (
        <div key={zone.id}>
          <h2 className="text-sm font-semibold text-brass uppercase tracking-wide mb-2">
            {zone.name}
          </h2>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {zone.tables.map((t) => {
              const check = openByTable.get(t.id);
              const isSelected = t.id === selectedTableId;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTable(isSelected ? null : t.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-brass bg-brass/10"
                      : check
                      ? "border-terracotta/60 bg-terracotta/10 hover:border-terracotta"
                      : "border-brass/20 bg-panel hover:border-brass/50"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">Столик №{t.number}</span>
                    <span className="text-xs text-muted">до {t.capacity}</span>
                  </div>
                  {check ? (
                    <>
                      <p className="text-xs text-amber-glow mt-1">
                        Димно 💨 з {fmtTime(check.openedAt)}
                      </p>
                      <p className="text-sm font-semibold text-brass mt-0.5">
                        {fmtMoney(check.total)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-emerald-light mt-1">Вільно</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selectedTable && (
        <div className="rounded-2xl border border-brass/30 bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold">
              Столик №{selectedTable.number}
              {selectedZone ? ` · ${selectedZone.name}` : ""}
            </h2>
            <button
              onClick={() => onSelectTable(null)}
              className="text-xs text-muted hover:text-brass"
            >
              Закрити картку
            </button>
          </div>

          {!activeCheck ? (
            <div>
              <p className="text-sm text-muted mb-3">
                Чек не відкритий. Столик доступний для бронювання з сайту й бота.
              </p>
              <button
                disabled={busy}
                onClick={() => run(() => onOpenCheck(selectedTable.id))}
                className="rounded-full bg-emerald px-5 py-2.5 font-semibold disabled:opacity-40"
              >
                Відкрити чек
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
              <div className="space-y-5">
                <p className="text-sm text-muted">
                  {activeGuest === null
                    ? "Натискайте позиції — вони підуть у спільні й розділяться порівну."
                    : `Натискайте позиції — вони підуть гостю №${activeGuest}.`}
                </p>
                {grouped.map(({ category, items }) => {
                  const available = items.filter((p) => p.active);
                  if (available.length === 0) return null;
                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-brass uppercase tracking-wide mb-2">
                        {CATEGORY_LABEL[category] || category}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {available.map((p) => {
                          const inBill = activeCheck.items.find((i) => i.productId === p.id);
                          return (
                            <button
                              key={p.id}
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  onCheckAction(activeCheck.id, {
                                    action: "add",
                                    productId: p.id,
                                    guestNo: activeGuest,
                                  })
                                )
                              }
                              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                                inBill
                                  ? "border-emerald bg-emerald/20"
                                  : "border-brass/20 bg-background/40 hover:border-brass/50"
                              }`}
                            >
                              <span className="block">{p.name}</span>
                              <span className="block text-xs text-muted">
                                {fmtMoney(p.price)}
                                {p.unit ? ` · ${p.unit}` : ""}
                                {inBill ? ` · ×${inBill.qty}` : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-brass/20 bg-background/40 p-4 lg:sticky lg:top-24">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-semibold">Рахунок</h3>
                  <span className="text-xs text-muted">з {fmtTime(activeCheck.openedAt)}</span>
                </div>

                {/* Скільки гостей ділять цей стіл. 1 — звичайний спільний рахунок. */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm text-muted">Гостей за столом</span>
                  <span className="flex items-center gap-1">
                    <button
                      disabled={busy || guestCount <= 1}
                      onClick={() =>
                        run(() =>
                          onCheckAction(activeCheck.id, {
                            action: "setGuests",
                            guests: guestCount - 1,
                          })
                        )
                      }
                      className="w-7 h-7 rounded-full border border-brass/30 leading-none disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-7 text-center font-semibold tabular-nums">{guestCount}</span>
                    <button
                      disabled={busy || guestCount >= 12}
                      onClick={() =>
                        run(() =>
                          onCheckAction(activeCheck.id, {
                            action: "setGuests",
                            guests: guestCount + 1,
                          })
                        )
                      }
                      className="w-7 h-7 rounded-full border border-brass/30 leading-none disabled:opacity-30"
                    >
                      +
                    </button>
                  </span>
                </div>

                {/* Знижка на весь стіл. Персональна знижка гостя її перекриє. */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm text-muted">Знижка на стіл</span>
                  <span className="flex gap-1">
                    {DISCOUNTS.map((d) => {
                      const on = (activeCheck.discountPercent || 0) === d;
                      return (
                        <button
                          key={d}
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              onCheckAction(activeCheck.id, {
                                action: "setDiscount",
                                // Повторне натискання активної кнопки знімає знижку.
                                percent: on ? 0 : d,
                              })
                            )
                          }
                          className={`rounded-full border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                            on
                              ? "border-terracotta bg-terracotta/25 text-amber-glow"
                              : "border-brass/25 text-muted hover:border-brass/60"
                          }`}
                        >
                          {d}%
                        </button>
                      );
                    })}
                  </span>
                </div>

                {guestCount > 1 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {[null, ...Array.from({ length: guestCount }, (_, i) => i + 1)].map((g) => (
                      <button
                        key={g ?? "shared"}
                        onClick={() => setActiveGuest(g)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          activeGuest === g
                            ? "border-brass bg-brass/20 text-brass"
                            : "border-brass/20 text-muted hover:border-brass/50"
                        }`}
                      >
                        {g === null ? "Спільне" : `Гість ${g}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Персональна знижка — тільки коли обрано конкретного гостя. */}
                {guestCount > 1 && activeGuest !== null && (
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-sm text-muted">Знижка гостю {activeGuest}</span>
                    <span className="flex gap-1">
                      {DISCOUNTS.map((d) => {
                        const on = (activeCheck.guestDiscounts?.[activeGuest] || 0) === d;
                        return (
                          <button
                            key={d}
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                onCheckAction(activeCheck.id, {
                                  action: "setGuestDiscount",
                                  guestNo: activeGuest,
                                  percent: on ? 0 : d,
                                })
                              )
                            }
                            className={`rounded-full border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                              on
                                ? "border-terracotta bg-terracotta/25 text-amber-glow"
                                : "border-brass/25 text-muted hover:border-brass/60"
                            }`}
                          >
                            {d}%
                          </button>
                        );
                      })}
                    </span>
                  </div>
                )}

                {activeCheck.items.length === 0 ? (
                  <p className="text-sm text-muted">Поки порожньо.</p>
                ) : (
                  <div className="space-y-2">
                    {activeCheck.items.map((i) => (
                      <div key={i.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{i.name}</span>
                        <span className="flex items-center gap-1">
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                onCheckAction(activeCheck.id, { action: "remove", itemId: i.id })
                              )
                            }
                            className="w-6 h-6 rounded-full border border-brass/30 leading-none disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-6 text-center">{i.qty}</span>
                          <button
                            // Якщо позицію встигли видалити з прайсу, додати
                            // ще одну таку вже нема звідки — лишається тільки «−».
                            disabled={busy || !i.productId}
                            onClick={() =>
                              run(() =>
                                onCheckAction(activeCheck.id, {
                                  action: "add",
                                  productId: i.productId,
                                })
                              )
                            }
                            className="w-6 h-6 rounded-full border border-brass/30 leading-none disabled:opacity-40"
                          >
                            +
                          </button>
                        </span>
                        <span className="w-16 shrink-0 text-right tabular-nums">
                          {fmtMoney(i.price * i.qty)}
                        </span>
                        {guestCount > 1 && (
                          <select
                            value={i.guestNo ?? ""}
                            disabled={busy}
                            onChange={(e) =>
                              run(() =>
                                onCheckAction(activeCheck.id, {
                                  action: "assign",
                                  itemId: i.id,
                                  guestNo: e.target.value === "" ? null : Number(e.target.value),
                                })
                              )
                            }
                            title="Хто платить за цю позицію"
                            className={`shrink-0 rounded-full border bg-background/60 px-1.5 py-0.5 text-[11px] ${
                              i.guestNo
                                ? "border-brass/50 text-brass"
                                : "border-brass/20 text-muted"
                            }`}
                          >
                            <option value="">спільне</option>
                            {Array.from({ length: guestCount }, (_, k) => k + 1).map((g) => (
                              <option key={g} value={g}>
                                №{g}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-brass/20">
                  {split.discount > 0 && (
                    <>
                      <div className="flex items-baseline justify-between text-sm text-muted">
                        <span>Сума</span>
                        <span className="tabular-nums line-through">{fmtMoney(split.subtotal)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-sm text-amber-glow">
                        <span>Знижка</span>
                        <span className="tabular-nums">−{fmtMoney(split.discount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-sm text-muted">До сплати</span>
                    <span className="text-xl font-extrabold text-brass tabular-nums">
                      {fmtMoney(split.total)}
                    </span>
                  </div>
                </div>

                {guestCount > 1 && activeCheck.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-brass/10">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-muted uppercase tracking-wide">
                        Кому скільки платити
                      </span>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() => onCheckAction(activeCheck.id, { action: "resetSplit" }))
                        }
                        className="text-xs text-muted hover:text-brass disabled:opacity-40"
                      >
                        Порівну
                      </button>
                    </div>
                    {split.guests.map((g) => (
                      <div key={g.guestNo} className="flex items-baseline justify-between text-sm">
                        <span className="text-muted">
                          Гість {g.guestNo}
                          {g.discountPercent > 0 && (
                            <span className="text-xs text-amber-glow"> −{g.discountPercent}%</span>
                          )}
                          {g.own > 0 && (
                            <span className="text-xs text-muted/70">
                              {" "}
                              ({fmtMoney(g.own)} своє + {fmtMoney(g.shared)} спільні)
                            </span>
                          )}
                        </span>
                        <span className="font-semibold tabular-nums">{fmtMoney(g.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Готівка: скільки дав гість і скільки видати решти. */}
                {activeCheck.items.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-brass/10">
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">Розрахунок готівкою</p>

                    {guestCount > 1 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {[null, ...Array.from({ length: guestCount }, (_, i) => i + 1)].map((g) => (
                          <button
                            key={g ?? "all"}
                            onClick={() => {
                              setPayTarget(g);
                              setCashGiven("");
                            }}
                            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                              payTargetValid === g
                                ? "border-brass bg-brass/20 text-brass"
                                : "border-brass/20 text-muted hover:border-brass/50"
                            }`}
                          >
                            {g === null ? "Весь стіл" : `Гість ${g}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-baseline justify-between text-sm mb-2">
                      <span className="text-muted">
                        {payTargetValid === null ? "До сплати" : `Гість ${payTargetValid} платить`}
                      </span>
                      <span className="font-semibold tabular-nums">{fmtMoney(amountDue)}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {cashSuggestions(amountDue).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCashGiven(String(v))}
                          className={`rounded-lg border px-2 py-1 text-xs tabular-nums transition-colors ${
                            given === v
                              ? "border-emerald bg-emerald/20"
                              : "border-brass/20 text-muted hover:border-brass/50"
                          }`}
                        >
                          {v === amountDue ? "Без решти" : `${v} ₴`}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder="Гість дав, ₴"
                        className="w-full rounded-lg border border-brass/30 bg-background/60 px-2 py-1.5 text-sm text-right"
                      />
                      {cashGiven !== "" && (
                        <button
                          onClick={() => setCashGiven("")}
                          className="shrink-0 text-xs text-muted hover:text-brass"
                        >
                          Скинути
                        </button>
                      )}
                    </div>

                    {change !== null && (
                      <div
                        className={`mt-2 rounded-lg border px-3 py-2 flex items-baseline justify-between ${
                          change < 0
                            ? "border-terracotta/60 bg-terracotta/15"
                            : "border-emerald/50 bg-emerald/15"
                        }`}
                      >
                        <span className="text-sm">
                          {change < 0 ? "Не вистачає" : "Решта"}
                        </span>
                        <span className="text-lg font-extrabold tabular-nums">
                          {fmtMoney(Math.abs(change))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeCheck.items.length > 0 ? (
                  confirmClose ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-muted">
                        Закрити чек на {fmtMoney(split.total)}? Столик знову стане вільним.
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await onCheckAction(activeCheck.id, { action: "close" });
                              setConfirmCloseId(null);
                              onSelectTable(null);
                            })
                          }
                          className="flex-1 rounded-full bg-emerald px-4 py-2.5 font-semibold disabled:opacity-40"
                        >
                          Так, закрити
                        </button>
                        <button
                          onClick={() => setConfirmCloseId(null)}
                          className="rounded-full border border-brass/30 px-4 py-2.5 text-sm"
                        >
                          Ні
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => setConfirmCloseId(activeCheck.id)}
                      className="mt-4 w-full rounded-full bg-emerald px-4 py-2.5 font-semibold disabled:opacity-40"
                    >
                      Закрити чек
                    </button>
                  )
                ) : (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await onCancelCheck(activeCheck.id);
                        onSelectTable(null);
                      })
                    }
                    className="mt-4 w-full rounded-full border border-terracotta/60 px-4 py-2.5 text-sm disabled:opacity-40"
                  >
                    Скасувати порожній чек
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Вкладка «Тотал» ---------------------------------------------------------

function Total({ checks }: { checks: Check[] }) {
  const days = useMemo(() => {
    const map = new Map<string, Check[]>();
    for (const c of checks) {
      const key = dayKey(c.closedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        items,
        sum: items.reduce((acc, c) => acc + c.total, 0),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [checks]);

  const todayKey = new Date().toLocaleDateString("sv-SE");
  const todaySum = days.find((d) => d.key === todayKey)?.sum ?? 0;
  const todayCount = days.find((d) => d.key === todayKey)?.items.length ?? 0;
  const allSum = checks.reduce((acc, c) => acc + c.total, 0);

  if (checks.length === 0) {
    return (
      <p className="text-muted">
        Закритих чеків поки немає. Відкрийте чек на вкладці «Столи» — після закриття він з&apos;явиться тут.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brass/30 bg-panel p-4">
          <p className="text-sm text-muted">Сьогодні</p>
          <p className="text-3xl font-extrabold text-brass tabular-nums">{fmtMoney(todaySum)}</p>
          <p className="text-xs text-muted mt-1">{todayCount} чек(ів)</p>
        </div>
        <div className="rounded-xl border border-brass/20 bg-panel p-4">
          <p className="text-sm text-muted">За весь час</p>
          <p className="text-3xl font-extrabold tabular-nums">{fmtMoney(allSum)}</p>
          <p className="text-xs text-muted mt-1">{checks.length} чек(ів)</p>
        </div>
      </div>

      {days.map((day) => (
        <div key={day.key}>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-brass uppercase tracking-wide">
              {fmtDayLabel(day.key)}
            </h2>
            <span className="text-sm font-bold tabular-nums">{fmtMoney(day.sum)}</span>
          </div>
          <div className="rounded-xl border border-brass/20 bg-panel divide-y divide-brass/10">
            {day.items.map((c) => (
              <div key={c.id} className="p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    Столик №{c.tableNumber ?? "—"}
                    {c.zoneName ? ` · ${c.zoneName}` : ""}
                  </span>
                  <span className="font-bold tabular-nums">{fmtMoney(c.total)}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {fmtTime(c.openedAt)} – {fmtTime(c.closedAt)}
                  {c.items.length > 0 && ` · ${c.items.map((i) => `${i.name}×${i.qty}`).join(", ")}`}
                </p>
                {/* Чек ділили між гостями — показуємо, хто скільки заплатив.
                    Ціни в позиціях збережені знімком, тож розподіл відтворюється
                    точно таким, яким був у момент закриття. */}
                {(c.guests || 1) > 1 && (
                  <p className="text-xs text-brass/80 mt-0.5">
                    Розділено на {c.guests}:{" "}
                    {splitCheck(
                      c.items.map((i) => ({ price: i.price, qty: i.qty, guestNo: i.guestNo })),
                      c.guests || 1,
                      // Знижки обов'язково передаємо: без них розбивка показала б
                      // суми до знижки, і вони не сходились би з підсумком чека.
                      {
                        tableDiscount: c.discountPercent,
                        guestDiscounts: c.guestDiscounts || {},
                      }
                    )
                      .guests.map((g) => fmtMoney(g.total))
                      .join(" · ")}
                  </p>
                )}
                {c.subtotal > c.total && (
                  <p className="text-xs text-amber-glow/80 mt-0.5">
                    Знижка −{fmtMoney(c.subtotal - c.total)} (з {fmtMoney(c.subtotal)})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Вкладка «Бар і ціни» ----------------------------------------------------

function PriceList({
  grouped,
  onPatch,
  onDelete,
  onCreated,
}: {
  grouped: { category: string; items: Product[] }[];
  onPatch: (id: string, patch: Partial<Product>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreated: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("DRINK");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          price: newPrice,
          unit: newUnit,
          category: newCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Не вдалося додати позицію");
        return;
      }
      setNewName("");
      setNewPrice("");
      setNewUnit("");
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Ці ціни бачите тільки ви — на сайті та в боті вони ніде не показуються.
      </p>

      {grouped.map(({ category, items }) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-brass uppercase tracking-wide mb-2">
            {CATEGORY_LABEL[category] || category}
          </h2>
          <div className="rounded-xl border border-brass/20 bg-panel divide-y divide-brass/10">
            {items.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${p.active ? "" : "line-through text-muted"}`}>
                    {p.name}
                  </p>
                  {p.unit && <p className="text-xs text-muted">{p.unit}</p>}
                  {p.price === 0 && <p className="text-xs text-brass">Ціну ще не вказано</p>}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={5}
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value !== "" && Number(value) !== p.price) {
                        onPatch(p.id, { price: Number(value) });
                      }
                    }}
                    className="w-24 rounded-lg border border-brass/30 bg-background/60 px-2 py-1 text-right text-sm"
                  />
                  <span className="text-sm text-muted">₴</span>
                </div>

                <button
                  onClick={() => onPatch(p.id, { active: !p.active })}
                  title={p.active ? "Сховати позицію" : "Повернути в продаж"}
                  className="text-xs rounded-full border border-brass/30 px-2 py-1 hover:bg-brass/10 transition-colors"
                >
                  {p.active ? "В продажу" : "Немає"}
                </button>

                {confirmId === p.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onDelete(p.id);
                        setConfirmId(null);
                      }}
                      className="text-xs rounded-full border border-terracotta/60 bg-terracotta/20 px-2 py-1"
                    >
                      Видалити
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs rounded-full border border-brass/30 px-2 py-1"
                    >
                      Ні
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(p.id)}
                    title="Видалити позицію"
                    className="text-xs text-muted hover:text-amber-glow px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-brass/20 bg-panel p-4">
        <h2 className="font-semibold mb-3">Додати позицію</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Назва"
            className="rounded-lg border border-brass/30 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="Фасування"
            className="rounded-lg border border-brass/30 bg-background/60 px-3 py-2 text-sm sm:w-36"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg border border-brass/30 bg-background/60 px-3 py-2 text-sm"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={5}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Ціна"
            className="rounded-lg border border-brass/30 bg-background/60 px-3 py-2 text-sm sm:w-28 text-right"
          />
        </div>
        {error && <p className="text-sm text-amber-glow mt-2">{error}</p>}
        <button
          onClick={create}
          disabled={saving || !newName.trim() || newPrice === ""}
          className="mt-3 rounded-full bg-emerald px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? "Додаю..." : "Додати"}
        </button>
      </div>
    </div>
  );
}
