import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/apiFetch.js';
import { tokenManager } from '../lib/TokenManager.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Login response shape: { user_id, access_token, refresh_token }
  const _handleAuthResponse = (data) => {
    const tokenPayload = JSON.parse(atob(data.access_token.split('.')[1]));
    const expiresInSeconds = tokenPayload.exp - Math.floor(Date.now() / 1000);

    tokenManager.setToken({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: expiresInSeconds,
    });

    const user = { id: data.user_id };
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
    if (!res.ok) throw new Error('Invalid credentials');
    _handleAuthResponse(await res.json());
  }, []);
  
  const signup = useCallback(async ({ username, email, password, passwordConfirm }) => {
    const signupRes = await apiFetch('/users/signup/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, password_confirm: passwordConfirm }),
    }, false);
    if (!signupRes.ok) throw new Error('Signup failed');
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

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);