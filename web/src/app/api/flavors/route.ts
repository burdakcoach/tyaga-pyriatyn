import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, flavors, brands } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strength = searchParams.get("strength");
  const brandId = searchParams.get("brandId");

  const rows = db
    .select({
      id: flavors.id,
      name: flavors.name,
      description: flavors.description,
      strength: flavors.strength,
      weightGrams: flavors.weightGrams,
      available: flavors.available,
      brandId: flavors.brandId,
      brandName: brands.name,
      imageUrl: flavors.imageUrl,
    })
    .from(flavors)
    .leftJoin(brands, eq(flavors.brandId, brands.id))
    .all();

  let result = rows.filter((r) => r.available);
  if (strength) result = result.filter((r) => r.strength === strength);
  if (brandId) result = result.filter((r) => r.brandId === brandId);

  result.sort((a, b) => (a.brandName || "").localeCompare(b.brandName || "") || a.name.localeCompare(b.name));

  return NextResponse.json({ flavors: result });
}
