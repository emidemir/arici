// lib/api.js
import { tokenManager } from '../lib/TokenManager';
import { apiUrl } from '../lib/apiUrl';
import { logger } from '../lib/logger';

export async function apiFetch(path, options = {}, requireAuth = true) {
  if (requireAuth) {
    let token;
    try {
      token = await tokenManager.get_valid_token();
    } catch (error) {
      logger.warn(`Could not get a valid token for ${path} — logging out`, error);
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Session Expired');
    }
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // The actual fetch() call previously had no try/catch around it at all.
  // A network-level failure (server unreachable, DNS failure, CORS
  // rejection, the user's connection dropping) makes fetch() *reject*
  // rather than resolve with a non-ok Response, so every caller's
  // `if (!response.ok)` check never even ran — the rejection just
  // propagated as an unhandled promise rejection with no clear indication
  // of what happened. This turns that into a clear, logged, catchable error.
  let response;
  try {
    response = await fetch(apiUrl(path), options);
  } catch (error) {
    logger.error(`Network error calling ${path}`, error);
    throw new Error('Network error — check your connection and try again.');
  }

  if (response.status === 401) {
    logger.warn(`401 from ${path} — clearing session`);
    tokenManager.clear();
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Unauthorized');
  }

  return response;
}
