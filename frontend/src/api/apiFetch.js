// lib/api.js
import { tokenManager } from '../lib/TokenManager';
import { apiUrl } from '../lib/apiUrl';

export async function apiFetch(path, options = {}, requireAuth = true) {
  if (requireAuth) {
    let token;
    try {
      token = await tokenManager.get_valid_token();
    } catch (error) {
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('Session Expired');
    }
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  const response = await fetch(apiUrl(path), options);

  if (response.status === 401) {
    tokenManager.clear();
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Unauthorized');
  }

  return response;
}