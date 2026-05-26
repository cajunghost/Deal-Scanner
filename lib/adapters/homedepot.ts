import type { Adapter, AdapterContext, Deal } from "../types";
import { fetchJson } from "../http";
import { percentOff } from "../filters";

// Home Depot exposes a "federation-gateway" GraphQL endpoint. The "Special Buys"
// + "Hot Deals" categories surface the deepest markdowns. We hit their public
// search endpoint with a clearance keyword and rank by percent off.

const HD_GQL = "https://www.homedepot.com/federation-gateway/graphql";

type HdProduct = {
  itemId: string;
  identifiers?: { productLabel?: string; canonicalUrl?: string };
  media?: { images?: { url?: string; type?: string }[] };
  pricing?: {
    value?: number;
    original?: number;
    promotion?: { description?: { shortDesc?: string } };
  };
  fulfillment?: {
    fulfillmentOptions?: {
      type?: string;
      services?: {
        type?: string;
        locations?: { isAnchor?: boolean; inventory?: { isInStock?: boolean } }[];
      }[];
    }[];
  };
};

type HdResp = {
  data?: { searchModel?: { products?: HdProduct[] } };
};

async function nearestStoreId(zip: string, timeoutMs: number): Promise<string> {
  // Public store-search endpoint used by HD.com's storefinder
  const url = `https://www.homedepot.com/StoreSearchServices/v2/storesearch?address=${encodeURIComponent(
    zip,
  )}&radius=50`;
  type Resp = { stores?: { storeId: string }[] };
  const json = await fetchJson<Resp>(url, { timeoutMs });
  const id = json.stores?.[0]?.storeId;
  if (!id) throw new Error("No Home Depot store found for ZIP");
  return id;
}

const QUERY = `query SearchModel($keyword:String,$storeId:String,$startIndex:Int,$pageSize:Int,$orderBy:ProductSort){
  searchModel(keyword:$keyword,storefilter:ALL,channel:DESKTOP,storeId:$storeId,startIndex:$startIndex,pageSize:$pageSize,orderBy:$orderBy){
    products{
      itemId
      identifiers{productLabel canonicalUrl}
      media{images{url type}}
      pricing(storeId:$storeId){value original promotion{description{shortDesc}}}
      fulfillment(storeId:$storeId){fulfillmentOptions{type services{type locations{isAnchor inventory{isInStock}}}}}
    }
  }
}`;

export const homeDepotAdapter: Adapter = {
  retailer: "homedepot",
  async scan(ctx: AdapterContext): Promise<Deal[]> {
    const storeId = await nearestStoreId(ctx.zip, ctx.timeoutMs);
    const body = {
      operationName: "SearchModel",
      query: QUERY,
      variables: {
        keyword: "clearance",
        storeId,
        startIndex: 0,
        pageSize: 48,
        orderBy: { field: "PERCENT_OFF", order: "DESC" },
      },
    };
    const json = await fetchJson<HdResp>(HD_GQL, {
      method: "POST",
      timeoutMs: ctx.timeoutMs,
      headers: {
        "content-type": "application/json",
        "x-experience-name": "general-merchandise",
        "x-thd-customer-token": "",
        referer: "https://www.homedepot.com/b/Special-Values/N-5yc1vZbm79",
      },
      body: JSON.stringify(body),
    });
    const products = json.data?.searchModel?.products ?? [];
    const deals: Deal[] = [];
    for (const p of products) {
      const sale = p.pricing?.value;
      const original = p.pricing?.original ?? p.pricing?.value;
      if (sale == null || original == null || original <= sale) continue;
      const pct = percentOff(original, sale);
      const img = p.media?.images?.find((i) => i.type === "IMAGE")?.url;
      const path =
        p.identifiers?.canonicalUrl ?? `/p/${p.itemId}`;
      const url = path.startsWith("http")
        ? path
        : `https://www.homedepot.com${path}`;
      const inStock = (p.fulfillment?.fulfillmentOptions ?? []).some((o) =>
        (o.services ?? []).some((s) =>
          (s.locations ?? []).some((l) => l.isAnchor && l.inventory?.isInStock),
        ),
      );
      deals.push({
        id: `homedepot:${p.itemId}`,
        retailer: "homedepot",
        title: p.identifiers?.productLabel ?? `Item ${p.itemId}`,
        image: img,
        originalPrice: original,
        salePrice: sale,
        percentOff: pct,
        inStock,
        storeId,
        productUrl: url,
        storeLocatorUrl: `https://www.homedepot.com/l/storeDirectory?storeId=${storeId}`,
      });
    }
    return deals;
  },
};
