/**
 * Client helper for the Pool "Scan" feature.
 * Sends photos to /api/ai-label in small batches and returns category + label
 * for each. Data-URL photos are compressed to vision size first so request
 * bodies stay small; HTTPS-URL photos are sent by reference (tiny).
 */
import { getAuthHeaders } from "./supabase";
import { compressDataUrlForVision } from "./imageDownscale";

export interface PhotoLabel { id: string; category: string; label: string }
interface ScanInput { id: string; url: string }

const BATCH_SIZE = 8; // images per request — well under Vercel's body limit

async function prepareUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return compressDataUrlForVision(url);
  return url; // http(s) — sent by reference, server fetches it
}

async function scanBatch(batch: ScanInput[]): Promise<PhotoLabel[]> {
  const photos = await Promise.all(
    batch.map(async (p) => ({ id: p.id, url: await prepareUrl(p.url) }))
  );
  const headers = await getAuthHeaders();
  const res = await fetch("/api/ai-label", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
    body: JSON.stringify({ photos }),
  });
  if (!res.ok) {
    let msg = "Scan failed";
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const data = await res.json();
  return Array.isArray(data.labels) ? data.labels : [];
}

/**
 * Scan a set of photos, calling `onBatch` after each batch so the UI can apply
 * labels incrementally. Returns all labels once finished. Throws on the first
 * batch failure (callers should toast the message).
 */
export async function scanPhotos(
  input: ScanInput[],
  onBatch?: (labels: PhotoLabel[]) => void
): Promise<PhotoLabel[]> {
  const all: PhotoLabel[] = [];
  for (let i = 0; i < input.length; i += BATCH_SIZE) {
    const batch = input.slice(i, i + BATCH_SIZE);
    const labels = await scanBatch(batch);
    all.push(...labels);
    if (onBatch && labels.length > 0) onBatch(labels);
  }
  return all;
}
