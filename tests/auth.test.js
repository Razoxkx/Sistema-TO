import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp, hashToken } from '../server/app.js';
const origin = 'http://localhost:5173';
function setup(overrides = {}) {
  const sessions = new Map();
  let payload;
  let failVerification = false;
  const user = { id: '1', name: 'Persona de prueba', email: 'persona@example.com' };
  const repository = {
    ping: async () => {},
    upsertUser: async profile => { user.picture = profile.picture; return user; },
    createSession: async (_id, hash, expiry) => sessions.set(hash, { user, expiry }),
    findSession: async hash => { const row = sessions.get(hash); return row && row.expiry > new Date() ? row.user : undefined; },
    deleteSession: async hash => sessions.delete(hash),
  };
  const app = createApp({ repository, config: { origin, clientId: 'google-client', sessionSecret: 'test-secret-at-least-32-characters-long', production: false, allowedEmails: [], ...overrides }, verifyGoogle: async () => { if (failVerification) throw new Error('invalid'); return payload; } });
  const agent = request.agent(app);
  return { app, agent, sessions, user, async prepare() { const res = await agent.get('/api/auth/config').expect(200); payload = { sub: 'google-subject', email: user.email, name: user.name, email_verified: true, nonce: res.body.nonce }; return res; }, setPayload(value) { payload = { ...payload, ...value }; }, fail() { failVerification = true; } };
}
const login = agent => agent.post('/api/auth/google').set('Origin', origin).send({ credential: 'test-token' });
test('configuración ausente nunca permite un acceso simulado', async () => {
  const { agent } = setup({ clientId: '' });
  const result = await agent.get('/api/auth/config').expect(200);
  assert.deepEqual(result.body, { enabled: false });
  await login(agent).expect(503);
});
test('una visita sin sesión devuelve usuario nulo', async () => { const { agent } = setup(); assert.deepEqual((await agent.get('/api/auth/me').expect(200)).body, { user: null }); });
test('rechaza origen externo y origen ausente', async () => {
  const { agent } = setup();
  await agent.post('/api/auth/google').set('Origin', 'https://otro.example').send({ credential: 'x' }).expect(403);
  await agent.post('/api/auth/logout').expect(403);
});
test('rechaza login sin nonce y credencial mal formada', async () => {
  const s = setup(); await login(s.agent).expect(400); await s.prepare();
  await s.agent.post('/api/auth/google').set('Origin', origin).send({ credential: 12 }).expect(400);
});
test('rechaza token cuya verificación falla', async () => { const s = setup(); await s.prepare(); s.fail(); await login(s.agent).expect(401); assert.equal(s.sessions.size, 0); });
test('rechaza nonce ajeno o correo sin verificar', async () => {
  const s = setup(); await s.prepare(); s.setPayload({ nonce: 'otro-nonce' }); await login(s.agent).expect(401);
  await s.prepare(); s.setPayload({ email_verified: false }); await login(s.agent).expect(401);
  assert.equal(s.sessions.size, 0);
});
test('lista de correos restringe el acceso', async () => { const s = setup({ allowedEmails: ['autorizado@example.com'] }); await s.prepare(); await login(s.agent).expect(403); });
test('login crea cookie HttpOnly y guarda únicamente su hash; logout revoca', async () => {
  const s = setup(); await s.prepare();
  const result = await login(s.agent).expect(200);
  assert.deepEqual(result.body.user, s.user);
  const cookie = result.headers['set-cookie'].find(value => /^espacio_session=[a-f0-9]{64};/.test(value));
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(token.length, 64); assert.ok(s.sessions.has(hashToken(token))); assert.ok(!s.sessions.has(token));
  assert.deepEqual((await s.agent.get('/api/auth/me').expect(200)).body.user, s.user);
  await login(s.agent).expect(400);
  await s.agent.post('/api/auth/logout').set('Origin', origin).expect(200);
  assert.equal(s.sessions.size, 0);
  assert.equal((await s.agent.get('/api/auth/me').expect(200)).body.user, null);
});
test('sesión vencida deja de autenticar', async () => {
  const s = setup(); await s.prepare(); await login(s.agent).expect(200);
  for (const session of s.sessions.values()) session.expiry = new Date(0);
  const res = await s.agent.get('/api/auth/me').expect(200);
  assert.equal(res.body.user, null); assert.match(res.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
});
test('configuración de producción usa cookie Secure para el nonce', async () => { const s = setup({ production: true }); const res = await s.prepare(); assert.match(res.headers['set-cookie'][0], /Secure/); });

test('foto del token verificado se conserva en login y al recuperar la sesión', async () => {
  const s = setup(); await s.prepare();
  const picture = 'https://lh3.googleusercontent.com/a/example=s96-c';
  s.setPayload({ picture });
  const result = await s.agent.post('/api/auth/google').set('Origin', origin).send({ credential: 'test-token', picture: 'https://otro.example/foto' }).expect(200);
  assert.equal(result.body.user.picture, picture);
  const session = await s.agent.get('/api/auth/me').expect(200);
  assert.equal(session.body.user.picture, picture);
});
test('foto ajena a Google o no HTTPS usa la alternativa sin imagen', async () => {
  for (const picture of ['http://lh3.googleusercontent.com/a/example', 'https://googleusercontent.com.otro.example/foto', 'javascript:alert(1)', undefined]) {
    const s = setup(); await s.prepare(); s.setPayload({ picture });
    const result = await login(s.agent).expect(200);
    assert.equal(result.body.user.picture, null);
  }
});
