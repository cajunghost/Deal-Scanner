export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<string> {
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
