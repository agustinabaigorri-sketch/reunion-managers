import { DEMO, demoApi, demoGetToken, demoSetToken } from './demo';

// En dev, .env define VITE_API_URL=http://localhost:4400.
// En producción se sirve desde el mismo origen → BASE relativo ('').
const BASE = import.meta.env.VITE_API_URL || '';

let token = localStorage.getItem('rm_token') || null;
const realGetToken = () => token;
function realSetToken(t) {
  token = t;
  if (t) localStorage.setItem('rm_token', t);
  else localStorage.removeItem('rm_token');
}
export const getToken = DEMO ? demoGetToken : realGetToken;
export const setToken = DEMO ? demoSetToken : realSetToken;

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) setToken(null);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

const realApi = {
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  changePassword: (currentPassword, newPassword) => req('POST', '/me/password', { currentPassword, newPassword }),
  bootstrap: () => req('GET', '/bootstrap'),
  resolveWeek: ({ offset = 0, date } = {}) => req('GET', '/weeks/resolve?' + (date ? 'date=' + date : 'offset=' + offset)),
  entryMe: (week) => req('GET', `/entries/me?week=${week}`),
  saveEntry: (week, data) => req('PUT', `/entries/me?week=${week}`, data),
  board: (week) => req('GET', `/board?week=${week}`),
  alertsMe: (week) => req('GET', `/alerts/me?week=${week}`),
  addUser: (d) => req('POST', '/admin/users', d),
  updUser: (id, d) => req('PATCH', '/admin/users/' + id, d),
  delUser: (id) => req('DELETE', '/admin/users/' + id),
  addArea: (d) => req('POST', '/admin/areas', d),
  updArea: (id, d) => req('PATCH', '/admin/areas/' + id, d),
  delArea: (id) => req('DELETE', '/admin/areas/' + id),
  addTag: (d) => req('POST', '/admin/tags', d),
  updTag: (id, d) => req('PATCH', '/admin/tags/' + id, d),
  delTag: (id) => req('DELETE', '/admin/tags/' + id),
  okrGet: (anio) => req('GET', '/okr' + (anio ? '?anio=' + anio : '')),
  okrAddObjective: (d) => req('POST', '/okr/objectives', d),
  okrUpdObjective: (id, d) => req('PATCH', '/okr/objectives/' + id, d),
  okrDelObjective: (id) => req('DELETE', '/okr/objectives/' + id),
  okrAddAO: (d) => req('POST', '/okr/area-objectives', d),
  okrUpdAO: (id, d) => req('PATCH', '/okr/area-objectives/' + id, d),
  okrDelAO: (id) => req('DELETE', '/okr/area-objectives/' + id),
  okrMine: () => req('GET', '/okr/area-objectives/mine'),
  okrSettings: () => req('GET', '/okr/settings'),
  okrSetUmbral: (umbral) => req('PATCH', '/okr/settings', { umbral }),
  okrReport: (anio) => req('GET', '/okr/report' + (anio ? '?anio=' + anio : '')),
  tasksGet: () => req('GET', '/tasks'),
  taskAdd: (d) => req('POST', '/tasks', d),
  taskUpd: (id, d) => req('PATCH', '/tasks/' + id, d),
  taskDel: (id) => req('DELETE', '/tasks/' + id),
  taskToLogro: (id) => req('POST', '/tasks/' + id + '/to-logro'),
};

export const api = DEMO ? demoApi : realApi;
