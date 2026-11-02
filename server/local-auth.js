import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { hashPassword, verifyPassword, validPassword, normalizeEmail, validEmail } from './passwords.js';
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, picture: user.picture || null });
export function localAuthRouter({ repository, authenticate, issueSession, config }) {
  const router = Router();
  router.use((_req, res, next) => { if (!config.localAuthEnabled) return res.status(503).json({ error: 'El acceso local no está habilitado.' }); next(); });
  const loginLimit = rateLimit({ windowMs: 15*60*1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos de acceso. Espera 15 minutos antes de volver a intentar.' } });
  const registerLimit = rateLimit({ windowMs: 15*60*1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos de registro. Espera unos minutos.' } });
  router.post('/local', loginLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email); const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || !password.length || password.length > 128) return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
    const user = await repository.findLocalUser(email);
    const valid = await verifyPassword(password, user?.passwordHash);
    if (!valid || !user || (config.allowedEmails.length && !config.allowedEmails.includes(email))) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    const result = publicUser(user); await issueSession(req, res, result);
    res.json({ user: result });
  });
  router.post('/register', registerLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email); const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const fields = {};
    if (!name || name.length > 100) fields.name = 'Ingresa tu nombre (máximo 100 caracteres).';
    if (!validEmail(email)) fields.email = 'Ingresa un correo válido.';
    if (!validPassword(req.body?.password)) fields.password = 'Usa entre 12 y 128 caracteres.';
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Revisa los campos indicados.', fields });
    if (config.allowedEmails.length && !config.allowedEmails.includes(email)) return res.status(403).json({ error: 'Este correo no está autorizado para registrarse.' });
    try {
      const user = await repository.createLocalUser({ name, email, passwordHash: await hashPassword(req.body.password) });
      const result = publicUser(user); await issueSession(req, res, result); res.status(201).json({ user: result });
    } catch (error) { if (['ACCOUNT_EXISTS','ER_DUP_ENTRY'].includes(error.code)) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión; si usabas Google, activa el acceso local desde Mi cuenta.' }); throw error; }
  });
  router.get('/local-account', authenticate, async (req, res) => {
    const account = await repository.localAccount(req.user.id);
    res.json({ enabled: Boolean(account?.passwordHash), email: account?.localEmail || req.user.email });
  });
  const changeLimit = rateLimit({ windowMs: 15*60*1000, limit: 5, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' } });
  router.put('/local-account', authenticate, changeLimit, async (req, res) => {
    if (!validPassword(req.body?.password)) return res.status(400).json({ error: 'Usa una contraseña de entre 12 y 128 caracteres.', fields: { password: 'Usa entre 12 y 128 caracteres.' } });
    const account = await repository.localAccount(req.user.id);
    if (!account) return res.status(401).json({ error: 'Vuelve a iniciar sesión.' });
    if (account.passwordHash && (typeof req.body.currentPassword !== 'string' || req.body.currentPassword.length > 128 || !await verifyPassword(req.body.currentPassword, account.passwordHash))) return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    const email = account.localEmail || normalizeEmail(req.user.email);
    try {
      const saved = await repository.setLocalPassword(req.user.id, email, await hashPassword(req.body.password), account.passwordHash, req.cookies.espacio_session);
      if (!saved) return res.status(409).json({ error: 'El acceso cambió. Vuelve a abrir Mi cuenta antes de guardar.' });
      res.json({ enabled: true, email });
    } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese correo ya tiene acceso local en otra cuenta.' }); throw error; }
  });
  return router;
}
