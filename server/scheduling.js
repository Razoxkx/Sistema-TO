import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { currentMonth, validMonth } from '../shared/finance-month.js';
import { validId, validateAppointment, validatePlan } from '../shared/scheduling.js';
const validPage = query => (query.page === undefined || typeof query.page === 'string') && Number.isSafeInteger(Number(query.page || 1)) && Number(query.page || 1) >= 1 && Number(query.page || 1) <= 100000;
export function calendarRouter(repository, authenticate) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); router.use(authenticate);
  router.get('/', async (req, res) => {
    const month = req.query.mes ?? currentMonth();
    if (!validMonth(month) || !validPage(req.query) || Object.keys(req.query).some(key => !['mes','page'].includes(key))) return res.status(400).json({ error: 'Selecciona un mes válido.' });
    res.json(await repository.calendarSessions(req.user.id, month, Number(req.query.page || 1)));
  });
  router.post('/', async (req, res) => {
    const { value, fields } = validateAppointment(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los datos de la sesión.', fields });
    const session = await repository.createClinicalSession(req.user.id, value.recordId, randomUUID(), { ...value, status: 'scheduled' });
    if (!session) return res.status(404).json({ error: 'No se encontró el usuario.' });
    res.status(201).json({ session: { ...session, recordId: value.recordId } });
  });
  router.param('id', (_req, res, next, id) => { if (!validId(id)) return res.status(404).json({ error: 'No se encontró la sesión.' }); next(); });
  router.get('/:id', async (req, res) => { const session = await repository.findAppointment(req.user.id, req.params.id); if (!session) return res.status(404).json({ error: 'No se encontró la sesión.' }); res.json({ session }); });
  router.put('/:id', async (req, res) => {
    const existing = await repository.findAppointment(req.user.id, req.params.id); if (!existing) return res.status(404).json({ error: 'No se encontró la sesión.' });
    const { value, fields } = validateAppointment(req.body, false);
    if (Object.keys(fields).length || !Number.isSafeInteger(req.body.version) || req.body.version < 1) return res.status(400).json({ error: 'Revisa los datos de la sesión.', fields });
    if (!value.title) value.title = existing.title;
    const session = await repository.updateAppointment(req.user.id, req.params.id, req.body.version, value);
    if (!session) return res.status(409).json({ error: 'La sesión cambió. Vuelve a abrirla antes de guardar.' });
    res.json({ session });
  });
  return router;
}
export function plansRouter(repository) {
  const router = Router({ mergeParams: true });
  router.use(async (req, res, next) => { if (!await repository.findRecord(req.user.id, req.params.id)) return res.status(404).json({ error: 'No se encontró la ficha clínica.' }); next(); });
  router.get('/', async (req, res) => { if (!validPage(req.query) || Object.keys(req.query).some(key => key !== 'page')) return res.status(400).json({ error: 'La página no es válida.' }); res.json(await repository.listPlans(req.user.id, req.params.id, Number(req.query.page || 1))); });
  router.param('planId', (_req, res, next, id) => { if (!validId(id)) return res.status(404).json({ error: 'No se encontró la planificación.' }); next(); });
  router.get('/:planId', async (req, res) => { const plan = await repository.findPlan(req.user.id, req.params.id, req.params.planId); if (!plan) return res.status(404).json({ error: 'No se encontró la planificación.' }); res.json({ plan }); });
  async function save(req, res, updating) {
    if (updating && !await repository.findPlan(req.user.id, req.params.id, req.params.planId)) return res.status(404).json({ error: 'No se encontró la planificación.' });
    const { value, fields } = validatePlan(req.body);
    if (Object.keys(fields).length || (updating && (!Number.isSafeInteger(req.body.version) || req.body.version < 1))) return res.status(400).json({ error: 'Revisa los datos de la planificación.', fields });
    const session = await repository.findClinicalSession(req.user.id, req.params.id, value.sessionId);
    if (!session || !session.time) return res.status(404).json({ error: 'Selecciona una sesión de este usuario con fecha y hora asignadas.' });
    const plan = updating ? await repository.updatePlan(req.user.id, req.params.id, req.params.planId, req.body.version, value) : await repository.createPlan(req.user.id, req.params.id, randomUUID(), value);
    if (!plan) return res.status(409).json({ error: 'La planificación o la sesión cambió. Vuelve a revisar los datos antes de guardar.' });
    res.status(updating ? 200 : 201).json({ plan });
  }
  router.post('/', (req, res) => save(req, res, false)); router.put('/:planId', (req, res) => save(req, res, true));
  return router;
}
