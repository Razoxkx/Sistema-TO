import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomUUID } from 'node:crypto';
import { maxReportSessions, validReportDate, validateReportContent } from '../shared/report-fields.js';
import { createReportPdf } from './report-pdf.js';
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
const digest = sources => createHash('sha256').update(JSON.stringify(sources)).digest('hex');
function range(body) {
  const from = body?.from || null; const to = body?.to || null;
  if ((from !== null && !validReportDate(from)) || (to !== null && !validReportDate(to)) || Boolean(from) !== Boolean(to) || (from && from > to)) return null;
  return { from, to };
}
export function reportsRouter(repository, generator = { enabled: false }) {
  const router = Router({ mergeParams: true });
  const pending = new Set();
  router.use(async (req, res, next) => {
    const record = await repository.findRecord(req.user.id, req.params.id);
    if (!record) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
    req.record = record; next();
  });
  async function getSources(req, res, selection) {
    const sources = await repository.reportSources(req.user.id, req.params.id, selection.from, selection.to);
    if (!sources.length) { res.status(422).json({ error: 'No hay sesiones en el período seleccionado.' }); return null; }
    if (sources.length > maxReportSessions || JSON.stringify(sources).length > 180000) { res.status(422).json({ error: 'El período contiene demasiadas notas para un informe. Selecciona un rango de fechas más corto.' }); return null; }
    return sources;
  }
  router.get('/', async (req, res) => {
    const page = Number(req.query.page || 1);
    if (Object.keys(req.query).some(key => key !== 'page') || (req.query.page !== undefined && typeof req.query.page !== 'string') || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ error: 'La página no es válida.' });
    res.json({ ...await repository.listReports(req.user.id, req.params.id, page), ai: { enabled: generator.enabled, provider: 'OpenAI' } });
  });
  router.get('/fuentes', async (req, res) => {
    const selection = range(req.query);
    if (!selection || Object.keys(req.query).some(key => !['from', 'to'].includes(key))) return res.status(400).json({ error: 'Selecciona un rango de fechas válido.' });
    const sources = await getSources(req, res, selection);
    if (sources) res.json({ sources, digest: digest(sources) });
  });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Has generado varios informes. Espera unos minutos antes de volver a intentar.' } });
  router.post('/', limiter, async (req, res) => {
    if (!generator.enabled) return res.status(503).json({ error: 'La generación con IA requiere configurar OPENAI_API_KEY en el servidor.' });
    const selection = range(req.body);
    if (!selection || req.body?.consent !== true || typeof req.body?.digest !== 'string') return res.status(400).json({ error: 'Revisa las sesiones y autoriza el envío de sus notas a OpenAI.' });
    const sources = await getSources(req, res, selection);
    if (!sources) return;
    if (digest(sources) !== req.body.digest) return res.status(409).json({ error: 'Las sesiones cambiaron. Vuelve a revisar el período antes de generar el informe.' });
    const key = String(req.user.id);
    if (pending.has(key)) return res.status(409).json({ error: 'Ya estás generando un informe. Espera a que termine.' });
    pending.add(key);
    try {
      const content = await generator.generate(sources);
      if (!validateReportContent(content, sources.length)) return res.status(502).json({ error: 'La IA devolvió contenido o referencias no válidos.' });
      const report = await repository.createReport(req.user.id, req.params.id, randomUUID(), { title: 'Informe de terapia ocupacional', sources, content, model: generator.model });
      if (!report) return res.status(404).json({ error: 'No se encontró la ficha clínica.' });
      res.status(201).json({ report });
    } catch (error) {
      if ([502, 503].includes(error.status)) return res.status(error.status).json({ error: error.message });
      throw error;
    } finally { pending.delete(key); }
  });
  router.param('reportId', (_req, res, next, id) => { if (!uuid(id)) return res.status(404).json({ error: 'No se encontró el informe.' }); next(); });
  router.get('/:reportId', async (req, res) => {
    const report = await repository.findReport(req.user.id, req.params.id, req.params.reportId);
    if (!report) return res.status(404).json({ error: 'No se encontró el informe.' });
    res.json({ report });
  });
  router.put('/:reportId', async (req, res) => {
    const existing = await repository.findReport(req.user.id, req.params.id, req.params.reportId);
    if (!existing) return res.status(404).json({ error: 'No se encontró el informe.' });
    const body = req.body;
    if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || !['draft', 'reviewed'].includes(body.status) || !Number.isSafeInteger(body.version) || body.version < 1 || !validateReportContent(body.content, existing.sources.length)) return res.status(400).json({ error: 'Revisa el título, los textos y las referencias del informe.' });
    const report = await repository.updateReport(req.user.id, req.params.id, req.params.reportId, { title: body.title.trim(), status: body.status, content: body.content, version: body.version });
    if (!report) return res.status(409).json({ error: 'El informe cambió desde que lo abriste. Conserva tus cambios y vuelve a abrirlo.' });
    res.json({ report });
  });
  router.get('/:reportId/pdf', async (req, res) => {
    const report = await repository.findReport(req.user.id, req.params.id, req.params.reportId);
    if (!report) return res.status(404).json({ error: 'No se encontró el informe.' });
    const pdf = await createReportPdf(report, req.record, req.user);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="informe-${report.id}.pdf"`);
    res.send(pdf);
  });
  return router;
}
