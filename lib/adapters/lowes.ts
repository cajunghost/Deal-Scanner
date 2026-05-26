import type { Adapter, AdapterContext, Deal } from "../types";
import { fetchText } from "../http";
import { percentOff } from "../filters";

// Lowe's clearance category page. Like Walmart, this is bot-challenged often.
// We parse server-rendered product JSON embedded as <script type="application/ld+json">.

const CLEARANCE_URL = "https://www.lowes.com/pl/Clearance/4294857524";

type LdProduct = {
  "@type"?: string;
  name?: string;
  image?: string | string[];
  sku?: string;
  url?: string;
  offers?: {
    "@type"?: string;
    price?: number | string;
    priceSpecification?: { price?: number; referencePrice?: number }[];
    availability?: string;
  };
};

function extractLd(html: string): LdProduct[] {
  const out: LdProduct[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const x of arr) {
        if (x?.["@type"] === "Product") out.push(x);
        if (Array.isArray(x?.itemListElement)) {
          for (const el of x.itemListElement) {
            if (el?.item?.["@type"] === "Product") out.push(el.item);
          }
        }
      }
    } catch {
      // skip malformed block
    }
  }
  return out;
}

export const lowesAdapter: Adapter = {
  retailer: "lowes",
  async scan(ctx: AdapterContext): Promise<Deal[]> {
    const html = await fetchText(CLEARANCE_URL, {
      timeoutMs: ctx.timeoutMs,
      headers: {
        cookie: `sn=0595;zip=${ctx.zip}`,
      },
    });
    const items = extractLd(html);
    if (items.length === 0)
      throw new Error("Lowe's did not return product data (likely bot-blocked)");
    const deals: Deal[] = [];
    for (const it of items) {
      const sale =
        typeof it.offers?.price === "string"
          ? Number(it.offers.price)
          : it.offers?.price;
      const original = it.offers?.priceSpecification?.[0]?.referencePrice;
      if (sale == null || original == null || original <= sale) continue;
      const pct = percentOff(original, sale);
      const img = Array.isArray(it.image) ? it.image[0] : it.image;
      deals.push({
        id: `lowes:${it.sku ?? it.url ?? it.name}`,
        retailer: "lowes",
        title: it.name ?? "Lowe's item",
        image: img,
        originalPrice: original,
        salePrice: sale,
        percentOff: pct,
        inStock:
          (it.offers?.availability ?? "").toLowerCase().includes("instock"),
        productUrl: it.url ?? CLEARANCE_URL,
        storeLocatorUrl: `https://www.lowes.com/store?location=${ctx.zip}`,
      });
    }
    return deals;
  },
};
