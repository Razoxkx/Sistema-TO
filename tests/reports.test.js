import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { createReportGenerator } from '../server/report-ai.js';
import { reportFields } from '../shared/report-fields.js';
const origin = 'http://localhost:5173';
const recordId = '00000000-0000-4000-8000-000000000001';
const content = () => Object.fromEntries(reportFields.map(field => [field.key, { text: `Texto de prueba: ${field.label}`, sources: [1] }]));
const clone = value => JSON.parse(JSON.stringify(value));
function setup(enabled = true) {
  const tokens = new Map(); const reports = new Map(); let sources = [{ number: 1, id: randomUUID(), version: 1, date: '2026-10-23', activities: 'Actividad sintética', objectives: 'Objetivo sintético', observations: 'Observación sintética', nextSteps: 'Acuerdo sintético' }];
  const repository = {
    upsertUser: async profile => ({ id: profile.googleId, name: profile.name }),
    createSession: async (id, token) => tokens.set(token, { id, name: 'Terapeuta de prueba' }),
    findSession: async token => tokens.get(token), deleteSession: async token => tokens.delete(token),
    findRecord: async (owner, id) => owner === 'a' && id === recordId ? { id, name: 'Usuario de prueba' } : null,
    reportSources: async (_owner, _id, from, to) => clone(sources.filter(source => (!from || source.date >= from) && (!to || source.date <= to))),
    listReports: async () => ({ reports: [...reports.values()], total: reports.size, page: 1, pageSize: 20 }),
    createReport: async (_owner, _record, id, data) => { const row = { ...clone(data), id, periodStart: data.sources[0].date, periodEnd: data.sources.at(-1).date, version: 1, status: 'draft' }; reports.set(id, row); return clone(row); },
    findReport: async (owner, id, reportId) => owner === 'a' && id === recordId && reports.has(reportId) ? clone(reports.get(reportId)) : null,
    updateReport: async (_owner, _id, reportId, data) => { const row = reports.get(reportId); if (row.version !== data.version) return null; const next = { ...row, ...clone(data), version: row.version + 1 }; reports.set(reportId, next); return clone(next); },
  };
  let calls = 0;
  const app = createApp({ repository, reportGenerator: { enabled, model: 'test-model', generate: async () => { calls++; return content(); } }, config: { origin, clientId: 'test', sessionSecret: 'test-secret-long-enough-for-authentication', production: false, allowedEmails: [] }, verifyGoogle: async credential => JSON.parse(credential) });
  return { app, reports, get calls() { return calls; }, changeSources(next) { sources = next; }, async login(id = 'a') { const agent = request.agent(app); const config = await agent.get('/api/auth/config'); await agent.post('/api/auth/google').set('Origin', origin).send({ credential: JSON.stringify({ sub: id, name: 'Prueba', email: 'test@example.com', email_verified: true, nonce: config.body.nonce }) }).expect(200); return agent; } };
}
const path = `/api/usuarios/${recordId}/informes`;
const send = (agent, method, url, body) => agent[method](url).set('Origin', origin).send(body);
test('informes: requiere sesión, propiedad de la ficha y consentimiento antes de llamar a la IA', async () => {
  const s = setup(); await request(s.app).get(path).expect(401);
  const a = await s.login(); const b = await s.login('b');
  await b.get(path).expect(404); await send(b, 'post', path, { consent: true }).expect(404);
  const preview = await a.get(`${path}/fuentes`).expect(200);
  await send(a, 'post', path, { digest: preview.body.digest }).expect(400);
  await a.post(path).set('Origin', 'https://externo.example').send({ consent: true, digest: preview.body.digest }).expect(403);
  assert.equal(s.calls, 0);
});
test('informes: genera borrador con fuentes, permite revisión y exporta PDF, sin acceso de otro terapeuta', async () => {
  const s = setup(); const a = await s.login(); const b = await s.login('b');
  const preview = await a.get(`${path}/fuentes`).expect(200);
  const saved = await send(a, 'post', path, { consent: true, digest: preview.body.digest }).expect(201);
  const url = `${path}/${saved.body.report.id}`;
  assert.equal(saved.body.report.status, 'draft'); assert.equal(s.calls, 1);
  const listed = await a.get(path).expect(200); assert.equal(listed.body.total, 1); assert.equal(listed.body.ai.enabled, true);
  const edited = await send(a, 'put', url, { title: 'Informe revisado', content: content(), status: 'reviewed', version: 1 }).expect(200);
  assert.equal(edited.body.report.version, 2);
  await send(a, 'put', url, { title: 'Anterior', content: content(), status: 'draft', version: 1 }).expect(409);
  const invalid = content(); invalid.progress.sources = [2];
  await send(a, 'put', url, { title: 'Inválido', content: invalid, status: 'reviewed', version: 2 }).expect(400);
  await b.get(url).expect(404); await b.get(`${url}/pdf`).expect(404);
  await send(b, 'put', url, { title: 'Ajeno', content: content(), status: 'reviewed', version: 2 }).expect(404);
  const pdf = await a.get(`${url}/pdf`).expect('Content-Type', /application\/pdf/).expect(200);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF'); assert.match(pdf.headers['cache-control'], /no-store/);
  assert.equal((await a.get(url)).body.report.status, 'reviewed');
});
test('informes: detecta cambios en las fuentes, valida rangos y no inventa informes con clave ausente o sin sesiones', async () => {
  const s = setup(); const a = await s.login(); const preview = await a.get(`${path}/fuentes`).expect(200);
  s.changeSources([{ number: 1, id: randomUUID(), version: 2, date: '2026-10-23', activities: 'Actividad corregida' }]);
  await send(a, 'post', path, { consent: true, digest: preview.body.digest }).expect(409); assert.equal(s.calls, 0);
  await a.get(`${path}/fuentes?from=2026-02-30&to=2026-10-30`).expect(400);
  await a.get(`${path}/fuentes?from=2026-10-30&to=2026-10-20`).expect(400);
  await a.get(`${path}/fuentes?from=2026-10-20`).expect(400);
  await a.get(`${path}/fuentes?from=2026-01-01&to=2026-01-31`).expect(422);
  s.changeSources(Array.from({ length: 201 }, (_, number) => ({ number: number + 1, date: '2026-10-23' })));
  await a.get(`${path}/fuentes`).expect(422);
  const disabled = setup(false); const user = await disabled.login();
  await send(user, 'post', path, { consent: true, digest: 'x' }).expect(503); assert.equal(disabled.calls, 0);
});
test('IA: usa Responses con JSON estricto y store:false; solo envía las notas y fechas, con referencias válidas', async () => {
  let payload;
  const generator = createReportGenerator({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' }, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(content()) }] }] }) };
  });
  const result = await generator.generate([{ number: 1, id: 'private-id', version: 1, date: '2026-10-23', name: 'Nombre privado', amount: 20000, activities: 'Actividad sintética', observations: 'Nota sintética' }]);
  assert.equal(result.summary.sources[0], 1); assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
  assert.ok(!payload.input[0].content.includes('private-id')); assert.ok(!payload.input[0].content.includes('Nombre privado')); assert.ok(!payload.input[0].content.includes('20000'));
});
test('IA: rechaza respuestas incompletas, negativas, referencias inventadas y errores del proveedor', async () => {
  const invalid = content(); invalid.progress.sources = [99];
  for (const data of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }, { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(invalid) }] }] }]) {
    const generator = createReportGenerator({ OPENAI_API_KEY: 'test-key' }, async () => ({ ok: true, json: async () => data }));
    await assert.rejects(generator.generate([{ number: 1 }]), error => error.status === 502);
  }
  const limited = createReportGenerator({ OPENAI_API_KEY: 'test-key' }, async () => ({ ok: false, status: 429 }));
  await assert.rejects(limited.generate([]), /saldo/);
  const exhausted = createReportGenerator({ OPENAI_API_KEY: 'test-key' }, async () => ({ ok: false, status: 429, json: async () => ({ error: { code: 'credit_balance_exhausted' } }) }));
  await assert.rejects(exhausted.generate([]), /cuota disponible/);
});
