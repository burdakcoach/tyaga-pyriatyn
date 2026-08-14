"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ZoneDTO, TableDTO } from "@/types";

const ZONE_BG: Record<string, string> = {
  "Смарагдова кімната": "/interior/lounge-1.jpg",
  Тераса: "/interior/terrace-1.jpg",
};

const TIME_SLOTS = [
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00",
];

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function BookingPage() {
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("19:00");
  const [guests, setGuests] = useState(2);
  const [selectedTable, setSelectedTable] = useState<TableDTO | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function loadZones() {
    const res = await fetch(`/api/zones?date=${date}&time=${time}`);
    const data = await res.json();
    setZones(data.zones);
    if (!activeZoneId && data.zones[0]) setActiveZoneId(data.zones[0].id);
  }

  // Refetch table availability whenever the chosen date/time changes, and drop
  // any previously selected table since it may no longer be valid for the new slot.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting selection on filter change is intentional here
    setSelectedTable(null);
    void loadZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time]);

  const activeZone = zones.find((z) => z.id === activeZoneId);

  async function submitBooking() {
    if (!selectedTable) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableSpotId: selectedTable.id,
          customerName: name,
          phone,
          date,
          timeSlot: time,
          guests,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Не вдалося забронювати" });
      } else {
        setResult({ ok: true, message: "Столик заброньовано! Ми зв'яжемось для підтвердження." });
        setSelectedTable(null);
        setName("");
        setPhone("");
        setComment("");
        loadZones();
      }
    } catch {
      setResult({ ok: false, message: "Помилка з'єднання. Спробуйте ще раз." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Бронювання столика</h1>
      <p className="text-muted mb-8">Оберіть дату, час і місце на схемі залу</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <label className="flex flex-col text-sm text-muted gap-1">
          Дата
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
          />
        </label>
        <label className="flex flex-col text-sm text-muted gap-1">
          Час
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-muted gap-1">
          Гостей
          <input
            type="number"
            min={1}
            max={12}
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 w-24 focus:outline-none focus:border-brass"
          />
        </label>
      </div>

      <div className="flex gap-2 mb-4">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => {
              setActiveZoneId(z.id);
              setSelectedTable(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
              activeZoneId === z.id
                ? "bg-emerald border-emerald text-foreground"
                : "border-brass/30 text-muted hover:text-brass"
            }`}
          >
            {z.name}
          </button>
        ))}
      </div>

      {activeZone && (
        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-brass/20 mb-8">
          <Image
            src={ZONE_BG[activeZone.name] || "/interior/lounge-1.jpg"}
            alt={activeZone.name}
            fill
            className="object-cover brightness-[0.55]"
          />
          {activeZone.tables.map((t) => {
            const disabled = t.isBooked || guests > t.capacity;
            const isSelected = selectedTable?.id === t.id;
            return (
              <button
                key={t.id}
                disabled={disabled}
                onClick={() => setSelectedTable(t)}
                title={`Столик №${t.number} · до ${t.capacity} гостей`}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center rounded-full w-16 h-16 sm:w-20 sm:h-20 border-2 text-xs sm:text-sm font-bold transition-all ${
                  disabled
                    ? "bg-black/40 border-white/10 text-muted/60 cursor-not-allowed"
                    : isSelected
                    ? "bg-brass border-brass text-background scale-110 shadow-lg shadow-brass/40"
                    : "bg-emerald/80 border-emerald-light hover:scale-105 hover:bg-emerald-light"
                }`}
              >
                <span>№{t.number}</span>
                <span className="opacity-80">{t.capacity} міс.</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted mb-8">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald/80 border border-emerald-light inline-block" /> вільно
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-brass border border-brass inline-block" /> обрано
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-black/40 border border-white/10 inline-block" /> зайнято / замало місць
        </span>
      </div>

      {selectedTable && (
        <div className="rounded-2xl border border-brass/20 bg-panel p-6 max-w-lg">
          <h2 className="font-bold text-lg mb-4">
            Столик №{selectedTable.number} · {date} о {time}
          </h2>
          <div className="grid gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше ім'я"
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон"
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Коментар (необов'язково)"
              rows={2}
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <button
              onClick={submitBooking}
              disabled={submitting || !name.trim() || !phone.trim()}
              className="rounded-full bg-emerald hover:bg-emerald-light transition-colors px-6 py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? "Надсилаємо..." : "Забронювати"}
            </button>
            {result && (
              <p className={result.ok ? "text-emerald-light" : "text-red-400"}>{result.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
