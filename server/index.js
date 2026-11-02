import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.js';
import { createRepository } from './db.js';
import { createReportGenerator } from './report-ai.js';
const env = process.env;
const production = env.NODE_ENV === 'production';
if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) throw new Error('Configura SESSION_SECRET con al menos 32 caracteres.');
if (production && !env.APP_ORIGIN?.startsWith('https://')) throw new Error('APP_ORIGIN debe usar HTTPS en producción.');
const config = {
  clientId: env.GOOGLE_CLIENT_ID || '',
  sessionSecret: env.SESSION_SECRET || (production ? '' : randomBytes(48).toString('hex')),
  origin: env.APP_ORIGIN || 'http://localhost:5173',
  production,
  localAuthEnabled: env.LOCAL_AUTH_ENABLED === 'true',
  allowedOrigins: (env.APP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean).map(value => {
    if (new URL(value).origin !== value) throw new Error('APP_ALLOWED_ORIGINS debe contener orígenes exactos, sin rutas ni barra final.');
    if (production && !value.startsWith('https://')) throw new Error('Los orígenes adicionales deben usar HTTPS en producción.');
    return value;
  }),
  allowedEmails: (env.ALLOWED_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
};
const client = new OAuth2Client(config.clientId);
const repository = createRepository(env);
try { await repository.initialize(); }
catch (err) {
  if (production) throw err;
  console.warn('MySQL no disponible. Puedes revisar el diseño; para iniciar sesión configura e inicia la base de datos.');
}
const app = createApp({ config, repository, reportGenerator: createReportGenerator(env), verifyGoogle: async credential => {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: config.clientId });
  return ticket.getPayload();
} });
const server = app.listen(Number(env.PORT || 3001), '0.0.0.0', () => console.log(`API Espacio TO: http://localhost:${env.PORT || 3001}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await repository.close(); process.exit(0); }));
