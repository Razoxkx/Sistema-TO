import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { createRepository } from '../server/db.js';
import { createApp } from '../server/app.js';
import { emptyClinicalRecord } from '../shared/clinical-fields.js';
import { reportFields } from '../shared/report-fields.js';

test('MySQL: crea, busca, recupera y actualiza una ficha sin perder campos', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
  const repository = createRepository(process.env);
  const googleId = `integration-test-${randomUUID()}`;
  let therapist;
  try {
    await repository.initialize();
    const app = createApp({ repository, reportGenerator: { enabled: true, model: 'test-only', generate: async () => Object.fromEntries(reportFields.map(field => [field.key, { text: `Texto sintético: ${field.label}`, sources: [1] }])) }, config: { origin: 'http://localhost:5173', sessionSecret: 'integration-test-session-secret-32-chars', clientId: 'test', allowedEmails: [], production: false }, verifyGoogle: async credential => JSON.parse(credential) });
    const agent = request.agent(app);
    const settings = await agent.get('/api/auth/config').expect(200);
    const login = await agent.post('/api/auth/google').set('Origin', 'http://localhost:5173').send({ credential: JSON.stringify({ sub: googleId, name: 'Prueba de integración', email: 'integration@example.com', email_verified: true, nonce: settings.body.nonce }) }).expect(200);
    therapist = login.body.user;
    const data = { ...emptyClinicalRecord(), name: 'Registro sintético de prueba', age: 34 };
    for (const field of Object.keys(data).filter(key => !['name', 'age'].includes(key))) data[field] = `Prueba: ${field}\nTexto de verificación áéíóú`;
    const saved = await agent.post('/api/usuarios').set('Origin', 'http://localhost:5173').send(data).expect(201);
    const id = saved.body.record.id;
    const fetched = await agent.get(`/api/usuarios/${id}`).expect(200);
    for (const key of Object.keys(data)) assert.equal(fetched.body.record[key], data[key]);
    const list = await agent.get('/api/usuarios?q=sintético').expect(200);
    assert.equal(list.body.total, 1); assert.equal(list.body.records[0].id, id);
    assert.equal((await agent.get('/api/usuarios?q=%25')).body.total, 0);
    const updated = await agent.put(`/api/usuarios/${id}`).set('Origin', 'http://localhost:5173').send({ ...data, goals: 'Objetivo sintético actualizado', version: 1 }).expect(200);
    assert.equal(updated.body.record.version, 2);
    assert.equal(updated.body.record.goals, 'Objetivo sintético actualizado');
    await agent.put(`/api/usuarios/${id}`).set('Origin', 'http://localhost:5173').send({ ...data, version: 1 }).expect(409);
    const sessionData = { date: '2026-10-30', amount: 20000, activities: 'Actividad de prueba\nSegunda actividad', objectives: 'Objetivo sintético', observations: 'Observación sintética', nextSteps: 'Próxima atención' };
    const sessionSaved = await agent.post(`/api/usuarios/${id}/sesiones`).set('Origin', 'http://localhost:5173').send(sessionData).expect(201);
    await agent.post(`/api/usuarios/${id}/sesiones`).set('Origin', 'http://localhost:5173').send({ ...sessionData, date: '2026-10-29', amount: 35000 }).expect(201);
    await agent.post(`/api/usuarios/${id}/sesiones`).set('Origin', 'http://localhost:5173').send({ ...sessionData, date: '2026-10-28', amount: 0 }).expect(201);
    // A fresh repository reads the persisted session with its exact date and notes.
    const freshRepository = createRepository(process.env);
    try {
      const history = await freshRepository.listClinicalSessions(therapist.id, id, 1);
      assert.equal(history.total, 3);
      assert.deepEqual(history.sessions.map(row => row.amount), [20000, 35000, 0]);
      for (const key of Object.keys(sessionData)) assert.equal(history.sessions[0][key], sessionData[key]);
      assert.equal((await freshRepository.listClinicalSessions('0', id, 1)).total, 0);
      assert.equal(await freshRepository.createClinicalSession('0', id, randomUUID(), sessionData), null);
      const url = `/api/usuarios/${id}/sesiones/${sessionSaved.body.session.id}`;
      const before = await agent.get(url).expect(200);
      assert.equal(before.body.session.version, 1);
      await agent.put(url).set('Origin', 'http://localhost:5173').send({ ...sessionData, date: '2026-10-23', amount: 25000, activities: 'Atención de la semana anterior', version: 1 }).expect(200);
      const edited = await freshRepository.findClinicalSession(therapist.id, id, sessionSaved.body.session.id);
      assert.equal(edited.date, '2026-10-23'); assert.equal(edited.amount, 25000); assert.equal(edited.version, 2);
      assert.equal(edited.activities, 'Atención de la semana anterior');
      assert.equal((await freshRepository.listClinicalSessions(therapist.id, id, 1)).total, 3);
      await agent.put(url).set('Origin', 'http://localhost:5173').send({ ...sessionData, version: 1 }).expect(409);
      assert.equal(await freshRepository.updateClinicalSession('0', id, sessionSaved.body.session.id, 2, sessionData), null);
      // Monthly finances use session dates, include every page in totals, and isolate therapists.
      const otherRecord = await agent.post('/api/usuarios').set('Origin', 'http://localhost:5173').send({ ...data, name: 'Segundo usuario sintético' }).expect(201);
      const secondId = otherRecord.body.record.id;
      for (const [date, amount] of [['2026-09-30', 20000], ['2026-10-01', 40000], ['2026-10-31', 0], ['2026-11-01', 30000], ['2025-12-31', 80000], ['2027-01-01', 90000]]) await repository.createClinicalSession(therapist.id, secondId, randomUUID(), { ...sessionData, date, amount });
      // Legacy sessions without an amount are counted but never assigned a fictitious value.
      await repository.createClinicalSession(therapist.id, secondId, randomUUID(), { ...sessionData, date: '2026-10-15', amount: null });
      const october = await agent.get('/api/finanzas?mes=2026-10').expect(200);
      assert.deepEqual(october.body.summary, { totalAmount: 100000, sessionCount: 6, userCount: 2, unpricedSessions: 1 });
      assert.equal(october.body.users.find(row => row.id === id).totalAmount, 60000);
      assert.equal(october.body.users.find(row => row.id === secondId).totalAmount, 40000);
      assert.equal(october.body.yearMonths.length, 12);
      assert.equal(october.body.yearMonths.find(row => row.month === '2026-09').totalAmount, 20000);
      assert.equal(october.body.yearMonths.find(row => row.month === '2026-11').totalAmount, 30000);
      assert.equal(october.body.yearMonths.find(row => row.month === '2026-12').totalAmount, 0);
      const empty = await agent.get('/api/finanzas?mes=2026-02').expect(200);
      assert.equal(empty.body.summary.totalAmount, 0); assert.equal(empty.body.users.length, 0);
      assert.equal((await repository.getFinances('0', '2026-10', 1)).summary.totalAmount, 0);
      assert.equal((await agent.get('/api/finanzas?mes=2025-12')).body.summary.totalAmount, 80000);
      assert.equal((await agent.get('/api/finanzas?mes=2027-01')).body.summary.totalAmount, 90000);
      // Editing a session moves its value to the selected month, with no historical reset or duplication.
      await agent.put(url).set('Origin', 'http://localhost:5173').send({ ...sessionData, date: '2026-09-23', amount: 45000, version: 2 }).expect(200);
      assert.equal((await agent.get('/api/finanzas?mes=2026-10')).body.summary.totalAmount, 75000);
      assert.equal((await agent.get('/api/finanzas?mes=2026-09')).body.summary.totalAmount, 65000);
      for (let index = 0; index < 20; index++) {
        const userId = randomUUID();
        await repository.createRecord(therapist.id, userId, { ...data, name: `Usuario de paginación ${index}` });
        await repository.createClinicalSession(therapist.id, userId, randomUUID(), { ...sessionData, date: '2026-10-15', amount: 1000 });
      }
      const pageOne = await repository.getFinances(therapist.id, '2026-10', 1);
      const pageTwo = await repository.getFinances(therapist.id, '2026-10', 2);
      assert.equal(pageOne.users.length, 20); assert.equal(pageTwo.users.length, 2);
      assert.equal(pageTwo.summary.totalAmount, 95000); assert.equal(pageTwo.totalUsers, 22);
      assert.equal(new Set([...pageOne.users, ...pageTwo.users].map(row => row.id)).size, 22);
      const reportPath = `/api/usuarios/${id}/informes`;
      const preview = await agent.get(`${reportPath}/fuentes`).expect(200);
      const generated = await agent.post(reportPath).set('Origin', 'http://localhost:5173').send({ consent: true, digest: preview.body.digest }).expect(201);
      const reportId = generated.body.report.id;
      const persisted = await freshRepository.findReport(therapist.id, id, reportId);
      assert.equal(persisted.status, 'draft'); assert.equal(persisted.sources.length, 3);
      assert.equal(persisted.content.summary.text, 'Texto sintético: Resumen del proceso');
      assert.equal((await freshRepository.listReports(therapist.id, id, 1)).total, 1);
      assert.equal(await freshRepository.findReport('0', id, reportId), undefined);
      const reviewed = await agent.put(`${reportPath}/${reportId}`).set('Origin', 'http://localhost:5173').send({ title: 'Informe sintético revisado', content: persisted.content, status: 'reviewed', version: 1 }).expect(200);
      assert.equal(reviewed.body.report.version, 2); assert.ok(reviewed.body.report.reviewedAt);
      const pdf = await agent.get(`${reportPath}/${reportId}/pdf`).expect(200);
      assert.match(pdf.headers['content-type'], /application\/pdf/);
      assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
      await agent.put(`${reportPath}/${reportId}`).set('Origin', 'http://localhost:5173').send({ title: 'Edición obsoleta', content: persisted.content, status: 'draft', version: 1 }).expect(409);
      const sourceBefore = persisted.sources.find(source => source.id === sessionSaved.body.session.id);
      await freshRepository.updateClinicalSession(therapist.id, id, sessionSaved.body.session.id, 3, { ...sessionData, activities: 'Cambio posterior al informe' });
      const after = await freshRepository.findReport(therapist.id, id, reportId);
      assert.deepEqual(after.sources.find(source => source.id === sourceBefore.id), sourceBefore);



    } finally { await freshRepository.close(); }

  } finally {
    if (therapist) {
      const env = process.env;
      const connection = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME });
      try { await connection.execute('DELETE FROM clinical_records WHERE therapist_id = ?', [therapist.id]); await connection.execute('DELETE FROM users WHERE id = ? AND google_id = ?', [therapist.id, googleId]); }
      finally { await connection.end(); }
    }
    await repository.close();
  }
});
