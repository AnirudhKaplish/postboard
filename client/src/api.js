import axios from 'axios';

const TOKEN_KEY = 'postboard.token';

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Turns an axios error into { message, fields } for display. */
export function parseError(err) {
  const data = err?.response?.data;
  if (data) return { message: data.error || 'Something went wrong', fields: data.fields || {} };
  return { message: 'Cannot reach the server. Is it running?', fields: {} };
}

export default api;
