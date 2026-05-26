import { NextResponse } from "next/server";
import { getAdapter, getFallback } from "@/lib/adapters";
import { applyFilters } from "@/lib/filters";
import { isProxyActive } from "@/lib/http";
import type { Deal, Retailer, ScanRequest, ScanResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_RETAILERS: Retailer[] = ["target", "walmart", "homedepot", "lowes"];

function parseRequest(body: unknown): ScanRequest {
  const b = (body ?? {}) as Partial<ScanRequest>;
  const zip = String(b.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) throw new Error("Invalid ZIP (need 5 digits)");
  const retailers = (Array.isArray(b.retailers) ? b.retailers : VALID_RETAILERS)
    .filter((r): r is Retailer => VALID_RETAILERS.includes(r as Retailer));
  const minPercentOff = clamp(Number(b.minPercentOff ?? 70), 0, 99);
  const inStockOnly = b.inStockOnly !== false;
  return { zip, retailers, minPercentOff, inStockOnly };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: Request): Promise<NextResponse<ScanResponse>> {
  let parsed: ScanRequest;
  try {
    parsed = parseRequest(await req.json());
  } catch (e) {
    return NextResponse.json(
      {
        deals: [],
        errors: [
          {
            retailer: "target",
            message: e instanceof Error ? e.message : "Bad request",
          },
        ],
        fetchedAt: new Date().toISOString(),
        proxied: isProxyActive(),
      },
      { status: 400 },
    );
  }

  const timeoutMs = Number(process.env.DEAL_SCANNER_TIMEOUT_MS ?? 8000);
  const ctx = {
    zip: parsed.zip,
    minPercentOff: parsed.minPercentOff,
    inStockOnly: parsed.inStockOnly,
    timeoutMs,
  };

  const results = await Promise.all(
    parsed.retailers.map(async (retailer) => {
      try {
        const deals = await getAdapter(retailer).scan(ctx);
        return { retailer, deals, error: null as string | null };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // graceful degrade: return mock data for this retailer so the UI
        // still shows something, but flag the error.
        try {
          const deals = await getFallback(retailer).scan(ctx);
          return { retailer, deals, error: `${message} — showing sample data` };
        } catch {
          return { retailer, deals: [] as Deal[], error: message };
        }
      }
    }),
  );

  const allDeals = results.flatMap((r) => r.deals);
  const filtered = applyFilters(allDeals, {
    minPercentOff: parsed.minPercentOff,
    inStockOnly: parsed.inStockOnly,
  });
  const errors = results
    .filter((r) => r.error)
    .map((r) => ({ retailer: r.retailer, message: r.error! }));

  return NextResponse.json({
    deals: filtered,
    errors,
    fetchedAt: new Date().toISOString(),
    proxied: isProxyActive(),
  });
}
