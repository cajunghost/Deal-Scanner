export type Retailer = "target" | "walmart" | "homedepot" | "lowes";

export interface Deal {
  id: string;
  retailer: Retailer;
  title: string;
  image?: string;
  originalPrice: number;
  salePrice: number;
  percentOff: number;
  inStock: boolean;
  storeName?: string;
  storeId?: string;
  productUrl: string;
  storeLocatorUrl?: string;
}

export interface ScanRequest {
  zip: string;
  retailers: Retailer[];
  minPercentOff: number;
  inStockOnly: boolean;
  radiusMiles?: number;
}

export interface RetailerStat {
  retailer: Retailer;
  matched: number;
  fetched: number;
  sampleData: boolean;
}

export interface ScanResponse {
  deals: Deal[];
  errors: { retailer: Retailer; message: string }[];
  stats: RetailerStat[];
  fetchedAt: string;
  proxied: boolean;
}

export interface AdapterContext {
  zip: string;
  minPercentOff: number;
  inStockOnly: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface Adapter {
  retailer: Retailer;
  scan(ctx: AdapterContext): Promise<Deal[]>;
}
