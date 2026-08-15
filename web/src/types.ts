export type Strength = "LIGHT" | "MEDIUM" | "STRONG";

export type FlavorDTO = {
  id: string;
  name: string;
  description: string | null;
  strength: Strength | null;
  weightGrams: number | null;
  available: boolean;
  brandId: string | null;
  brandName: string | null;
  imageUrl: string | null;
};

export type BrandDTO = {
  id: string;
  name: string;
};

export type TableDTO = {
  id: string;
  number: number;
  zoneId: string;
  capacity: number;
  x: number;
  y: number;
  shape: string;
  active: boolean;
  isBooked?: boolean;
  /** На столику зараз відкритий чек — там сидять гості. */
  isOccupied?: boolean;
};

export type ZoneDTO = {
  id: string;
  name: string;
  sortOrder: number;
  tables: TableDTO[];
};
