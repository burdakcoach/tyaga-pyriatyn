"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Один тихий запит при завантаженні сторінки. Дедуплікація живе на сервері
// (унікальний індекс день+відвідувач), тому повторні виклики — наприклад, від
// React Strict Mode у розробці — нічого не псують.
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Адмінку не рахуємо — це власник, а не гість.
    if (pathname?.startsWith("/admin")) return;

    // keepalive, щоб запит устиг піти навіть якщо людина одразу закриє вкладку.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      // Лічильник — річ другорядна: якщо не долетіло, сайт має працювати далі.
    });
  }, [pathname]);

  return null;
}
