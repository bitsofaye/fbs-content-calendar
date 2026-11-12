import axios from 'axios';

const TOKEN_KEY = 'cc_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 60000, // free Render instances can take a while to wake up
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) onUnauthorized();
    return Promise.reject(error);
  },
);

/** Human readable message from an axios error */
export function errorMessage(err) {
  if (!err) return '';
  const data = err.response?.data;
  if (data?.details?.fieldErrors) {
    const first = Object.entries(data.details.fieldErrors).find(([, v]) => v?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  if (data?.error) return data.error;
  if (err.code === 'ECONNABORTED') return 'The server took too long to respond';
  if (err.message === 'Network Error') return 'Cannot reach the server. Is the API running?';
  return err.message || 'Something went wrong';
}
