import { Router } from 'express';
import { currentMonth, validMonth } from '../shared/finance-month.js';

export function financeRouter(repository, authenticate) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate);
  router.get('/', async (req, res) => {
    const month = req.query.mes ?? currentMonth();
    const page = Number(req.query.page ?? 1);
    if (Object.keys(req.query).some(key => !['mes', 'page'].includes(key)) || !validMonth(month) || (req.query.page !== undefined && typeof req.query.page !== 'string') || !Number.isSafeInteger(page) || page < 1 || page > 100000) {
      return res.status(400).json({ error: 'Selecciona un mes y una página válidos.' });
    }
    res.json(await repository.getFinances(req.user.id, month, page));
  });
  return router;
}
