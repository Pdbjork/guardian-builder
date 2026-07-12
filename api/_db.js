import crypto from 'node:crypto';
import pg from 'pg';

let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }

  return pool;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  if (raw.length > 20_000) throw new ValidationError('Submission is too large.');
  return JSON.parse(raw);
}

export class ValidationError extends Error {}

export function text(value, max = 500, required = false) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !normalized) throw new ValidationError('Please fill out all required fields.');
  if (normalized.length > max) throw new ValidationError(`Please keep responses under ${max} characters.`);
  return normalized || null;
}

export function longText(value, max = 5000, required = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && !normalized) throw new ValidationError('Please fill out all required fields.');
  if (normalized.length > max) throw new ValidationError(`Please keep long responses under ${max} characters.`);
  return normalized || null;
}

export function email(value, required = false) {
  const normalized = text(value, 320, required);
  if (!normalized) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  if (!valid) throw new ValidationError('Please enter a valid email address.');
  return normalized.toLowerCase();
}

export function stringArray(value, allowed, maxItems = 8) {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = [...new Set(arr.filter((item) => allowed.includes(item)))];
  return cleaned.slice(0, maxItems);
}

export function ipHash(req) {
  const secret = process.env.IP_HASH_SECRET || process.env.DATABASE_URL || 'guardian-builder';
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

export function userAgent(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export async function enforceBasicRateLimit(tableName, hash) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select count(*)::int as count from ${tableName} where ip_hash = $1 and created_at > now() - interval '1 hour'`,
    [hash],
  );
  if ((rows[0]?.count || 0) >= 5) {
    throw new ValidationError('Too many submissions from this network. Please try again later.');
  }
}
