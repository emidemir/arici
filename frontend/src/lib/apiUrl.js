// lib/api.js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function apiUrl(path) {
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}