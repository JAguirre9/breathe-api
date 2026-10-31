import { getConnInfo } from "@hono/node-server/conninfo";
const buckets = new Map();
// Drop expired entries every minute so the map can't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
        if (b.resetAt <= now)
            buckets.delete(key);
    }
}, 60_000).unref();
function clientIp(c) {
    // Only trust X-Forwarded-For when the API sits behind a proxy you control
    // (Render, Fly, Railway, Cloudflare...). Otherwise anyone could fake it.
    if (process.env.TRUST_PROXY === "true") {
        const fwd = c.req.header("x-forwarded-for");
        if (fwd)
            return fwd.split(",").pop().trim();
    }
    return getConnInfo(c).remote.address ?? "unknown";
}
export function rateLimit(name, max, windowMs) {
    return async (c, next) => {
        const key = `${name}:${clientIp(c)}`;
        const now = Date.now();
        const bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
        }
        else if (bucket.count >= max) {
            c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
            return c.json({ error: "Too many requests. Try again later." }, 429);
        }
        else {
            bucket.count++;
        }
        await next();
    };
}
