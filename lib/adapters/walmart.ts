import type { Adapter, AdapterContext, Deal } from "../types";
import { fetchText } from "../http";
import { percentOff } from "../filters";

// Walmart's GraphQL endpoints are heavily protected (Akamai + PerimeterX).
// The most reliable browser-free approach is to fetch their server-rendered
// clearance/flash-picks listing pages and parse the inline __NEXT_DATA__ JSON.
// This will fail when the page is bot-challenged; we surface a clean error
// and let the API layer mark the retailer as degraded.

const CLEARANCE_URL =
  "https://www.walmart.com/shop/deals/flash-deals?sort=price_low";

type NextProduct = {
  usItemId?: string;
  name?: string;
  imageInfo?: { thumbnailUrl?: string };
  priceInfo?: {
    linePrice?: string;
    wasPrice?: string;
    currentPrice?: { price?: number };
    listPrice?: { price?: number };
  };
  canonicalUrl?: string;
  availabilityStatusV2?: { display?: string };
};

function parseMoney(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function extractNextData(html: string): unknown {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("Walmart did not return product data (likely bot-blocked)");
  return JSON.parse(m[1]);
}

function findProducts(node: unknown, out: NextProduct[] = []): NextProduct[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const v of node) findProducts(v, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (
    typeof obj.usItemId === "string" &&
    typeof obj.name === "string" &&
    obj.priceInfo
  ) {
    out.push(obj as NextProduct);
  }
  for (const v of Object.values(obj)) findProducts(v, out);
  return out;
}

export const walmartAdapter: Adapter = {
  retailer: "walmart",
  async scan(ctx: AdapterContext): Promise<Deal[]> {
    const html = await fetchText(CLEARANCE_URL, {
      timeoutMs: ctx.timeoutMs,
      headers: {
        cookie: `locationData={"postalCode":"${ctx.zip}","stateOrProvinceCode":"NA"}`,
      },
    });
    const data = extractNextData(html);
    const products = findProducts(data);
    const deals: Deal[] = [];
    for (const p of products) {
      const sale =
        p.priceInfo?.currentPrice?.price ?? parseMoney(p.priceInfo?.linePrice);
      const original =
        p.priceInfo?.listPrice?.price ?? parseMoney(p.priceInfo?.wasPrice);
      if (sale == null || original == null) continue;
      const pct = percentOff(original, sale);
      const url = p.canonicalUrl
        ? `https://www.walmart.com${p.canonicalUrl}`
        : `https://www.walmart.com/ip/${p.usItemId}`;
      deals.push({
        id: `walmart:${p.usItemId}`,
        retailer: "walmart",
        title: p.name ?? `Item ${p.usItemId}`,
        image: p.imageInfo?.thumbnailUrl,
        originalPrice: original,
        salePrice: sale,
        percentOff: pct,
        inStock:
          (p.availabilityStatusV2?.display ?? "").toLowerCase() ===
            "in stock" || true,
        productUrl: url,
        storeLocatorUrl: `https://www.walmart.com/store/finder?location=${ctx.zip}`,
      });
    }
    return deals;
  },
};
