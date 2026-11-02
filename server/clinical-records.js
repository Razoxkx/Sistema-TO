import { Router } from 'express';
import { plansRouter } from './scheduling.js';
import { validTime } from '../shared/scheduling.js';
import { reportsRouter } from './reports.js';
import { randomUUID } from 'node:crypto';
import { maxSessionAmount, sessionFields } from '../shared/session-fields.js';
import { clinicalFields } from '../shared/clinical-fields.js';

export function validateRecord(body) {
  const fields = {};
  const record = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { name: 'Completa los datos de la ficha.' } };
  for (const field of clinicalFields) {
    const value = body[field.key];
    if (field.key === 'age') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 130) fields.age = 'Ingresa una edad entera entre 0 y 130 años.';
      else record.age = value;
      continue;
    }
    if (value !== undefined && typeof value !== 'string') { fields[field.key] = 'Ingresa un texto válido.'; continue; }
    const text = (value || '').trim();
    if (field.required && !text) fields[field.key] = 'Ingresa el nombre del usuario.';
    else if (text.length > field.max) fields[field.key] = `Usa como máximo ${field.max} caracteres.`;
    record[field.key] = text;
  }
  return { record, fields };
}

export function validateClinicalSession(body) {
  const fields = {};
  const session = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { date: 'Completa los datos de la sesión.' } };
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length > 200) fields.title = 'Usa un nombre de hasta 200 caracteres.';
    else session.title = body.title.trim();
  }
  if (body.time !== undefined) {
    if (body.time !== '' && !validTime(body.time)) fields.time = 'Ingresa una hora válida.';
    else session.time = body.time || null;
  }
  const date = body.date;
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > '2100-12-31') fields.date = 'Ingresa una fecha válida entre 1900 y 2100.';
  else session.date = date;
  if (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount < 0 || body.amount > maxSessionAmount) fields.amount = 'Ingresa un valor en pesos enteros entre $0 y $999.999.999.';
  else session.amount = body.amount;
  for (const field of sessionFields) {
    const value = body[field.key];
    if (value !== undefined && typeof value !== 'string') { fields[field.key] = 'Ingresa un texto válido.'; continue; }
    const text = (value || '').trim();
    if (field.required && !text) fields[field.key] = 'Describe las actividades realizadas.';
    else if (text.length > field.max) fields[field.key] = `Usa como máximo ${field.max} caracteres.`;
    session[field.key] = text;
  }
  return { session, fields };
}

export function clinicalRouter(repository, authenticate, reportGenerator) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate);
  router.get('/', async (req, res) => {
    if (Object.keys(req.query).some(key => !['q', 'page'].includes(key))) return res.status(400).json({ error: 'La búsqueda no es válida.' });
    if ((req.query.q !== undefined && typeof req.query.q !== 'string') || (req.query.q?.length || 0) > 200) return res.status(400).json({ error: 'La búsqueda no es válida.' });
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ error: 'La página no es válida.' });
    res.json(await repository.listRecords(req.user.id, (req.query.q || '').trim(), page));
  });
  router.param('id', (req, res, next, id) => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    next();
  });
  router.use('/:id/planificaciones', plansRouter(repository));
  router.get('/:id/sesiones-agendadas', async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || Object.keys(req.query).some(key => key !== 'page') || (req.query.page !== undefined && typeof req.query.page !== 'string')) return res.status(400).json({ error: 'La página no es válida.' });
    if (!await repository.findRecord(req.user.id, req.params.id)) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    res.json(await repository.sessionChoices(req.user.id, req.params.id, page));
  });
  router.use('/:id/informes', reportsRouter(repository, reportGenerator));
  router.param('sessionId', (req, res, next, id) => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return res.status(404).json({ error: 'No se encontró la sesión.' });
    next();
  });
  router.get('/:id/sesiones/:sessionId', async (req, res) => {
    const session = await repository.findClinicalSession(req.user.id, req.params.id, req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'No se encontró la sesión.' });
    res.json({ session });
  });
  router.put('/:id/sesiones/:sessionId', async (req, res) => {
    if (!await repository.findClinicalSession(req.user.id, req.params.id, req.params.sessionId)) return res.status(404).json({ error: 'No se encontró la sesión.' });
    const { session, fields } = validateClinicalSession(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los campos indicados.', fields });
    if (!Number.isSafeInteger(req.body.version) || req.body.version < 1) return res.status(400).json({ error: 'Recarga la sesión antes de editarla.' });
    const saved = await repository.updateClinicalSession(req.user.id, req.params.id, req.params.sessionId, req.body.version, session);
    if (!saved) return res.status(409).json({ error: 'La sesión cambió desde que la abriste. Conserva tus notas y vuelve a abrirla para ver la última versión.' });
    res.json({ session: saved });
  });
  router.get('/:id/sesiones', async (req, res) => {
    const page = Number(req.query.page || 1);
    if (Object.keys(req.query).some(key => key !== 'page') || (req.query.page !== undefined && typeof req.query.page !== 'string') || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ error: 'La página no es válida.' });
    if (!await repository.findRecord(req.user.id, req.params.id)) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    res.json(await repository.listClinicalSessions(req.user.id, req.params.id, page));
  });
  router.post('/:id/sesiones', async (req, res) => {
    if (!await repository.findRecord(req.user.id, req.params.id)) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    const { session, fields } = validateClinicalSession(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los campos indicados.', fields });
    const saved = await repository.createClinicalSession(req.user.id, req.params.id, randomUUID(), session);
    if (!saved) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    res.status(201).json({ session: saved });
  });
  router.get('/:id', async (req, res) => {
    const record = await repository.findRecord(req.user.id, req.params.id);
    if (!record) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    res.json({ record });
  });
  router.post('/', async (req, res) => {
    const { record, fields } = validateRecord(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los campos indicados.', fields });
    const saved = await repository.createRecord(req.user.id, randomUUID(), record);
    res.status(201).json({ record: saved });
  });
  router.put('/:id', async (req, res) => {
    const { record, fields } = validateRecord(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los campos indicados.', fields });
    if (!Number.isSafeInteger(req.body.version) || req.body.version < 1) return res.status(400).json({ error: 'Recarga la ficha antes de editarla.' });
    const existing = await repository.findRecord(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    const saved = await repository.updateRecord(req.user.id, req.params.id, req.body.version, record);
    if (!saved) return res.status(409).json({ error: 'La ficha cambió desde que la abriste. Conserva tus notas y recarga la ficha para ver la última versión.' });
    res.json({ record: saved });
  });
  return router;
}
