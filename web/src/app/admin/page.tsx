"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { COAL_LABEL } from "@/lib/constants";

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

const TABS = [
  { key: "bookings", label: "Бронювання" },
  { key: "orders", label: "Забивки на самовивіз" },
  { key: "home", label: "Кальян додому" },
  { key: "prices", label: "Бар і ціни" },
  { key: "calc", label: "Калькулятор" },
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

function fmtDate(iso: string) {
  return iso;
}

function fmtMoney(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(2)} ₴`;
}

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [homeOrders, setHomeOrders] = useState<HomeOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Рахунок у калькуляторі: id позиції -> кількість.
  const [bill, setBill] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/bookings").then((r) => r.json()),
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/admin/home-orders").then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
    ])
      .then(([b, o, h, p]) => {
        setBookings(b.bookings || []);
        setOrders(o.orders || []);
        setHomeOrders(h.homeOrders || []);
        setProducts(p.products || []);
      })
      .finally(() => setLoading(false));
  }, []);

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
    // Оптимістично оновлюємо локально, щоб поле не «стрибало» під час набору.
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function deleteProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setBill((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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

  const billLines = useMemo(
    () =>
      Object.entries(bill)
        .map(([id, qty]) => {
          const product = products.find((p) => p.id === id);
          return product ? { product, qty, sum: product.price * qty } : null;
        })
        .filter((l): l is { product: Product; qty: number; sum: number } => l !== null),
    [bill, products]
  );

  const billTotal = billLines.reduce((acc, l) => acc + l.sum, 0);

  const pendingCounts: Record<string, number> = {
    bookings: bookings.filter((b) => b.status === "PENDING").length,
    orders: orders.filter((o) => o.status === "PENDING").length,
    home: homeOrders.filter((h) => h.status === "PENDING").length,
    prices: 0,
    calc: 0,
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

          {tab === "calc" && (
            <Calculator
              grouped={grouped}
              bill={bill}
              lines={billLines}
              total={billTotal}
              setBill={setBill}
            />
          )}
        </>
      )}
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
                  {p.price === 0 && (
                    <p className="text-xs text-brass">Ціну ще не вказано</p>
                  )}
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

// --- Вкладка «Калькулятор» ---------------------------------------------------

function Calculator({
  grouped,
  bill,
  lines,
  total,
  setBill,
}: {
  grouped: { category: string; items: Product[] }[];
  bill: Record<string, number>;
  lines: { product: Product; qty: number; sum: number }[];
  total: number;
  setBill: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  function add(id: string, delta: number) {
    setBill((prev) => {
      const next = { ...prev };
      const qty = (next[id] || 0) + delta;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
      <div className="space-y-5">
        {grouped.map(({ category, items }) => {
          const available = items.filter((p) => p.active);
          if (available.length === 0) return null;
          return (
            <div key={category}>
              <h2 className="text-sm font-semibold text-brass uppercase tracking-wide mb-2">
                {CATEGORY_LABEL[category] || category}
              </h2>
              <div className="flex flex-wrap gap-2">
                {available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => add(p.id, 1)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      bill[p.id]
                        ? "border-emerald bg-emerald/20"
                        : "border-brass/20 bg-panel hover:border-brass/50"
                    }`}
                  >
                    <span className="block">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {fmtMoney(p.price)}
                      {p.unit ? ` · ${p.unit}` : ""}
                      {bill[p.id] ? ` · ×${bill[p.id]}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-brass/20 bg-panel p-4 lg:sticky lg:top-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Рахунок</h2>
          {lines.length > 0 && (
            <button onClick={() => setBill({})} className="text-xs text-muted hover:text-brass">
              Очистити
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted">Натискайте позиції зліва, щоб зібрати рахунок.</p>
        ) : (
          <div className="space-y-2">
            {lines.map(({ product, qty, sum }) => (
              <div key={product.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => add(product.id, -1)}
                    className="w-6 h-6 rounded-full border border-brass/30 leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{qty}</span>
                  <button
                    onClick={() => add(product.id, 1)}
                    className="w-6 h-6 rounded-full border border-brass/30 leading-none"
                  >
                    +
                  </button>
                </span>
                <span className="w-20 text-right tabular-nums">{fmtMoney(sum)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-brass/20 flex items-baseline justify-between">
          <span className="text-sm text-muted">Разом</span>
          <span className="text-xl font-extrabold text-brass tabular-nums">{fmtMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
