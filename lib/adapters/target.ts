import type { Adapter, AdapterContext, Deal } from "../types";
import { fetchJson } from "../http";
import { percentOff } from "../filters";

const REDSKY_KEY =
  process.env.TARGET_REDSKY_KEY || "9f36aeafbe60771e321a7cc95a78140772ab3e96";

// Clearance category on Target.com is "5xtg6"; can also use category "5xt1a"
// (Top Deals). We prefer clearance for true markdowns.
const CLEARANCE_CATEGORY = "5xtg6";

async function findNearestStoreId(zip: string, timeoutMs: number): Promise<string> {
  // Public store-locator endpoint used by target.com/store-locator/find-stores
  const url = new URL(
    "https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1",
  );
  url.searchParams.set("key", REDSKY_KEY);
  url.searchParams.set("limit", "1");
  url.searchParams.set("within", "50");
  url.searchParams.set("place", zip);
  type Resp = {
    data?: { nearby_stores?: { stores?: { store_id: string }[] } };
  };
  const json = await fetchJson<Resp>(url.toString(), { timeoutMs });
  const id = json.data?.nearby_stores?.stores?.[0]?.store_id;
  if (!id) throw new Error("No Target store found for ZIP");
  return id;
}

type PlpItem = {
  tcin: string;
  title?: string;
  images?: { primary_image_url?: string };
  enrichment?: { buy_url?: string; images?: { primary_image_url?: string } };
  price?: {
    current_retail?: number;
    reg_retail?: number;
    formatted_current_price?: string;
  };
  fulfillment?: {
    is_out_of_stock_in_all_store_locations?: boolean;
    shipping_options?: { availability_status?: string };
    store_options?: {
      location_name?: string;
      location_id?: string;
      in_store_only?: { availability_status?: string };
      order_pickup?: { availability_status?: string };
    }[];
  };
};

type PlpResponse = {
  data?: {
    search?: {
      products?: PlpItem[];
      search_response?: { items?: { Item?: PlpItem[] } };
    };
  };
};

async function fetchClearancePage(
  storeId: string,
  offset: number,
  count: number,
  timeoutMs: number,
): Promise<PlpItem[]> {
  const url = new URL(
    "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2",
  );
  url.searchParams.set("key", REDSKY_KEY);
  url.searchParams.set("category", CLEARANCE_CATEGORY);
  url.searchParams.set("channel", "WEB");
  url.searchParams.set("count", String(count));
  url.searchParams.set("default_purchasability_filter", "true");
  url.searchParams.set("include_dmc_dmr", "true");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("page", `/c/${CLEARANCE_CATEGORY}`);
  url.searchParams.set("platform", "desktop");
  url.searchParams.set("pricing_store_id", storeId);
  url.searchParams.set("scheduled_delivery_store_id", storeId);
  url.searchParams.set("store_ids", storeId);
  url.searchParams.set("visitor_id", process.env.TARGET_VISITOR_ID || randomVisitorId());
  url.searchParams.set("zip", "");
  url.searchParams.set("useragent", "Mozilla/5.0");
  // sort by percent off, descending
  url.searchParams.set("sort_by", "PercentOffDescending");

  const json = await fetchJson<PlpResponse>(url.toString(), {
    timeoutMs,
    headers: { referer: `https://www.target.com/c/${CLEARANCE_CATEGORY}` },
  });
  return (
    json.data?.search?.products ??
    json.data?.search?.search_response?.items?.Item ??
    []
  );
}

function randomVisitorId(): string {
  // 32 hex chars, matches Target's visitor_id format
  const chars = "0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function inStockAt(item: PlpItem, storeId: string): boolean {
  const opts = item.fulfillment?.store_options ?? [];
  const here = opts.find((o) => o.location_id === storeId) ?? opts[0];
  const a = here?.in_store_only?.availability_status;
  const b = here?.order_pickup?.availability_status;
  return a === "IN_STOCK" || b === "IN_STOCK";
}

function toDeal(item: PlpItem, storeId: string): Deal | null {
  const sale = item.price?.current_retail;
  const original = item.price?.reg_retail;
  if (sale == null || original == null) return null;
  const pct = percentOff(original, sale);
  const opts = item.fulfillment?.store_options ?? [];
  const here = opts.find((o) => o.location_id === storeId) ?? opts[0];
  const productPath =
    item.enrichment?.buy_url || `https://www.target.com/p/-/A-${item.tcin}`;
  return {
    id: `target:${item.tcin}`,
    retailer: "target",
    title: item.title ?? `TCIN ${item.tcin}`,
    image:
      item.enrichment?.images?.primary_image_url ||
      item.images?.primary_image_url,
    originalPrice: original,
    salePrice: sale,
    percentOff: pct,
    inStock: inStockAt(item, storeId),
    storeId,
    storeName: here?.location_name,
    productUrl: productPath,
    storeLocatorUrl: `https://www.target.com/store-locator/find-stores?id=${storeId}`,
  };
}

export const targetAdapter: Adapter = {
  retailer: "target",
  async scan(ctx: AdapterContext): Promise<Deal[]> {
    const storeId = await findNearestStoreId(ctx.zip, ctx.timeoutMs);
    const pageSize = 24;
    const pages = 3; // 72 items, plenty to filter down to 70%+
    const all: PlpItem[] = [];
    for (let i = 0; i < pages; i++) {
      const items = await fetchClearancePage(
        storeId,
        i * pageSize,
        pageSize,
        ctx.timeoutMs,
      );
      if (items.length === 0) break;
      all.push(...items);
    }
    return all
      .map((it) => toDeal(it, storeId))
      .filter((d): d is Deal => d != null);
  },
};
