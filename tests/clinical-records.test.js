import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { createApp, hashToken } from '../server/app.js';
import { emptyClinicalRecord } from '../shared/clinical-fields.js';
const origin = 'http://localhost:5173';
function setup() {
  const sessions = new Map(); const records = new Map(); const clinicalSessions = new Map();
  const repository = {
    upsertUser: async profile => ({ id: profile.googleId, name: profile.name, email: profile.email }),
    createSession: async (id, token) => sessions.set(token, { id }),
    findSession: async token => sessions.get(token),
    deleteSession: async token => sessions.delete(token),
    listRecords: async (owner, q, page) => { const rows = [...records.values()].filter(r => r.owner === owner && r.name.includes(q)); return { records: rows.slice((page - 1) * 20, page * 20), total: rows.length, page, pageSize: 20 }; },
    findRecord: async (owner, id) => { const row = records.get(id); return row?.owner === owner ? row : null; },
    createRecord: async (owner, id, record) => { const row = { ...record, id, owner, version: 1 }; records.set(id, row); return row; },
    listClinicalSessions: async (owner, id, page) => {
      const rows = [...clinicalSessions.values()].filter(row => row.recordId === id && records.get(id)?.owner === owner).sort((a, b) => b.date.localeCompare(a.date));
      return { sessions: rows.slice((page - 1) * 20, page * 20), total: rows.length, page, pageSize: 20 };
    },
    createClinicalSession: async (owner, recordId, id, session) => {
      if (records.get(recordId)?.owner !== owner) return null;
      const row = { ...session, id, recordId, version: 1 }; clinicalSessions.set(id, row); return row;
    },
    findClinicalSession: async (owner, recordId, id) => { const row = clinicalSessions.get(id); return row?.recordId === recordId && records.get(recordId)?.owner === owner ? row : null; },
    updateClinicalSession: async (owner, recordId, id, version, session) => {
      const row = clinicalSessions.get(id);
      if (row?.recordId !== recordId || records.get(recordId)?.owner !== owner || row.version !== version) return null;
      const updated = { ...row, ...session, version: version + 1 }; clinicalSessions.set(id, updated); return updated;
    },
    updateRecord: async (owner, id, version, record) => { const row = records.get(id); if (row?.owner !== owner || row.version !== version) return null; const next = { ...row, ...record, version: version + 1 }; records.set(id, next); return next; },
  };
  const app = createApp({ repository, config: { origin, clientId: 'test-client', sessionSecret: 'test-secret-long-enough-for-authentication', production: false, allowedEmails: [] }, verifyGoogle: async credential => JSON.parse(credential) });
  return { app, sessions, records, async login(id) {
    const agent = request.agent(app); const { body } = await agent.get('/api/auth/config');
    await agent.post('/api/auth/google').set('Origin', origin).send({ credential: JSON.stringify({ sub: id, name: id, email: `${id}@example.com`, email_verified: true, nonce: body.nonce }) }).expect(200);
    return agent;
  } };
}
const valid = () => ({ ...emptyClinicalRecord(), name: 'Usuario de prueba', age: 0, medicalHistory: 'Antecedentes de prueba\nSegunda línea', skillsToReinforce: 'Habilidad de prueba' });
const send = (agent, method, path, body) => agent[method](path).set('Origin', origin).send(body);
test('las fichas requieren sesión vigente para listar, crear, consultar y editar', async () => {
  const s = setup();
  await request(s.app).get('/api/usuarios').expect(401);
  await request(s.app).get('/api/usuarios/00000000-0000-4000-8000-000000000000').expect(401);
  await send(request(s.app), 'post', '/api/usuarios', valid()).expect(401);
  await send(request(s.app), 'put', '/api/usuarios/00000000-0000-4000-8000-000000000000', valid()).expect(401);
});
test('ficha conserva los doce campos y queda disponible después de guardarla', async () => {
  const s = setup(); const agent = await s.login('terapeuta-a');
  const data = valid();
  for (const key of Object.keys(data).filter(k => !['age','name'].includes(k))) data[key] = `Información ${key}\nObservación de prueba`;
  const response = await send(agent, 'post', '/api/usuarios', { ...data, therapistId: 'otro' }).expect(201);
  const id = response.body.record.id;
  const result = await agent.get(`/api/usuarios/${id}`).expect(200);
  for (const key of Object.keys(data)) assert.equal(result.body.record[key], data[key]);
  assert.equal(result.body.record.owner, 'terapeuta-a');
  const list = await agent.get('/api/usuarios?q=prueba').expect(200);
  assert.equal(list.body.total, 1);
  assert.match(list.headers['cache-control'], /no-store/);
});
test('otro terapeuta no puede listar, leer ni modificar una ficha ajena', async () => {
  const s = setup(); const a = await s.login('a'); const b = await s.login('b');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  assert.equal((await b.get('/api/usuarios').expect(200)).body.total, 0);
  await b.get(`/api/usuarios/${body.record.id}`).expect(404);
  await send(b, 'put', `/api/usuarios/${body.record.id}`, { ...valid(), version: 1 }).expect(404);
});
test('validación rechaza nombre vacío, edad inválida y textos fuera de límite', async () => {
  const s = setup(); const a = await s.login('a');
  for (const patch of [{ name: '  ' }, { age: '' }, { age: -1 }, { age: 131 }, { age: 1.5 }, { age: '20' }, { medicalHistory: [] }, { address: 'x'.repeat(501) }, { goals: 'x'.repeat(5001) }]) {
    const res = await send(a, 'post', '/api/usuarios', { ...valid(), ...patch }).expect(400);
    assert.ok(res.body.fields);
  }
  assert.equal(s.records.size, 0);
});
test('edición incrementa versión y detecta cambios concurrentes sin sobrescribir', async () => {
  const s = setup(); const a = await s.login('a');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}`;
  const next = await send(a, 'put', path, { ...valid(), goals: 'Objetivo actualizado', version: 1 }).expect(200);
  assert.equal(next.body.record.version, 2);
  await send(a, 'put', path, { ...valid(), goals: 'Cambio obsoleto', version: 1 }).expect(409);
  assert.equal((await a.get(path)).body.record.goals, 'Objetivo actualizado');
});
test('rechaza origen externo, búsquedas inválidas e IDs inválidos', async () => {
  const s = setup(); const a = await s.login('a');
  await a.post('/api/usuarios').set('Origin', 'https://externo.example').send(valid()).expect(403);
  await a.get('/api/usuarios?page=-1').expect(400);
  await a.get('/api/usuarios?q[]=x').expect(400);
  await a.get('/api/usuarios/no-es-un-id').expect(404);
});
test('sesión de la versión anterior migra su cookie y cerrar sesión revoca acceso a fichas', async () => {
  const s = setup(); const token = randomBytes(32).toString('hex');
  s.sessions.set(hashToken(token), { id: 'a' });
  const agent = request.agent(s.app);
  const res = await agent.get('/api/auth/me').set('Cookie', `espacio_session=${token}`).expect(200);
  assert.ok(res.headers['set-cookie'].some(cookie => cookie.startsWith(`espacio_session=${token};`) && cookie.includes('Path=/api;')));
  await agent.get('/api/usuarios').expect(200);
  await send(agent, 'post', '/api/auth/logout', {}).expect(200);
  await agent.get('/api/usuarios').expect(401);
});

test('sesiones: guarda notas, conserva saltos de línea y permite consultar el historial por ficha', async () => {
  const s = setup(); const a = await s.login('a');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}/sesiones`;
  const data = { date: '2026-10-30', amount: 20000, activities: 'Actividad sintética\nSegunda actividad', objectives: 'Objetivo de prueba', observations: 'Observación de prueba', nextSteps: 'Próxima actividad' };
  const saved = await send(a, 'post', path, data).expect(201);
  for (const key of Object.keys(data)) assert.equal(saved.body.session[key], data[key]);
  await send(a, 'post', path, { date: '2026-10-29', amount: 15000, activities: 'Sesión anterior' }).expect(201);
  const history = await a.get(path).expect(200);
  assert.equal(history.body.total, 2);
  assert.equal(history.body.sessions[0].activities, data.activities);
  assert.equal(history.body.sessions[0].amount, 20000);
  assert.equal(history.body.sessions[1].amount, 15000);
  assert.match(history.headers['cache-control'], /no-store/);
  const other = await send(a, 'post', '/api/usuarios', { ...valid(), name: 'Otro usuario' }).expect(201);
  assert.equal((await a.get(`/api/usuarios/${other.body.record.id}/sesiones`)).body.total, 0);
});
test('sesiones: exige autenticación, propiedad de la ficha y origen autorizado', async () => {
  const s = setup(); const a = await s.login('a'); const b = await s.login('b');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}/sesiones`; const data = { date: '2026-10-30', amount: 20000, activities: 'Prueba' };
  await request(s.app).get(path).expect(401);
  await send(request(s.app), 'post', path, data).expect(401);
  await b.get(path).expect(404);
  await send(b, 'post', path, data).expect(404);
  await a.post(path).set('Origin', 'https://externo.example').send(data).expect(403);
  await send(a, 'post', '/api/usuarios/00000000-0000-4000-8000-000000000000/sesiones', data).expect(404);
  assert.equal((await a.get(path)).body.total, 0);
});
test('sesiones: valida fecha real, actividad obligatoria, límites y paginación', async () => {
  const s = setup(); const a = await s.login('a');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}/sesiones`;
  for (const patch of [{ date: '2026-02-30' }, { date: 'incorrecta' }, { date: null }, { activities: '  ' }, { activities: [] }, { observations: 'x'.repeat(10001) }, { objectives: 'x'.repeat(5001) }]) {
    const result = await send(a, 'post', path, { date: '2026-10-30', amount: 20000, activities: 'Prueba', ...patch }).expect(400);
    assert.ok(result.body.fields);
  }
  await a.get(`${path}?page=-1`).expect(400);
  await a.get(`${path}?page[]=1`).expect(400);
  await a.get(`${path}?desconocido=x`).expect(400);
  assert.equal((await a.get(path)).body.total, 0);
});

