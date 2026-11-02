export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields; }
}
export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'No pudimos completar la solicitud. Inténtalo nuevamente.', response.status, data.fields);
  return data;
}
export const clinicalApi = {
  getSession: (id, sessionId, signal) => request(`/usuarios/${encodeURIComponent(id)}/sesiones/${encodeURIComponent(sessionId)}`, { signal }),
  updateSession: (id, sessionId, session) => request(`/usuarios/${encodeURIComponent(id)}/sesiones/${encodeURIComponent(sessionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) }),
  sessions: (id, { page = 1, signal } = {}) => request(`/usuarios/${encodeURIComponent(id)}/sesiones?page=${page}`, { signal }),
  createSession: (id, session) => request(`/usuarios/${encodeURIComponent(id)}/sesiones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) }),
  list: ({ q, page, signal }) => request(`/usuarios?${new URLSearchParams({ q, page })}`, { signal }),
  get: (id, signal) => request(`/usuarios/${encodeURIComponent(id)}`, { signal }),
  save: (id, record) => request(`/usuarios${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }),
};

export const financeApi = {
  get: (month, { page = 1, signal } = {}) => request(`/finanzas?${new URLSearchParams({ mes: month, page })}`, { signal }),
};

const reportsPath = id => `/usuarios/${encodeURIComponent(id)}/informes`;
export const reportApi = {
  list: (id, { page = 1, signal } = {}) => request(`${reportsPath(id)}?page=${page}`, { signal }),
  sources: (id, range, signal) => request(`${reportsPath(id)}/fuentes?${new URLSearchParams(range)}`, { signal }),
  generate: (id, selection) => request(reportsPath(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selection) }),
  get: (id, reportId, signal) => request(`${reportsPath(id)}/${encodeURIComponent(reportId)}`, { signal }),
  save: (id, reportId, report) => request(`${reportsPath(id)}/${encodeURIComponent(reportId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }),
  async pdf(id, reportId) {
    const response = await fetch(`/api${reportsPath(id)}/${encodeURIComponent(reportId)}/pdf`, { credentials: 'same-origin' });
    if (!response.ok) { const data = await response.json(); throw new ApiError(data.error || 'No se pudo descargar el informe.', response.status); }
    return response.blob();
  },
};

export const calendarApi = {
  async month(month, signal) {
    const sessions = []; let page = 1; let data;
    do { data = await request(`/calendario?${new URLSearchParams({ mes: month, page })}`, { signal }); sessions.push(...data.sessions); page++; } while (data.sessions.length && sessions.length < data.total);
    return { sessions };
  },
  get: (id, signal) => request(`/calendario/${encodeURIComponent(id)}`, { signal }),
  save: (id, session) => request(`/calendario${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) }),
};
export const planApi = {
  list: (id, { page = 1, signal } = {}) => request(`/usuarios/${encodeURIComponent(id)}/planificaciones?page=${page}`, { signal }),
  get: (id, planId, signal) => request(`/usuarios/${encodeURIComponent(id)}/planificaciones/${encodeURIComponent(planId)}`, { signal }),
  choices: (id, { page = 1, signal } = {}) => request(`/usuarios/${encodeURIComponent(id)}/sesiones-agendadas?page=${page}`, { signal }),
  save: (id, planId, plan) => request(`/usuarios/${encodeURIComponent(id)}/planificaciones${planId ? `/${encodeURIComponent(planId)}` : ''}`, { method: planId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan) }),
};
