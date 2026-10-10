// Rate limit แบบ in-memory ต่อ instance (พอสำหรับร้านเดียว)
// ถ้า scale หลาย instance ให้เปลี่ยนเป็น Upstash/Redis
const buckets = new Map();

export function rateLimit(key, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  return b.n <= max;
}

export function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
