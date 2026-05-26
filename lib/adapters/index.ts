import type { Adapter, Retailer } from "../types";
import { targetAdapter } from "./target";
import { walmartAdapter } from "./walmart";
import { homeDepotAdapter } from "./homedepot";
import { lowesAdapter } from "./lowes";
import { mockAdapter } from "./mock";

export function getAdapter(retailer: Retailer): Adapter {
  if (process.env.DEAL_SCANNER_MOCK === "1") return mockAdapter(retailer);
  switch (retailer) {
    case "target":
      return targetAdapter;
    case "walmart":
      return walmartAdapter;
    case "homedepot":
      return homeDepotAdapter;
    case "lowes":
      return lowesAdapter;
  }
}

export function getFallback(retailer: Retailer): Adapter {
  return mockAdapter(retailer);
}
