/**
 * Shared image-to-base64 helper for Claude Vision payloads.
 * Handles two URL shapes:
 *   - data: URLs → decoded inline (no network round-trip)
 *   - http(s):  → fetched with 8s timeout
 * Anything else returns null.
 */

export type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const VALID_TYPES: MediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

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

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mt = contentType.split(";")[0].trim() as MediaType;
    const mediaType = (VALID_TYPES.includes(mt) ? mt : "image/jpeg") as MediaType;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, mediaType };
  } catch {
    return null;
  }
}
