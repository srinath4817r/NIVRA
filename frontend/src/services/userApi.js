// frontend/src/services/userApi.js — auth + per-user data (errors propagate to the UI)
import { request } from './http';

export const auth = {
  config: () => request('/auth/config'),
  me: () => request('/auth/me'),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  google: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  requestOtp: (phone) => request('/auth/otp/request', { method: 'POST', body: { phone } }),
  verifyOtp: (phone, code) => request('/auth/otp/verify', { method: 'POST', body: { phone, code } }),
  guest: () => request('/auth/guest', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  update: (patch) => request('/auth/me', { method: 'PATCH', body: patch }),
  deleteAccount: () => request('/auth/me', { method: 'DELETE' }),
};

export const trackers = {
  list: () => request('/trackers').then(r => r.data),
  add: (t) => request('/trackers', { method: 'POST', body: t }),
  setStep: (id, stepIndex, done) => request(`/trackers/${id}`, { method: 'PATCH', body: { stepIndex, done } }).then(r => r.tracker),
  update: (id, patch) => request(`/trackers/${id}`, { method: 'PATCH', body: patch }).then(r => r.tracker),
  remove: (id) => request(`/trackers/${id}`, { method: 'DELETE' }),
};

export const saved = {
  list: () => request('/saved'),
  add: (itemId) => request(`/saved/${encodeURIComponent(itemId)}`, { method: 'PUT' }),
  remove: (itemId) => request(`/saved/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
};

export const reports = {
  submit: (fields, imageFile) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, v);
    if (imageFile) form.append('image', imageFile);
    return request('/reports', { method: 'POST', form });
  },
  mine: () => request('/reports/mine').then(r => r.data),
  adminList: () => request('/admin/reports'),
  adminSetStatus: (id, status, note) => request(`/admin/reports/${id}`, { method: 'PATCH', body: { status, note } }),
};
