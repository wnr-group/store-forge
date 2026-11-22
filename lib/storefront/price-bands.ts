/**
 * Price filter bands for a product list, worked out from the list itself (never hardcoded), so a store selling saris at
 * 40,000 and a store selling tea at 300 each get sensible chips. Amounts are minor units; thresholds are rounded to
 * "nice" whole numbers in the major unit (1, 2, 2.5, 5 times a power of ten).
 */

export type PriceBand = { id: string; minMinor: number | null; maxMinor: number | null };

const MIN_PRODUCTS = 6;
const MIN_DISTINCT = 4;

/** Rounds a positive amount to a nice number (1, 2, 2.5, 5, 10 x 10^n), going to the nearest. */
export function niceNumber(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const scaled = value / magnitude;
  let best = steps[0];
  for (const s of steps) if (Math.abs(s - scaled) < Math.abs(best - scaled)) best = s;
  return best * magnitude;
}

/**
 * Up to four bands (under, two middles, above) cutting the list at its quartiles. Returns [] when the list is too small
 * or too uniform for a price filter to be useful.
 */
export function priceBands(pricesMinor: number[], digits = 2): PriceBand[] {
  const prices = pricesMinor.filter((p) => Number.isFinite(p) && p >= 0).sort((a, b) => a - b);
  if (prices.length < MIN_PRODUCTS || new Set(prices).size < MIN_DISTINCT) return [];
  const unit = 10 ** digits;
  const at = (q: number) => prices[Math.min(prices.length - 1, Math.floor(q * prices.length))];
  const cuts = [...new Set([0.25, 0.5, 0.75].map((q) => Math.round(niceNumber(at(q) / unit) * unit)))].filter((c) => c > prices[0] && c <= prices[prices.length - 1]).sort((a, b) => a - b);
  if (cuts.length === 0) return [];
  const bands: PriceBand[] = [{ id: "b0", minMinor: null, maxMinor: cuts[0] }];
  for (let i = 0; i < cuts.length - 1; i++) bands.push({ id: `b${i + 1}`, minMinor: cuts[i], maxMinor: cuts[i + 1] });
  bands.push({ id: `b${cuts.length}`, minMinor: cuts[cuts.length - 1], maxMinor: null });
  return bands;
}

/** True when a price falls in the band: from `minMinor` up to, but not including, `maxMinor`. */
export const inBand = (priceMinor: number, band: PriceBand): boolean => (band.minMinor === null || priceMinor >= band.minMinor) && (band.maxMinor === null || priceMinor < band.maxMinor);
