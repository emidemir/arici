import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/apiFetch.js';
import { tokenManager } from '../lib/TokenManager.js';
import { extractErrorMessageFromResponse } from '../lib/errorMessage.js';
import { logger } from '../lib/logger.js';
import { notifySocket } from '../lib/notifySocket.js';

const AuthContext = createContext(null);

// Reading `user` back out of localStorage used to be a bare
// `JSON.parse(stored)` with no try/catch. If that value is ever anything
// other than well-formed JSON — corrupted by a previous bug, edited by a
// browser extension, truncated by the browser, whatever — JSON.parse
// throws *during the initial useState() call*, before a single route or
// component has rendered. That crash happens above the router entirely
// (AuthProvider wraps RouterProvider in index.js), so it isn't something
// an error boundary around the router can catch — the whole app fails to
// mount, with just a blank page and a console error nobody but a developer
// will ever see. This degrades to "log the user out" instead.
function readStoredUser() {
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    logger.error('Corrupted "user" value in localStorage — clearing it', error);
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // Login response shape: { user_id, username, email, access_token, refresh_token }
  const _handleAuthResponse = (data) => {
    const tokenPayload = JSON.parse(atob(data.access_token.split('.')[1]));
    const expiresInSeconds = tokenPayload.exp - Math.floor(Date.now() / 1000);

    tokenManager.setToken({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: expiresInSeconds,
    });

    const user = { id: data.user_id, username: data.username, email: data.email };
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  // LoginSerializer expects `username`, not `email`
  const login = useCallback(async (username, password) => {
    const res = await apiFetch('/users/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }, false);
    if (!res.ok) {
      // Previously this always threw a hardcoded "Invalid credentials",
      // regardless of what actually went wrong — a 429 from the rate
      // limiter, a 500 from a backend bug, anything. The login form would
      // faithfully display that wrong message every time. Surface what the
      // server actually said instead.
      const message = await extractErrorMessageFromResponse(res, 'Invalid credentials.');
      logger.warn(`Login failed (${res.status})`, message);
      throw new Error(message);
    }
    _handleAuthResponse(await res.json());
  }, []);

  const signup = useCallback(async ({ username, email, password, passwordConfirm }) => {
    const signupRes = await apiFetch('/users/signup/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, password_confirm: passwordConfirm }),
    }, false);
    if (!signupRes.ok) {
      // Same fix as login(): this used to always say "Signup failed",
      // hiding messages like "A user with this email already exists." or
      // "Passwords do not match." that the backend serializer already
      // produces perfectly well.
      const message = await extractErrorMessageFromResponse(signupRes, 'Signup failed. Please try again.');
      logger.warn(`Signup failed (${signupRes.status})`, message);
      throw new Error(message);
    }
    await login(username, password);
  }, [login]);

  const logout = useCallback(() => {
    tokenManager.clear();
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  // Open the one always-on per-user notification socket as soon as we know
  // who's logged in — covers both a fresh login (user just changed from
  // null) and the common case of already being logged in from a previous
  // session (user is set on the very first render, from localStorage).
  useEffect(() => {
    if (!user) {
      notifySocket.disconnect();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await tokenManager.get_valid_token();
        if (!cancelled) notifySocket.connect(token);
      } catch (err) {
        logger.warn('Could not open notify socket — no valid token', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
