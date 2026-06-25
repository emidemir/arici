// lib/api.js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

if (!BACKEND_URL) {
  // Fails loudly instead of silently making relative requests
  throw new Error('REACT_APP_BACKEND_URL is not set — check your build env.');
}

export function apiUrl(path) {
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}