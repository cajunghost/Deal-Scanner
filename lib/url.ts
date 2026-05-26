export function absoluteUrl(
  base: string,
  path: string | undefined | null,
): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const baseClean = base.replace(/\/+$/, "");
  const pathClean = path.startsWith("/") ? path : "/" + path;
  return baseClean + pathClean;
}
