import type { Adapter, AdapterContext, Deal } from "../types";
import { fetchText } from "../http";
import { percentOff } from "../filters";
import { absoluteUrl } from "../url";

// Walmart sits behind Akamai/PerimeterX and changes their listing JSON shape
// often. We try several discount-sorted listings in order, stop as soon as
// we find products, and throw cleanly if all of them are blocked or empty
// so the API layer can substitute sample data.

const SOURCES = [
  "https://www.walmart.com/shop/deals/rollback?sort=high_discount",
  "https://www.walmart.com/shop/deals/clearance?sort=high_discount",
  "https://www.walmart.com/shop/deals?sort=high_discount",
];

type NextProduct = {
  usItemId?: string;
  name?: string;
  imageInfo?: { thumbnailUrl?: string };
  priceInfo?: {
    linePrice?: string;
    wasPrice?: string | { price?: number };
    currentPrice?: { price?: number } | string;
    listPrice?: { price?: number } | string;
  };
  canonicalUrl?: string;
  availabilityStatusV2?: { display?: string };
  availabilityStatus?: string;
};

function parseMoney(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  if (v && typeof v === "object" && "price" in v)
    return parseMoney((v as { price: unknown }).price);
  return undefined;
}

function extractNextData(html: string): unknown | null {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function findProducts(node: unknown, out: NextProduct[] = []): NextProduct[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const v of node) findProducts(v, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.usItemId === "string" && typeof obj.name === "string") {
    out.push(obj as NextProduct);
  }
  for (const v of Object.values(obj)) findProducts(v, out);
  return out;
}

function inStock(p: NextProduct): boolean {
  const s =
    p.availabilityStatusV2?.display ??
    p.availabilityStatus ??
    "";
  // Walmart returns IN_STOCK / OUT_OF_STOCK / LIMITED / NOT_AVAILABLE
  const v = String(s).toUpperCase();
  return v === "IN_STOCK" || v === "LIMITED" || v.includes("IN STOCK");
}

function toDeal(p: NextProduct): Deal | null {
  const sale =
    parseMoney(p.priceInfo?.currentPrice) ?? parseMoney(p.priceInfo?.linePrice);
  const original =
    parseMoney(p.priceInfo?.wasPrice) ?? parseMoney(p.priceInfo?.listPrice);
  if (sale == null || original == null || original <= sale) return null;
  const url =
    absoluteUrl("https://www.walmart.com", p.canonicalUrl) ??
    `https://www.walmart.com/ip/${p.usItemId}`;
  return {
    id: `walmart:${p.usItemId}`,
    retailer: "walmart",
    title: p.name ?? `Item ${p.usItemId}`,
    image: p.imageInfo?.thumbnailUrl,
    originalPrice: original,
    salePrice: sale,
    percentOff: percentOff(original, sale),
    inStock: inStock(p),
    productUrl: url,
  };
}

export const walmartAdapter: Adapter = {
  retailer: "walmart",
  async scan(ctx: AdapterContext): Promise<Deal[]> {
    let lastError: Error | null = null;
    for (const url of SOURCES) {
      try {
        const html = await fetchText(url, {
          timeoutMs: ctx.timeoutMs,
          headers: {
            cookie: `locationData={"postalCode":"${ctx.zip}","stateOrProvinceCode":"NA"}`,
          },
        });
        const data = extractNextData(html);
        if (!data) {
          lastError = new Error("Walmart page missing __NEXT_DATA__ (bot challenge?)");
          continue;
        }
        const products = findProducts(data);
        const deals = products
          .map(toDeal)
          .filter((d): d is Deal => d != null);
        if (deals.length > 0) {
          return deals.map((d) => ({
            ...d,
            storeLocatorUrl: `https://www.walmart.com/store/finder?location=${ctx.zip}`,
          }));
        }
        lastError = new Error(`Walmart ${new URL(url).pathname} returned no items with was/sale pricing`);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError ?? new Error("Walmart: no listing returned products");
  },
};
