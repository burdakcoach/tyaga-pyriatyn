"use client";

import { useEffect, useMemo, useState } from "react";
import { COAL_LABEL, STRENGTH_LABEL, STRENGTH_COLOR } from "@/lib/constants";
import type { FlavorDTO } from "@/types";

const MAX_MIX = 4;
const TIME_SLOTS = [
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00",
];

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function OrderPage() {
  const [flavors, setFlavors] = useState<FlavorDTO[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [coalType, setCoalType] = useState<"COCONUT" | "QUICKLIGHT" | "NONE">("COCONUT");
  const [pickupDate, setPickupDate] = useState(todayStr());
  const [pickupTime, setPickupTime] = useState("19:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/flavors")
      .then((r) => r.json())
      .then((d) => setFlavors(d.flavors));
  }, []);

  const filtered = useMemo(
    () => flavors.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [flavors, query]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_MIX) return prev;
      return [...prev, id];
    });
  }

  async function submitOrder() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          phone,
          pickupDate,
          pickupTime,
          coalType,
          comment,
          items: selected.map((flavorId) => ({ flavorId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Не вдалося оформити замовлення" });
      } else {
        setResult({ ok: true, message: "Замовлення прийнято! Ми зателефонуємо для підтвердження." });
        setSelected([]);
        setName("");
        setPhone("");
        setComment("");
      }
    } catch {
      setResult({ ok: false, message: "Помилка з'єднання. Спробуйте ще раз." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Забивка на самовивіз</h1>
      <p className="text-muted mb-8">
        Оберіть до {MAX_MIX} смаків для міксу, вугілля та зручний час — приготуємо до вашого приходу.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук смаку..."
        className="w-full rounded-full bg-panel border border-brass/20 px-4 py-2 text-sm mb-4 focus:outline-none focus:border-brass"
      />

      <div className="rounded-2xl border border-brass/20 bg-panel p-4 max-h-96 overflow-y-auto scrollbar-thin mb-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((f) => {
            const isSelected = selected.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  isSelected
                    ? "border-brass bg-brass/10"
                    : "border-brass/10 hover:border-brass/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{f.name}</span>
                  {f.strength && (
                    <span className={`text-[10px] rounded-full border px-1.5 py-0.5 shrink-0 ${STRENGTH_COLOR[f.strength]}`}>
                      {STRENGTH_LABEL[f.strength]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">{f.brandName}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm text-muted mb-8">
        Обрано {selected.length} / {MAX_MIX}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <label className="flex flex-col text-sm text-muted gap-1">
          Вугілля
          <select
            value={coalType}
            onChange={(e) => setCoalType(e.target.value as typeof coalType)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
          >
            {Object.entries(COAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-muted gap-1">
          Дата самовивозу
          <input
            type="date"
            min={todayStr()}
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
          />
        </label>
        <label className="flex flex-col text-sm text-muted gap-1">
          Час самовивозу
          <select
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="rounded-lg bg-panel border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-brass/20 bg-panel p-6 max-w-lg">
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
            onClick={submitOrder}
            disabled={submitting || !name.trim() || !phone.trim() || selected.length === 0}
            className="rounded-full bg-emerald hover:bg-emerald-light transition-colors px-6 py-3 font-semibold disabled:opacity-50"
          >
            {submitting ? "Надсилаємо..." : "Замовити забивку"}
          </button>
          {result && <p className={result.ok ? "text-emerald-light" : "text-red-400"}>{result.message}</p>}
        </div>
      </div>
    </div>
  );
}
