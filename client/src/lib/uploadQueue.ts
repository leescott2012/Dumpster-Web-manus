/**
 * Tiny concurrency limiter (p-limit in ~20 lines). Tasks are lazy closures, so
 * queueing hundreds of Files costs nothing — only `limit` run at once. Each
 * returned promise settles independently: results stream in completion order
 * and one failing task never stalls the rest.
 * Self-test: `npx tsx client/src/lib/uploadQueue.selftest.ts`
 */
export function createLimiter(limit: number) {
  var active = 0;
  var waiting: Array<() => void> = [];
  function pump() {
    while (active < limit && waiting.length) { active++; waiting.shift()!(); }
  }
  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>(function(resolve, reject) {
      waiting.push(function() {
        Promise.resolve().then(task).then(resolve, reject).finally(function() { active--; pump(); });
      });
      pump();
    });
  };
}

/** Let the browser paint / handle input between heavy photos. */
export function yieldToUI(): Promise<void> {
  return new Promise(function(r) { setTimeout(r, 0); });
}

/**
 * Phones (esp. iPhone Safari) kill the tab on memory spikes, so they get
 * smaller decode targets and fewer parallel lanes.
 */
export function isLowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  var mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 4) return true;
  var ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true; // iPadOS
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
