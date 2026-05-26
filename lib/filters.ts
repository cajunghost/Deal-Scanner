import type { Deal } from "./types";

export function percentOff(original: number, sale: number): number {
  if (!original || original <= 0 || sale < 0) return 0;
  return Math.round(((original - sale) / original) * 100);
}

export function applyFilters(
  deals: Deal[],
  opts: { minPercentOff: number; inStockOnly: boolean },
): Deal[] {
  return deals
    .filter((d) => d.percentOff >= opts.minPercentOff)
    .filter((d) => (opts.inStockOnly ? d.inStock : true))
    .sort((a, b) => b.percentOff - a.percentOff);
}
