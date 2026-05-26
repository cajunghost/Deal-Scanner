import type { Adapter, AdapterContext, Deal, Retailer } from "../types";

// Mock data so the UI is usable when adapters are blocked.
// Activated by DEAL_SCANNER_MOCK=1 or when every real adapter errors.
const SAMPLES: Record<Retailer, Omit<Deal, "id" | "storeLocatorUrl">[]> = {
  target: [
    {
      retailer: "target",
      title: "Threshold 12-Cup Coffee Maker",
      image: "https://target.scene7.com/is/image/Target/GUEST_demo_coffee",
      originalPrice: 49.99,
      salePrice: 12.48,
      percentOff: 75,
      inStock: true,
      storeName: "Target Anytown",
      productUrl: "https://www.target.com/p/-/A-12345678",
    },
    {
      retailer: "target",
      title: "Cat & Jack Boys' Hoodie",
      originalPrice: 18.0,
      salePrice: 4.5,
      percentOff: 75,
      inStock: true,
      storeName: "Target Anytown",
      productUrl: "https://www.target.com/p/-/A-87654321",
    },
  ],
  walmart: [
    {
      retailer: "walmart",
      title: "Mainstays 6-Quart Stockpot",
      originalPrice: 24.97,
      salePrice: 6.0,
      percentOff: 76,
      inStock: true,
      productUrl: "https://www.walmart.com/ip/000000000",
    },
  ],
  homedepot: [
    {
      retailer: "homedepot",
      title: "Husky 25 ft. Tape Measure (Clearance)",
      originalPrice: 19.97,
      salePrice: 5.0,
      percentOff: 75,
      inStock: true,
      productUrl: "https://www.homedepot.com/p/000000000",
    },
  ],
  lowes: [
    {
      retailer: "lowes",
      title: "Allen + Roth Outdoor Pillow",
      originalPrice: 29.98,
      salePrice: 7.0,
      percentOff: 77,
      inStock: true,
      productUrl: "https://www.lowes.com/pd/000000000",
    },
  ],
};

export function mockAdapter(retailer: Retailer): Adapter {
  return {
    retailer,
    async scan(ctx: AdapterContext): Promise<Deal[]> {
      return SAMPLES[retailer].map((d, i) => ({
        ...d,
        id: `${retailer}:mock:${i}`,
        storeLocatorUrl:
          retailer === "target"
            ? `https://www.target.com/store-locator/find-stores?address=${ctx.zip}`
            : retailer === "walmart"
              ? `https://www.walmart.com/store/finder?location=${ctx.zip}`
              : retailer === "homedepot"
                ? `https://www.homedepot.com/l/storeDirectory?searchZip=${ctx.zip}`
                : `https://www.lowes.com/store?location=${ctx.zip}`,
      }));
    },
  };
}
