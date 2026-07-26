/**
 * GET /api/sentry-feedback?issue_id=<short id, e.g. JAVASCRIPT-REACT-1Z>
 *
 * Proxies a Sentry User Feedback screenshot attachment back to the admin panel.
 * Sentry attachments require a bearer token to fetch — the browser can't just
 * load them via <img src>, so this resolves shortId -> issue -> latest event ->
 * first image attachment and streams the bytes through, admin-gated same as
 * /api/bug-report.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { captureServerError } from "../sentry.js";

const SENTRY_API = "https://sentry.io/api/0";

async function sentryFetch(path: string, token: string): Promise<Response> {
  return fetch(`${SENTRY_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Sign in required." });
    const adminId = process.env.ADMIN_USER_ID;
    if (!adminId) return res.status(503).json({ error: "ADMIN_USER_ID not set." });
    if (userId !== adminId) return res.status(403).json({ error: "Forbidden." });

    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;
    const token = process.env.SENTRY_AUTH_TOKEN;
    if (!org || !project || !token) {
      return res.status(503).json({ error: "SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN not configured." });
    }

    const shortId = String(req.query.issue_id || "").trim();
    if (!shortId) return res.status(400).json({ error: "issue_id required" });

    // 1. Resolve short ID (e.g. "JAVASCRIPT-REACT-1Z") -> numeric group id
    const shortIdRes = await sentryFetch(`/organizations/${org}/shortids/${encodeURIComponent(shortId)}/`, token);
    if (!shortIdRes.ok) return res.status(shortIdRes.status).json({ error: `Sentry shortid lookup failed: ${await shortIdRes.text()}` });
    const groupId = (await shortIdRes.json())?.group?.id;
    if (!groupId) return res.status(404).json({ error: "Issue not found." });

    // 2. Latest event for that issue
    const eventRes = await sentryFetch(`/organizations/${org}/issues/${groupId}/events/latest/`, token);
    if (!eventRes.ok) return res.status(eventRes.status).json({ error: `Sentry event lookup failed: ${await eventRes.text()}` });
    const eventId = (await eventRes.json())?.id;
    if (!eventId) return res.status(404).json({ error: "No event found for issue." });

    // 3. List attachments, pick the first image
    const attRes = await sentryFetch(`/projects/${org}/${project}/events/${eventId}/attachments/`, token);
    if (!attRes.ok) return res.status(attRes.status).json({ error: `Sentry attachments lookup failed: ${await attRes.text()}` });
    const attachments = (await attRes.json()) as Array<{ id: string; mimetype: string }>;
    const image = attachments.find((a) => (a.mimetype || "").startsWith("image/"));
    if (!image) return res.status(404).json({ error: "No image attachment on this feedback." });

    // 4. Download and proxy the bytes
    const dlRes = await sentryFetch(`/projects/${org}/${project}/events/${eventId}/attachments/${image.id}/?download=1`, token);
    if (!dlRes.ok) return res.status(dlRes.status).json({ error: `Sentry attachment download failed: ${await dlRes.text()}` });
    const buf = Buffer.from(await dlRes.arrayBuffer());
    res.setHeader("Content-Type", image.mimetype || "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(buf);
  } catch (err) {
    captureServerError(err, "sentry-feedback", { issue_id: req.query.issue_id });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}
