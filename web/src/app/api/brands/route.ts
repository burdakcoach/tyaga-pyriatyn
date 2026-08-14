import { NextResponse } from "next/server";
import { db, brands } from "@/lib/db";

export async function GET() {
  const rows = db.select().from(brands).all();
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ brands: rows });
}
