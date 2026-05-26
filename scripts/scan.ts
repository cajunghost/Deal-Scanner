#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getAdapter, getFallback } from "../lib/adapters";
import { applyFilters } from "../lib/filters";
import { isProxyActive, proxyUrl } from "../lib/http";
import type { Deal, Retailer } from "../lib/types";

const ALL: Retailer[] = ["target", "walmart", "homedepot", "lowes"];

interface Args {
  zip: string;
  pct: number;
  inStockOnly: boolean;
  retailers: Retailer[];
  html?: string;
  json?: string;
  timeoutMs: number;
}

function parseArgs(argv: string[]): Args {
  const a: Partial<Args> = {
    pct: 70,
    inStockOnly: true,
    retailers: ALL,
    timeoutMs: Number(process.env.DEAL_SCANNER_TIMEOUT_MS ?? 8000),
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case "--zip":
        a.zip = v;
        i++;
        break;
      case "--pct":
      case "--min":
        a.pct = Number(v);
        i++;
        break;
      case "--retailers":
        a.retailers = v
          .split(",")
          .map((s) => s.trim() as Retailer)
          .filter((r) => ALL.includes(r));
        i++;
        break;
      case "--include-oos":
        a.inStockOnly = false;
        break;
      case "--html":
        a.html = v;
        i++;
        break;
      case "--json":
        a.json = v;
        i++;
        break;
      case "--timeout":
        a.timeoutMs = Number(v);
        i++;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
    }
  }
  if (!a.zip || !/^\d{5}$/.test(a.zip)) {
    usage();
    process.exit(1);
  }
  return a as Args;
}

function usage() {
  console.log(`Deal Scanner CLI
Usage:
  npm run scan -- --zip <ZIP> [options]

Options:
  --zip <12345>            5-digit ZIP code (required)
  --pct <70>               minimum % off (default 70)
  --retailers <list>       comma-separated: target,walmart,homedepot,lowes
  --include-oos            include out-of-stock items
  --html <path>            write an HTML report to <path>
  --json <path>            write raw JSON to <path>
  --timeout <ms>           per-adapter timeout (default 8000)

Examples:
  npm run scan -- --zip 90210
  npm run scan -- --zip 90210 --pct 60 --retailers target,walmart
  npm run scan -- --zip 90210 --html out/deals.html
`);
}

