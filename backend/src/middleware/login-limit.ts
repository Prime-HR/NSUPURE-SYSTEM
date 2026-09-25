import { Request, Response, NextFunction } from "express";
const attempts = new Map<string, { count: number; expires: number }>();
const windowMs = 15 * 60 * 1000;
// Single-instance protection. Use a shared store before horizontal scaling.
export function limitLogin(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const entry = attempts.get(key) || { count: 0, expires: now + windowMs };
  if (attempts.size >= 10000 && !attempts.has(key)) {
    res.status(429).json({ success: false, error: { message: "Too many login attempts. Try again later." } }); return;
  }
  entry.count++; attempts.set(key, entry);
  if (entry.count > 20) {
    res.setHeader("Retry-After", Math.ceil((entry.expires - now) / 1000));
    res.status(429).json({ success: false, error: { code: "LOGIN_RATE_LIMIT", message: "Too many login attempts. Try again later." } }); return;
  }
  next();
}
