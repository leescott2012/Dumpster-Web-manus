/**
 * aiFetch — fetch() for credit-charged endpoints (/api/ai-*, /api/ig-scrub).
 * After every call (success, error, or network failure) it tells AuthContext
 * so the header credits badge never shows a stale balance.
 *
 * The server (creditGate.checkCredits) sets X-Credits-Remaining to the
 * post-deduct balance. It's only trusted on 2xx: on failures the refund runs
 * after the response is sent, so listeners get `null` and re-read the profile.
 */
type CreditListener = (remaining: number | null) => void;

var listeners = new Set<CreditListener>();

export function onCreditChange(fn: CreditListener): () => void {
  listeners.add(fn);
  return function() { listeners.delete(fn); };
}

function notify(remaining: number | null) {
  listeners.forEach(function(fn) {
    try { fn(remaining); } catch (e) { console.warn("[creditSync] listener failed:", e); }
  });
}

export async function aiFetch(input: string, init?: RequestInit): Promise<Response> {
  var res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    notify(null);
    throw e;
  }
  var h = res.headers.get("X-Credits-Remaining");
  var n = h === null ? NaN : Number(h);
  notify(res.ok && Number.isFinite(n) ? n : null);
  return res;
}
