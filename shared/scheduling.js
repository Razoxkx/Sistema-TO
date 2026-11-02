import { validReportDate } from './report-fields.js';
export const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export function validateAppointment(body, requireRecord = true) {
  const fields = {}; const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { title: 'Completa los datos de la sesión.' } };
  if (requireRecord && !validId(body.recordId)) fields.recordId = 'Selecciona un usuario.';
  else if (requireRecord) value.recordId = body.recordId;
  if (typeof body.title !== 'string' || body.title.trim().length > 200) fields.title = 'Usa un nombre de hasta 200 caracteres.';
  else value.title = body.title.trim();
  if (!validReportDate(body.date)) fields.date = 'Ingresa una fecha válida.'; else value.date = body.date;
  if (!validTime(body.time)) fields.time = 'Ingresa una hora válida.'; else value.time = body.time;
  return { value, fields };
}
export function validatePlan(body) {
  const fields = {}; const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fields: { executionPlan: 'Completa la planificación.' } };
  for (const key of ['materials','executionPlan','observations']) {
    if (typeof body[key] !== 'string' || body[key].length > 10000 || (key === 'executionPlan' && !body[key].trim())) fields[key] = key === 'executionPlan' ? 'Describe el plan de ejecución (máximo 10.000 caracteres).' : 'Ingresa un texto de hasta 10.000 caracteres.';
    else value[key] = body[key].trim();
  }
  if (!Array.isArray(body.objectives) || body.objectives.length < 1 || body.objectives.length > 50 || body.objectives.some(item => !item || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 500 || typeof item.done !== 'boolean')) fields.objectives = 'Agrega entre 1 y 50 objetivos de hasta 500 caracteres.';
  else value.objectives = body.objectives.map(item => ({ text: item.text.trim(), done: item.done }));
  if (!validId(body.sessionId)) fields.sessionId = 'Selecciona una sesión ya agendada para este usuario.'; else value.sessionId = body.sessionId;
  return { value, fields };
}
export const sessionName = session => session.title || (session.sessionNumber ? `Sesión número ${session.sessionNumber}` : 'Sesión');
export const sessionLabel = session => `${sessionName(session)} · ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${session.date}T12:00:00Z`))}${session.time ? ` · ${session.time}` : ' · Sin hora asignada'}`;
