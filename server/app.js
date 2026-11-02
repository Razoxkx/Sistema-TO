import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { clinicalRouter } from './clinical-records.js';
import { financeRouter } from './finances.js';
import { localAuthRouter } from './local-auth.js';
import { calendarRouter } from './scheduling.js';
import { randomBytes, createHash } from 'node:crypto';

export function googlePicture(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com')) && value.length <= 2048) return url.href;
  } catch { /* Accounts without a valid photo use initials. */ }
  return null;
}

export const hashToken = value => createHash('sha256').update(value).digest('hex');
const sessionDuration = 8 * 60 * 60 * 1000;
export function createApp({ repository, verifyGoogle, config, reportGenerator }) {
  const app = express();
  const secure = config.production;
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/api' };
  const clearLegacySession = res => res.clearCookie('espacio_session', { ...cookieOptions, path: '/api/auth' });
  const clearSession = res => { res.clearCookie('espacio_session', cookieOptions); clearLegacySession(res); };
  const allowedOrigins = new Set([config.origin, ...(config.allowedOrigins || [])]);
  async function issueSession(req, res, user) {
    const token = randomBytes(32).toString('hex');
    await repository.createSession(user.id, hashToken(token), new Date(Date.now() + sessionDuration));
    if (req.cookies.espacio_session) await repository.deleteSession(hashToken(req.cookies.espacio_session));
    res.clearCookie('espacio_nonce', { ...cookieOptions, path: '/api/auth' });
    clearLegacySession(res);
    res.cookie('espacio_session', token, { ...cookieOptions, maxAge: sessionDuration });
  }
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser(config.sessionSecret));
  app.use('/api/auth', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !allowedOrigins.has(req.get('origin'))) {
      return res.status(403).json({ error: 'Origen de solicitud no autorizado.' });
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    try { await repository.ping(); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'database_unavailable' }); }
  });
  app.get('/api/auth/config', (_req, res) => {
    const enabled = Boolean(config.clientId && config.sessionSecret);
    if (!enabled) return res.json({ enabled: false, ...(config.localAuthEnabled ? { localEnabled: true } : {}) });
    const nonce = randomBytes(32).toString('hex');
    res.cookie('espacio_nonce', nonce, { ...cookieOptions, path: '/api/auth', signed: true, maxAge: 10 * 60 * 1000 });
    res.json({ enabled: true, clientId: config.clientId, nonce, ...(config.localAuthEnabled ? { localEnabled: true } : {}) });
  });
  app.get('/api/auth/me', async (req, res) => {
    const token = req.cookies.espacio_session;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.json({ user: null });
    const user = await repository.findSession(hashToken(token));
    if (!user) clearSession(res);
    else {
      // Upgrade sessions created before authenticated clinical endpoints existed.
      clearLegacySession(res);
      res.cookie('espacio_session', token, { ...cookieOptions, maxAge: sessionDuration });
    }
    res.json({ user: user || null });
  });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' } });
  app.post('/api/auth/google', loginLimiter, async (req, res) => {
    if (!config.clientId || !config.sessionSecret) return res.status(503).json({ error: 'El acceso con Google aún no está habilitado.' });
    if (typeof req.body?.credential !== 'string' || req.body.credential.length > 12000 || !req.signedCookies.espacio_nonce) {
      return res.status(400).json({ error: 'La solicitud de acceso no es válida. Recarga la página.' });
    }
    let payload;
    try { payload = await verifyGoogle(req.body.credential); }
    catch { return res.status(401).json({ error: 'No pudimos verificar tu cuenta con Google. Inténtalo nuevamente.' }); }
    if (!payload?.sub || !payload.email || payload.email_verified !== true || payload.nonce !== req.signedCookies.espacio_nonce) {
      return res.status(401).json({ error: 'La verificación de acceso venció o no es válida. Recarga la página.' });
    }
    if (config.allowedEmails.length && !config.allowedEmails.includes(payload.email.toLowerCase())) {
      return res.status(403).json({ error: 'Esta cuenta no tiene acceso. Contacta a quien administra Espacio TO.' });
    }
    let user;
    try { user = await repository.upsertUser({ googleId: payload.sub, email: payload.email, name: payload.name || payload.email.split('@')[0], picture: googlePicture(payload.picture) }); }
    catch (error) { if (error.code === 'ACCOUNT_EXISTS') return res.status(409).json({ error: 'Este correo ya tiene una cuenta local. Ingresa con correo y contraseña.' }); throw error; }
    await issueSession(req, res, user);
    res.json({ user });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies.espacio_session) await repository.deleteSession(hashToken(req.cookies.espacio_session));
    clearSession(res);
    res.json({ ok: true });
  });
  const authenticate = async (req, res, next) => {
    const token = req.cookies.espacio_session;
    const user = token && /^[a-f0-9]{64}$/.test(token) ? await repository.findSession(hashToken(token)) : null;
    if (!user) { clearSession(res); return res.status(401).json({ error: 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.' }); }
    req.user = user;
    next();
  };
  app.use('/api/auth', localAuthRouter({ repository, authenticate, issueSession, config }));
  app.use('/api/usuarios', clinicalRouter(repository, authenticate, reportGenerator));
  app.use('/api/calendario', calendarRouter(repository, authenticate));
  app.use('/api/finanzas', financeRouter(repository, authenticate));
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Solicitud no válida.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande.' });
    if (err.status === 503) return res.status(503).json({ error: 'El servicio está ocupado. Inténtalo en unos segundos.' });
    console.error('Error de servicio:', err.code || err.name);
    res.status(503).json({ error: 'El servicio no está disponible en este momento. Inténtalo nuevamente.' });
  });
  return app;
}
