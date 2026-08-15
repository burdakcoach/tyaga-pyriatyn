"use client";

import { useState } from "react";
import Image from "next/image";

const TIME_SLOTS = [
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

const THESES = [
  {
    title: "Привозимо будь-куди",
    text: "Додому, на пікнік, у наметове містечко чи на подію просто неба — повний кальян-сетап їде до вас.",
  },
  {
    title: "92 смаки на вибір",
    text: "Обирайте улюблений тютюн з нашого каталогу або довіртесь нам зібрати мікс під настрій.",
  },
  {
    title: "Все вже враховано",
    text: "Кальян, вугілля, аксесуари — все приїжджає готовим. Вам залишається тільки насолоджуватись.",
  },
  {
    title: "Для будь-якого приводу",
    text: "День народження, корпоратив чи просто затишний вечір з друзями — підлаштуємось під формат.",
  },
];

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function DeliveryPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [eventDate, setEventDate] = useState(todayStr());
  const [eventTime, setEventTime] = useState("19:00");
  const [guests, setGuests] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submitRequest() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/home-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          phone,
          address,
          eventDate,
          eventTime,
          guests: guests ? parseInt(guests, 10) : undefined,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Не вдалося надіслати заявку" });
      } else {
        setResult({ ok: true, message: "Заявку прийнято! Ми зателефонуємо, щоб узгодити деталі." });
        setName("");
        setPhone("");
        setAddress("");
        setGuests("");
        setComment("");
      }
    } catch {
      setResult({ ok: false, message: "Помилка з'єднання. Спробуйте ще раз." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">Кальян додому</h1>
        <p className="text-muted max-w-2xl">
          Привозимо атмосферу Tyaga туди, де зручно вам — і це не обов&apos;язково стіни лаунжу.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-4 sm:grid-cols-3 mb-12">
        <div className="relative rounded-2xl overflow-hidden border border-brass/20 h-72 sm:h-[420px] sm:col-span-2 sm:row-span-2">
          <Image src="/delivery/delivery-1.jpg" alt="Кальян на природі біля наметового містечка" fill className="object-cover" />
        </div>
        <div className="relative rounded-2xl overflow-hidden border border-brass/20 h-56">
          <Image src="/delivery/delivery-2.jpg" alt="Два кальяни на вечірньому сонці" fill className="object-cover" />
        </div>
        <div className="relative rounded-2xl overflow-hidden border border-brass/20 h-56">
          <Image src="/delivery/delivery-3.jpg" alt="Кальяни біля шезлонгів" fill className="object-cover" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-4 sm:grid-cols-2 mb-16">
        {THESES.map((t) => (
          <div key={t.title} className="rounded-2xl border border-brass/20 bg-panel p-5">
            <h3 className="font-bold mb-1 text-brass">{t.title}</h3>
            <p className="text-sm text-muted">{t.text}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="rounded-2xl border border-brass/20 bg-panel p-6 sm:p-8 max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-1">Замовити кальян додому</h2>
          <p className="text-sm text-muted mb-6">
            Залиште заявку — передзвонимо, щоб узгодити смаки й деталі.
          </p>
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
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адреса або місце (наприклад: Пирятин, вул. ..., або опис локації)"
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col text-sm text-muted gap-1">
                Дата
                <input
                  type="date"
                  min={todayStr()}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
                />
              </label>
              <label className="flex flex-col text-sm text-muted gap-1">
                Час
                <select
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              value={guests}
              onChange={(e) => setGuests(e.target.value.replace(/\D/g, ""))}
              placeholder="Кількість гостей (необов'язково)"
              inputMode="numeric"
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Побажання щодо смаків, привід, коментар (необов'язково)"
              rows={3}
              className="rounded-lg bg-background border border-brass/20 px-3 py-2 focus:outline-none focus:border-brass"
            />
            <button
              onClick={submitRequest}
              disabled={submitting || !name.trim() || !phone.trim() || !address.trim()}
              className="rounded-full bg-emerald hover:bg-emerald-light transition-colors px-6 py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? "Надсилаємо..." : "Замовити"}
            </button>
            {result && (
              <p className={result.ok ? "text-emerald-light" : "text-red-400"}>{result.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
