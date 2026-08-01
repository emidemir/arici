import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiFetch';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';
import { useUnreadNotifCount, useUnreadChatCount } from '../chats/NotificationPopup';
import '../../styles/profile/Dashboard.css';

// This file used to be completely empty (0 bytes) while still being wired
// up as the element for the `/profile/` route in index.js. `import
// Dashboard from './features/profile/Dashboard'` silently imported
// `undefined` (a module with no default export doesn't fail the import
// itself), and `<Dashboard />` — a component that's undefined — is a hard
// React render error: "Element type is invalid: expected a string ... but
// got: undefined." With no error boundary anywhere in the app (fixed
// separately — see components/commons/ErrorBoundary.jsx / index.js), that
// crash took down the entire app for anyone who visited /profile/,
// including from a bookmark or a typed URL, leaving nothing but a blank
// white page.

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [farmCount, setFarmCount] = useState(null);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [farmsError, setFarmsError] = useState(null);

  const { count: notifCount } = useUnreadNotifCount();
  const chatCount = useUnreadChatCount();

  const loadFarmCount = useCallback(async () => {
    setLoadingFarms(true);
    setFarmsError(null);
    try {
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      const farms = data.results ?? data;
      setFarmCount(Array.isArray(farms) ? farms.length : 0);
    } catch (err) {
      logger.error('Failed to load farm count for dashboard', err);
      setFarmsError('Could not load your listings.');
    } finally {
      setLoadingFarms(false);
    }
  }, []);

  useEffect(() => { loadFarmCount(); }, [loadFarmCount]);

  const greetingName = user?.username ? user.username : 'there';

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <p className="dashboard-header__eyebrow">Your Dashboard</p>
        <h1 className="dashboard-header__title">
          Welcome back, <em>{greetingName}</em> 🐝
        </h1>
        <p className="dashboard-header__subtitle">
          Here's a quick look at your farmland listings and conversations.
        </p>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <span className="dashboard-stat__value">
            {loadingFarms ? '…' : farmsError ? '—' : farmCount}
          </span>
          <span className="dashboard-stat__label">Listings</span>
        </div>
        <div className="dashboard-stat__sep" />
        <div className="dashboard-stat">
          <span className="dashboard-stat__value">{chatCount}</span>
          <span className="dashboard-stat__label">Unread messages</span>
        </div>
        <div className="dashboard-stat__sep" />
        <div className="dashboard-stat">
          <span className="dashboard-stat__value">{notifCount}</span>
          <span className="dashboard-stat__label">Notifications</span>
        </div>
      </div>

      {farmsError && (
        <p className="dashboard-inline-error">
          ⚠️ {farmsError}{' '}
          <button className="dashboard-inline-error__retry" onClick={loadFarmCount}>
            Retry
          </button>
        </p>
      )}

      <div className="dashboard-actions">
        <button className="dashboard-action-card" onClick={() => navigate('/profile/farms/')}>
          <span className="dashboard-action-card__icon">🌾</span>
          <span className="dashboard-action-card__title">My Farms</span>
          <span className="dashboard-action-card__desc">View and manage your farmland listings</span>
        </button>

        <button className="dashboard-action-card" onClick={() => navigate('/profile/farms/createfarm')}>
          <span className="dashboard-action-card__icon">➕</span>
          <span className="dashboard-action-card__title">List a New Farmland</span>
          <span className="dashboard-action-card__desc">Connect with beekeepers across Turkey</span>
        </button>

        <button className="dashboard-action-card" onClick={() => navigate('/chats')}>
          <span className="dashboard-action-card__icon">💬</span>
          <span className="dashboard-action-card__title">Messages</span>
          <span className="dashboard-action-card__desc">
            {chatCount > 0 ? `${chatCount} unread conversation${chatCount === 1 ? '' : 's'}` : 'Chat with beekeepers and farmers'}
          </span>
        </button>

        <button className="dashboard-action-card" onClick={() => navigate('/explore/')}>
          <span className="dashboard-action-card__icon">🗺️</span>
          <span className="dashboard-action-card__title">Explore Listings</span>
          <span className="dashboard-action-card__desc">Browse farmland available across Turkey</span>
        </button>
      </div>
    </div>
  );
}
