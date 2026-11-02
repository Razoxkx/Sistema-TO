import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { currentMonth, shiftMonth, validMonth } from '../shared/finance-month.js';

function setup() {
  const sessions = new Map(); const calls = [];
  const repository = {
    upsertUser: async profile => ({ id: profile.googleId }),
    createSession: async (id, token) => sessions.set(token, { id }),
    findSession: async token => sessions.get(token),
    deleteSession: async token => sessions.delete(token),
    getFinances: async (...args) => { calls.push(args); return { month: args[1], summary: { totalAmount: 0 } }; },
  };
  const origin = 'http://localhost:5173';
  const app = createApp({ repository, config: { origin, clientId: 'test', sessionSecret: 'test-secret-long-enough-for-authentication', production: false, allowedEmails: [] }, verifyGoogle: async credential => JSON.parse(credential) });
  return { app, calls, async login(id) {
    const agent = request.agent(app); const { body } = await agent.get('/api/auth/config');
    await agent.post('/api/auth/google').set('Origin', origin).send({ credential: JSON.stringify({ sub: id, email: `${id}@example.com`, email_verified: true, nonce: body.nonce }) }).expect(200);
    return agent;
  } };
}
test('finanzas: requiere sesión y toma el terapeuta autenticado, sin aceptar otro propietario', async () => {
  const s = setup(); await request(s.app).get('/api/finanzas').expect(401);
  const a = await s.login('terapeuta-a'); const b = await s.login('terapeuta-b');
  const response = await a.get('/api/finanzas?mes=2026-10&page=2').expect(200);
  assert.match(response.headers['cache-control'], /no-store/);
  await b.get('/api/finanzas?mes=2026-09').expect(200);
  assert.deepEqual(s.calls, [['terapeuta-a', '2026-10', 2], ['terapeuta-b', '2026-09', 1]]);
  await a.get('/api/finanzas?therapistId=terapeuta-b').expect(400);
});
test('finanzas: valida período y paginación, y abre el mes actual de Chile por defecto', async () => {
  const s = setup(); const a = await s.login('a');
  await a.get('/api/finanzas').expect(200);
  assert.equal(s.calls[0][1], currentMonth());
  for (const query of ['mes=2026-00','mes=2026-13','mes=2026-1','mes=2101-01','mes=1899-12','mes[]=2026-10','mes=2026-10-01','page=-1','page=1.5','page[]=1','page=100001']) await a.get(`/api/finanzas?${query}`).expect(400);
  assert.equal(s.calls.length, 1);
});
test('períodos: cambio de mes en Chile y navegación entre años conservan los límites correctos', () => {
  assert.equal(currentMonth(new Date('2026-11-01T02:59:59Z')), '2026-10');
  assert.equal(currentMonth(new Date('2026-11-01T03:00:00Z')), '2026-11');
  assert.equal(currentMonth(new Date('2026-06-01T03:59:59Z')), '2026-05');
  assert.equal(currentMonth(new Date('2026-06-01T04:00:00Z')), '2026-06');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.ok(validMonth('2026-02')); assert.ok(!validMonth('2026-13'));
});
