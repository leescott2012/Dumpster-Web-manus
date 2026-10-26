/**
 * Label a video from its thumbnail (Claude Vision, 1 credit — same paid Scan as photos).
 *
 * OWNER EXCEPTION (Lee, 2026-10-25): videos stay device-only EXCEPT this one still frame
 * (the ≤480px poster in VideoMeta.thumbDataUrl). Never the video bytes, never a blob: URL.
 * Everything else in the app still filters videos out via notVideo().
 */
import { scanPhotos } from "./aiLabel";
import type { VideoMeta } from "./videoStore";

export async function labelVideoThumb(v: Pick<VideoMeta, "id" | "thumbDataUrl">): Promise<{ category: string; label: string } | null> {
  if (!v.thumbDataUrl || v.thumbDataUrl.indexOf("data:image/") !== 0) return null;
  var labels = await scanPhotos([{ id: v.id, url: v.thumbDataUrl }]);
  var l = labels[0];
  return l && l.label ? { category: l.category, label: l.label } : null;
}