test('sesiones: exige valor en pesos enteros y permite cero sin alterar valores anteriores', async () => {
  const s = setup(); const a = await s.login('a');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}/sesiones`;
  for (const amount of [undefined, null, '', '20000', -1, 0.5, 1000000000, {}, []]) {
    const result = await send(a, 'post', path, { date: '2026-10-30', activities: 'Prueba', amount }).expect(400);
    assert.ok(result.body.fields.amount);
  }
  for (const amount of [20000, 35000, 0, 999999999]) await send(a, 'post', path, { date: '2026-10-30', activities: 'Prueba', amount }).expect(201);
  assert.deepEqual((await a.get(path)).body.sessions.map(row => row.amount), [20000, 35000, 0, 999999999]);
});

test('sesiones: permite corregir una atención a una fecha anterior, sus notas y su valor sin duplicarla', async () => {
  const s = setup(); const a = await s.login('a');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const path = `/api/usuarios/${body.record.id}/sesiones`;
  const data = { date: '2026-10-30', amount: 20000, activities: 'Prueba' };
  const saved = await send(a, 'post', path, data).expect(201);
  const url = `${path}/${saved.body.session.id}`;
  const fetched = await a.get(url).expect(200);
  assert.equal(fetched.body.session.amount, 20000);
  const updated = await send(a, 'put', url, { ...data, date: '2026-10-23', amount: 25000, activities: 'Atención registrada después', version: 1 }).expect(200);
  assert.equal(updated.body.session.version, 2);
  const history = await a.get(path).expect(200);
  assert.equal(history.body.total, 1);
  assert.equal(history.body.sessions[0].date, '2026-10-23');
  assert.equal(history.body.sessions[0].amount, 25000);
  assert.equal(history.body.sessions[0].activities, 'Atención registrada después');
  await send(a, 'put', url, { ...data, version: 1 }).expect(409);
  await send(a, 'put', url, { ...data, amount: -1, version: 2 }).expect(400);
  await send(a, 'put', url, data).expect(400);
  assert.equal((await a.get(url)).body.session.amount, 25000);
});
test('sesiones: protege consulta y edición de sesiones ajenas o asociadas a otra ficha', async () => {
  const s = setup(); const a = await s.login('a'); const b = await s.login('b');
  const { body } = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const data = { date: '2026-10-23', amount: 20000, activities: 'Prueba', version: 1 };
  const path = `/api/usuarios/${body.record.id}/sesiones`;
  const saved = await send(a, 'post', path, data).expect(201);
  const url = `${path}/${saved.body.session.id}`;
  await request(s.app).get(url).expect(401);
  await send(request(s.app), 'put', url, data).expect(401);
  await b.get(url).expect(404);
  await send(b, 'put', url, data).expect(404);
  await a.put(url).set('Origin', 'https://externo.example').send(data).expect(403);
  const other = await send(a, 'post', '/api/usuarios', valid()).expect(201);
  const wrong = `/api/usuarios/${other.body.record.id}/sesiones/${saved.body.session.id}`;
  await a.get(wrong).expect(404);
  await send(a, 'put', wrong, data).expect(404);
  await a.get(`${path}/invalido`).expect(404);
});
