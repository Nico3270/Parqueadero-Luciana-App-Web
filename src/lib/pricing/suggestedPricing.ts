// src/lib/pricing/suggestedPricing.ts
export type VehicleType = "CAR" | "MOTO" | "TRUCK" | "BUS" | "TRACTOMULA" | "OTHER";

export type PricingTier = {
  /** inclusive lower bound in minutes */
  minMinutes: number;
  /** inclusive upper bound in minutes (use Infinity for open end) */
  maxMinutes: number;
  amount: number; // COP
  label: string;
};

export type SuggestedPriceResult = {
  vehicleType: VehicleType;
  /** total minutes rounded up (ceil) */
  durationMinutes: number;
  /** human label e.g. "5 h 25 min" */
  durationLabel: string;
  /** suggested amount in COP */
  suggestedAmount: number;
  /** which tier matched */
  tierLabel: string;
};

const MIN = 1;
const HOUR = 60;

const TIERS_CAR: PricingTier[] = [
  { minMinutes: MIN, maxMinutes: HOUR, amount: 3000, label: "1 hora" },
  { minMinutes: HOUR + 1, maxMinutes: 12 * HOUR, amount: 6000, label: "2–12 horas" },
  { minMinutes: 12 * HOUR + 1, maxMinutes: 24 * HOUR, amount: 10000, label: "12–24 horas" },
];

const TIERS_MOTO: PricingTier[] = [
  { minMinutes: MIN, maxMinutes: HOUR, amount: 2000, label: "1 hora" },
  { minMinutes: HOUR + 1, maxMinutes: 12 * HOUR, amount: 4000, label: "2–12 horas" },
  { minMinutes: 12 * HOUR + 1, maxMinutes: 24 * HOUR, amount: 7000, label: "12–24 horas" },
];

const TIERS_HEAVY: PricingTier[] = [
  { minMinutes: MIN, maxMinutes: HOUR, amount: 5000, label: "1 hora" },
  { minMinutes: HOUR + 1, maxMinutes: 12 * HOUR, amount: 8000, label: "2–12 horas" },
  { minMinutes: 12 * HOUR + 1, maxMinutes: 24 * HOUR, amount: 14000, label: "12–24 horas" },
];

const TIERS_TRACTO: PricingTier[] = [
  { minMinutes: MIN, maxMinutes: HOUR, amount: 6000, label: "1 hora" },
  { minMinutes: HOUR + 1, maxMinutes: 12 * HOUR, amount: 12000, label: "2–12 horas" },
  { minMinutes: 12 * HOUR + 1, maxMinutes: 24 * HOUR, amount: 20000, label: "12–24 horas" },
];

function tiersFor(type: VehicleType): PricingTier[] {
  if (type === "CAR") return TIERS_CAR;
  if (type === "MOTO") return TIERS_MOTO;
  if (type === "TRACTOMULA") return TIERS_TRACTO;
  // Camiones, buses y otros → HEAVY
  return TIERS_HEAVY;
}

export function formatDurationFromMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Suggested pricing:
 * - durationMinutes is rounded up to the next minute (ceil)
 * - tiers are inclusive at both ends, based on the ranges you gave
 * - if > 24h, we charge multiple 24h blocks + remainder tiers
 */
export function getSuggestedPrice(params: {
  vehicleType: VehicleType;
  entryAt: Date;
  exitAt: Date;
}): SuggestedPriceResult {
  const { vehicleType, entryAt, exitAt } = params;

  const diffMs = exitAt.getTime() - entryAt.getTime();
  const rawMinutes = diffMs <= 0 ? 0 : Math.ceil(diffMs / 60000);
  const durationMinutes = Math.max(0, rawMinutes);

  // If duration is 0 (edge case): treat as 1 minute
  const billableMinutes = durationMinutes === 0 ? 1 : durationMinutes;

  const tiers = tiersFor(vehicleType);

  // helper: find tier for minutes within 1..24h
  const matchTier = (mins: number) => {
    const clamped = Math.min(Math.max(mins, 1), 24 * 60);
    return (
      tiers.find((t) => clamped >= t.minMinutes && clamped <= t.maxMinutes) ??
      tiers[tiers.length - 1]
    );
  };

  // Pricing for >24h:
  // - compute full 24h blocks
  // - each full 24h block costs the 12–24 tier amount
  // - remainder uses tier matching within 24h
  const dayMinutes = 24 * 60;
  const fullDays = Math.floor((billableMinutes - 1) / dayMinutes); // 0..N
  const remainderMinutes = billableMinutes - fullDays * dayMinutes;

  const dayTier = matchTier(dayMinutes);
  const remainderTier = matchTier(remainderMinutes);

  const suggestedAmount =
    fullDays > 0 ? fullDays * dayTier.amount + remainderTier.amount : remainderTier.amount;

  return {
    vehicleType,
    durationMinutes,
    durationLabel: formatDurationFromMinutes(durationMinutes),
    suggestedAmount,
    tierLabel:
      fullDays > 0
        ? `${fullDays}×(12–24 horas) + ${remainderTier.label}`
        : remainderTier.label,
  };
}