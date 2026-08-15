"use client";

import { useEffect, useState, useCallback } from "react";
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

const TABS = [
  { key: "bookings", label: "Бронювання" },
  { key: "orders", label: "Забивки на самовиви" },
  { key: "home", label: "Кальян додому" },
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

function fmtDate(iso: string) {
  return iso;
}

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [homeOrders, setHomeOrders] = useState<HomeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/bookings").then((r) => r.json()),
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/admin/home-orders").then((r) => r.json()),
    ])
      .then(([b, o, h]) => {
        setBookings(b.bookings || []);
        setOrders(o.orders || []);
        setHomeOrders(h.homeOrders || []);
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

  const pendingCounts = {
    bookings: bookings.filter((b) => b.status === "PENDING").length,
    orders: orders.filter((o) => o.status === "PENDING").length,
    home: homeOrders.filter((h) => h.status === "PENDING").length,
  };

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
        </>
      )}
    </div>
  );
}
