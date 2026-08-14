"use client";

import { useEffect, useMemo, useState } from "react";
import { STRENGTH_LABEL, STRENGTH_COLOR } from "@/lib/constants";
import type { BrandDTO, FlavorDTO, Strength } from "@/types";

const STRENGTHS: Strength[] = ["LIGHT", "MEDIUM", "STRONG"];

export default function MenuPage() {
  const [flavors, setFlavors] = useState<FlavorDTO[]>([]);
  const [brands, setBrands] = useState<BrandDTO[]>([]);
  const [strength, setStrength] = useState<Strength | "ALL">("ALL");
  const [brandId, setBrandId] = useState<string | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/flavors").then((r) => r.json()),
      fetch("/api/brands").then((r) => r.json()),
    ])
      .then(([f, b]) => {
        setFlavors(f.flavors);
        setBrands(b.brands);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return flavors.filter((f) => {
      if (strength !== "ALL" && f.strength !== strength) return false;
      if (brandId !== "ALL" && f.brandId !== brandId) return false;
      if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [flavors, strength, brandId, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, FlavorDTO[]>();
    for (const f of filtered) {
      const key = f.brandName || "Інше";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Каталог смаків</h1>
      <p className="text-muted mb-8">{flavors.length} позицій · фільтруйте за брендом і міцністю</p>

      <div className="flex flex-wrap gap-3 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук за назвою..."
          className="rounded-full bg-panel border border-brass/20 px-4 py-2 text-sm min-w-48 focus:outline-none focus:border-brass"
        />
        <select
          value={strength}
          onChange={(e) => setStrength(e.target.value as Strength | "ALL")}
          className="rounded-full bg-panel border border-brass/20 px-4 py-2 text-sm focus:outline-none focus:border-brass"
        >
          <option value="ALL">Уся міцність</option>
          {STRENGTHS.map((s) => (
            <option key={s} value={s}>
              {STRENGTH_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="rounded-full bg-panel border border-brass/20 px-4 py-2 text-sm focus:outline-none focus:border-brass"
        >
          <option value="ALL">Усі бренди</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted">Завантаження...</p>
      ) : grouped.length === 0 ? (
        <p className="text-muted">Нічого не знайдено за цими фільтрами.</p>
      ) : (
        <div className="space-y-10">
          {grouped.map(([brandName, items]) => (
            <div key={brandName}>
              <h2 className="text-xl font-bold mb-4 text-brass">{brandName}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-brass/20 bg-panel p-4 hover:border-brass/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold leading-snug">{f.name}</h3>
                      {f.strength && (
                        <span
                          className={`shrink-0 text-xs rounded-full border px-2 py-0.5 ${STRENGTH_COLOR[f.strength]}`}
                        >
                          {STRENGTH_LABEL[f.strength]}
                        </span>
                      )}
                    </div>
                    {f.description && <p className="text-sm text-muted">{f.description}</p>}
                    {f.weightGrams && (
                      <p className="text-xs text-muted/70 mt-2">{f.weightGrams} г</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
