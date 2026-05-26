"use client";

import { useState } from "react";
import type { Deal, Retailer, ScanResponse } from "@/lib/types";

const RETAILER_LABEL: Record<Retailer, string> = {
  target: "Target",
  walmart: "Walmart",
  homedepot: "Home Depot",
  lowes: "Lowe's",
};

const RETAILER_COLOR: Record<Retailer, string> = {
  target: "bg-target",
  walmart: "bg-walmart",
  homedepot: "bg-homedepot",
  lowes: "bg-lowes",
};

const ALL_RETAILERS: Retailer[] = ["target", "walmart", "homedepot", "lowes"];

export default function Home() {
  const [zip, setZip] = useState("");
  const [retailers, setRetailers] = useState<Retailer[]>(ALL_RETAILERS);
  const [minPercentOff, setMinPercentOff] = useState(70);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRetailer(r: Retailer) {
    setRetailers((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
    );
  }

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zip, retailers, minPercentOff, inStockOnly }),
      });
      const json = (await res.json()) as ScanResponse;
      if (!res.ok) {
        setError(json.errors?.[0]?.message ?? "Scan failed");
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Deal Scanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Find extremely marked-down items at stores near you. Default threshold:{" "}
          <span className="text-zinc-200">70%+ off</span>, in stock only.
        </p>
      </header>

      <form
        onSubmit={runScan}
        className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:grid-cols-[140px_1fr_auto] sm:items-end"
      >
        <label className="block text-sm">
          <span className="block text-zinc-400">ZIP code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            required
            placeholder="90210"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base tracking-widest focus:border-zinc-500 focus:outline-none"
          />
        </label>

        <div className="text-sm">
          <span className="block text-zinc-400">Retailers</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {ALL_RETAILERS.map((r) => {
              const active = retailers.includes(r);
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => toggleRetailer(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                    active
                      ? `${RETAILER_COLOR[r]} text-white ring-transparent`
                      : "bg-zinc-950 text-zinc-300 ring-zinc-700 hover:ring-zinc-500"
                  }`}
                >
                  {RETAILER_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || retailers.length === 0}
          className="h-10 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {loading ? "Scanning..." : "Scan for deals"}
        </button>

        <label className="block text-sm sm:col-span-2">
          <span className="block text-zinc-400">
            Minimum markdown: <span className="text-zinc-200">{minPercentOff}% off</span>
          </span>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={minPercentOff}
            onChange={(e) => setMinPercentOff(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-1">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          <span>In stock only</span>
        </label>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-8">
          <ResultsHeader result={result} />
          {result.deals.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">
              No items met the {minPercentOff}%+ threshold. Try lowering it or
              toggling more retailers.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function ResultsHeader({ result }: { result: ScanResponse }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 pb-2">
      <h2 className="text-lg font-semibold">
        {result.deals.length} deal{result.deals.length === 1 ? "" : "s"} found
      </h2>
      <div className="flex items-center gap-2 text-xs">
        {result.proxied && (
          <span
            className="rounded bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
            title="Outbound requests routed through PROXY_URL"
          >
            proxied
          </span>
        )}
        <span className="text-zinc-500">
          Fetched {new Date(result.fetchedAt).toLocaleTimeString()}
        </span>
      </div>
      {result.errors.length > 0 && (
        <ul className="basis-full text-xs text-amber-300/90">
          {result.errors.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{RETAILER_LABEL[e.retailer]}:</span>{" "}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <a
        href={deal.productUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="block"
      >
        <div className="relative aspect-square bg-zinc-950">
          {deal.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.image}
              alt={deal.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-zinc-600">
              no image
            </div>
          )}
          <span
            className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${RETAILER_COLOR[deal.retailer]}`}
          >
            {RETAILER_LABEL[deal.retailer]}
          </span>
          <span className="absolute right-2 top-2 rounded bg-emerald-500 px-2 py-0.5 text-xs font-bold text-black">
            -{deal.percentOff}%
          </span>
        </div>
      </a>
      <div className="space-y-2 p-3">
        <a
          href={deal.productUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="line-clamp-2 text-sm font-medium hover:underline"
          title={deal.title}
        >
          {deal.title}
        </a>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-emerald-400">
            ${deal.salePrice.toFixed(2)}
          </span>
          <span className="text-xs text-zinc-500 line-through">
            ${deal.originalPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              deal.inStock ? "text-emerald-400" : "text-zinc-500"
            }
          >
            {deal.inStock ? "In stock" : "Out of stock"}
            {deal.storeName ? ` · ${deal.storeName}` : ""}
          </span>
          {deal.storeLocatorUrl && (
            <a
              href={deal.storeLocatorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-zinc-400 hover:text-zinc-200"
            >
              Find store ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