function color(s: string, code: number): string {
  if (!process.stdout.isTTY) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const dim = (s: string) => color(s, 2);
const green = (s: string) => color(s, 32);
const cyan = (s: string) => color(s, 36);
const yellow = (s: string) => color(s, 33);
const bold = (s: string) => color(s, 1);

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function printDeals(deals: Deal[]) {
  const byRetailer = new Map<Retailer, Deal[]>();
  for (const d of deals) {
    const list = byRetailer.get(d.retailer) ?? [];
    list.push(d);
    byRetailer.set(d.retailer, list);
  }
  for (const [retailer, list] of byRetailer) {
    console.log(
      `\n${bold(retailer.toUpperCase())} ${dim(`— ${list.length} deals`)}`,
    );
    for (const d of list) {
      const pct = green(`-${d.percentOff}%`.padStart(5));
      const sale = green(fmtMoney(d.salePrice).padStart(8));
      const orig = dim(fmtMoney(d.originalPrice));
      const stock = d.inStock ? green("in stock") : yellow("out of stock");
      const store = d.storeName ? dim(` @ ${d.storeName}`) : "";
      console.log(`  ${pct}  ${sale} ${dim("was")} ${orig}  ${d.title}`);
      console.log(`         ${stock}${store}`);
      console.log(`         ${cyan(d.productUrl)}`);
    }
  }
}

function renderHtml(deals: Deal[], args: Args, proxied: boolean): string {
  const ts = new Date().toISOString();
  const rows = deals
    .map((d) => {
      const img = d.image
        ? `<img src="${escapeAttr(d.image)}" alt="" loading="lazy"/>`
        : `<div class="noimg">no image</div>`;
      const store = d.storeLocatorUrl
        ? `<a href="${escapeAttr(d.storeLocatorUrl)}" target="_blank">Find store ↗</a>`
        : "";
      const stock = d.inStock ? "in stock" : "OOS";
      const stockClass = d.inStock ? "ok" : "oos";
      return `<li class="card">
  <a class="thumb" href="${escapeAttr(d.productUrl)}" target="_blank">${img}
    <span class="tag ${d.retailer}">${d.retailer}</span>
    <span class="pct">-${d.percentOff}%</span>
  </a>
  <div class="body">
    <a class="title" href="${escapeAttr(d.productUrl)}" target="_blank">${escapeHtml(d.title)}</a>
    <div class="price">
      <span class="sale">${fmtMoney(d.salePrice)}</span>
      <span class="orig">${fmtMoney(d.originalPrice)}</span>
    </div>
    <div class="meta">
      <span class="${stockClass}">${stock}${d.storeName ? " · " + escapeHtml(d.storeName) : ""}</span>
      ${store}
    </div>
  </div>
</li>`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Deal Scanner — ${escapeHtml(args.zip)}</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif}
body{margin:0;background:#0b0d10;color:#e6e8eb;padding:24px}
h1{margin:0 0 4px;font-size:24px}
.sub{color:#8a8f98;font-size:13px;margin-bottom:18px}
.badges{display:flex;gap:8px;margin-bottom:18px}
.badge{font-size:11px;padding:3px 8px;border-radius:999px;background:#1a1d22;color:#9fb;border:1px solid #2a2f36}
ul{list-style:none;margin:0;padding:0;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:#15181d;border:1px solid #232830;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.thumb{position:relative;display:block;aspect-ratio:1;background:#0b0d10}
.thumb img{width:100%;height:100%;object-fit:contain}
.noimg{display:grid;place-items:center;height:100%;color:#555;font-size:12px}
.tag{position:absolute;left:8px;top:8px;padding:2px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#fff;border-radius:4px;font-weight:600}
.tag.target{background:#cc0000}.tag.walmart{background:#0071dc}.tag.homedepot{background:#f96302}.tag.lowes{background:#004990}
.pct{position:absolute;right:8px;top:8px;background:#22c55e;color:#000;padding:2px 8px;font-size:12px;font-weight:700;border-radius:4px}
.body{padding:12px;display:grid;gap:6px}
.title{color:#e6e8eb;text-decoration:none;font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.title:hover{text-decoration:underline}
.price{display:flex;gap:8px;align-items:baseline}
.sale{font-size:18px;font-weight:700;color:#22c55e}
.orig{font-size:12px;color:#666;text-decoration:line-through}
.meta{display:flex;justify-content:space-between;font-size:11px}
.meta a{color:#9aa3ad;text-decoration:none}.meta a:hover{color:#e6e8eb}
.ok{color:#22c55e}.oos{color:#888}
</style></head><body>
<h1>Deal Scanner</h1>
<div class="sub">ZIP ${escapeHtml(args.zip)} · ${args.pct}%+ off · ${args.inStockOnly ? "in stock only" : "all stock"} · ${deals.length} deals · ${ts}</div>
<div class="badges">${proxied ? '<span class="badge">proxied</span>' : ""}</div>
<ul>${rows}</ul>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const proxied = isProxyActive();
  console.log(
    bold("Deal Scanner") +
      dim(
        ` — zip ${args.zip}, ${args.pct}%+ off, ${args.retailers.join("/")}` +
          (proxied ? `, proxy ${new URL(proxyUrl()!).host}` : ""),
      ),
  );

  const ctx = {
    zip: args.zip,
    minPercentOff: args.pct,
    inStockOnly: args.inStockOnly,
    timeoutMs: args.timeoutMs,
  };

  const results = await Promise.all(
    args.retailers.map(async (retailer) => {
      try {
        return {
          retailer,
          deals: await getAdapter(retailer).scan(ctx),
          error: null as string | null,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        try {
          return {
            retailer,
            deals: await getFallback(retailer).scan(ctx),
            error: `${msg} — showing sample data`,
          };
        } catch {
          return { retailer, deals: [] as Deal[], error: msg };
        }
      }
    }),
  );

  for (const r of results) {
    if (r.error) console.log(yellow(`! ${r.retailer}: ${r.error}`));
  }

  const filtered = applyFilters(results.flatMap((r) => r.deals), {
    minPercentOff: args.pct,
    inStockOnly: args.inStockOnly,
  });

  printDeals(filtered);
  console.log(`\n${bold(`${filtered.length} deals`)} matching filters.`);

  if (args.html) {
    const path = resolve(process.cwd(), args.html);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, renderHtml(filtered, args, proxied));
    console.log(dim(`HTML report → ${path}`));
  }
  if (args.json) {
    const path = resolve(process.cwd(), args.json);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          proxied,
          args,
          deals: filtered,
          errors: results.filter((r) => r.error).map((r) => ({
            retailer: r.retailer,
            message: r.error,
          })),
        },
        null,
        2,
      ),
    );
    console.log(dim(`JSON → ${path}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
