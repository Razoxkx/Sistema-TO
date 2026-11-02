import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
let active = 0;
async function hashBytes(password, salt) {
  if (active >= 4) throw Object.assign(new Error('El acceso está ocupado. Inténtalo en unos segundos.'), { status: 503 });
  active++;
  try { return await derive(password, salt, 64, options); } finally { active--; }
}
export const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validEmail = value => typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await hashBytes(password, salt);
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  const valid = parts.length === 6 && parts.slice(0, 4).join('$') === 'scrypt$32768$8$3' && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5]);
  const salt = valid ? parts[4] : '00000000000000000000000000000000';
  const expected = valid ? Buffer.from(parts[5], 'hex') : Buffer.alloc(64);
  const actual = await hashBytes(password, salt);
  return timingSafeEqual(actual, expected) && valid;
}
