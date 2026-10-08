// frontend/src/services/http.js — fetch wrapper for the NIVRA API
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// What to say when the server answered with something that isn't one of our JSON errors
// (e.g. the hosting platform's own error page when the server fails to start)
function fallbackMessage(status) {
  if (status === 404) return "That wasn't found.";
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return `NIVRA's server isn't responding properly right now (error ${status}). Please try again in a minute.`;
  return `Something went wrong (error ${status}). Please try again.`;
}

// Session lives in an httpOnly cookie, so every call sends credentials
export async function request(path, { method = 'GET', body, params, form } = {}) {
  const qs = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Can't reach NIVRA right now. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || fallbackMessage(res.status), res.status);
  return data;
}

export const getJSON = (path, params) => request(path, { params });
