import type { Adapter, AdapterContext, Deal, Retailer } from "../types";

// Sample data shown when an adapter is blocked or returns nothing. Each
// productUrl points at the retailer's REAL clearance category page so the
// click still lands on a useful page (not a fake product ID that 404s).
const CLEARANCE: Record<Retailer, string> = {
  target: "https://www.target.com/c/clearance/-/N-5q0ga",
  walmart: "https://www.walmart.com/shop/deals/clearance",
  homedepot: "https://www.homedepot.com/b/Savings-Center/N-5yc1vZ7n",
  lowes: "https://www.lowes.com/pl/Clearance/4294857524",
};

const SAMPLES: Record<Retailer, Omit<Deal, "id" | "productUrl" | "storeLocatorUrl">[]> = {
  target: [
    {
      retailer: "target",
      title: "Sample: Threshold 12-Cup Coffee Maker",
      originalPrice: 49.99,
      salePrice: 12.48,
      percentOff: 75,
      inStock: true,
      storeName: "Nearest Target",
    },
    {
      retailer: "target",
      title: "Sample: Cat & Jack Boys' Hoodie",
      originalPrice: 18.0,
      salePrice: 4.5,
      percentOff: 75,
      inStock: true,
      storeName: "Nearest Target",
    },
  ],
  walmart: [
    {
      retailer: "walmart",
      title: "Sample: Mainstays 6-Quart Stockpot",
      originalPrice: 24.97,
      salePrice: 6.0,
      percentOff: 76,
      inStock: true,
    },
  ],
  homedepot: [
    {
      retailer: "homedepot",
      title: "Sample: Husky 25 ft. Tape Measure (Clearance)",
      originalPrice: 19.97,
      salePrice: 5.0,
      percentOff: 75,
      inStock: true,
    },
  ],
  lowes: [
    {
      retailer: "lowes",
      title: "Sample: Allen + Roth Outdoor Pillow",
      originalPrice: 29.98,
      salePrice: 7.0,
      percentOff: 77,
      inStock: true,
    },
  ],
};

const STORE_LOCATOR: Record<Retailer, (zip: string) => string> = {
  target: (zip) => `https://www.target.com/store-locator/find-stores?address=${zip}`,
  walmart: (zip) => `https://www.walmart.com/store/finder?location=${zip}`,
  homedepot: (zip) => `https://www.homedepot.com/l/storeDirectory?searchZip=${zip}`,
  lowes: (zip) => `https://www.lowes.com/store?location=${zip}`,
};

export function mockAdapter(retailer: Retailer): Adapter {
  return {
    retailer,
    async scan(ctx: AdapterContext): Promise<Deal[]> {
      return SAMPLES[retailer].map((d, i) => ({
        ...d,
        id: `${retailer}:sample:${i}`,
        productUrl: CLEARANCE[retailer],
        storeLocatorUrl: STORE_LOCATOR[retailer](ctx.zip),
      }));
    },
  };
}
