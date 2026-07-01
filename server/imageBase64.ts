/**
 * Shared image-to-base64 helper for Claude Vision payloads.
 * Handles two URL shapes:
 *   - data: URLs → decoded inline (no network round-trip)
 *   - http(s):  → fetched with 8s timeout, after an SSRF safety check
 * Anything else returns null.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const VALID_TYPES: MediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// 10MB cap on any fetched remote image — a photo has no business being bigger,
// and it bounds both memory use and a slow/huge-body SSRF target.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * SSRF guard (backend security audit, 2026-07-01): `url` comes from a photo's
 * `url` field in an authenticated user's own request body (ai-caption/
 * ai-suggest/ai-label), so any signed-in user controls what this fetches.
 * Without this check the server would happily fetch
 * http://169.254.169.254/latest/meta-data/... or an internal service on the
 * caller's behalf. Blocks non-http(s) schemes, hostnames that resolve to
 * private/loopback/link-local ranges, and a few reserved hostnames outright.
 */
async function isSafeRemoteUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    return false;
  }

  // If the hostname is itself a literal IP, check it directly; otherwise resolve
  // it and check every returned address (defends the common case — doesn't fully
  // close a DNS-rebinding race between this check and the later fetch, but that's
  // a much narrower window than the current zero-validation state).
  const literal = isIP(hostname) ? hostname : null;
  let addresses: string[];
  if (literal) {
    addresses = [literal];
  } else {
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      addresses = results.map((r) => r.address);
    } catch {
      return false; // can't resolve it, don't fetch it
    }
  }
  if (addresses.length === 0) return false;
  return addresses.every((addr) => !isPrivateOrReservedIp(addr));
}

function isPrivateOrReservedIp(addr: string): boolean {
  const version = isIP(addr);
  if (version === 4) {
    const parts = addr.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
    return false;
  }
  if (version === 6) {
    const lower = addr.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
    if (lower.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — check the embedded IPv4 address too.
      return isPrivateOrReservedIp(lower.replace("::ffff:", ""));
    }
    return false;
  }
  return true; // couldn't even parse it as an IP — treat as unsafe
}

export async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mediaType: MediaType } | null> {
  // data: URL — decode without a network round-trip
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const rawType = match[1].trim() as MediaType;
    const mediaType = (VALID_TYPES.includes(rawType) ? rawType : "image/jpeg") as MediaType;
    return { base64: match[2], mediaType };
  }

  if (!(await isSafeRemoteUrl(url))) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mt = contentType.split(";")[0].trim() as MediaType;
    const mediaType = (VALID_TYPES.includes(mt) ? mt : "image/jpeg") as MediaType;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, mediaType };
  } catch {
    return null;
  }
}
