import { ProxyAgent, type Dispatcher } from "undici";

let cachedDispatcher: Dispatcher | null | undefined;

export function proxyUrl(): string | null {
  return (
    process.env.PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    null
  );
}

export function isProxyActive(): boolean {
  return proxyUrl() !== null;
}

function getDispatcher(): Dispatcher | null {
  if (cachedDispatcher !== undefined) return cachedDispatcher;
  const url = proxyUrl();
  cachedDispatcher = url ? new ProxyAgent(url) : null;
  return cachedDispatcher;
}

type FetchInit = RequestInit & { timeoutMs?: number };

async function doFetch(url: string, init: FetchInit): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const dispatcher = getDispatcher();
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        ...(rest.headers as Record<string, string> | undefined),
      },
      // Node's global fetch (undici) accepts `dispatcher` at runtime; the type
      // is just not in lib.dom. This cast is safe.
      ...(dispatcher ? ({ dispatcher } as { dispatcher: Dispatcher }) : {}),
    } as RequestInit);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  init: FetchInit = {},
): Promise<T> {
  const res = await doFetch(url, {
    ...init,
    headers: {
      accept: "application/json, text/plain, */*",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  return (await res.json()) as T;
}

export async function fetchText(
  url: string,
  init: FetchInit = {},
): Promise<string> {
  const res = await doFetch(url, {
    ...init,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  return await res.text();
}
