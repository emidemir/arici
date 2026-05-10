import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiFetch'; // Adjust the import path if necessary
import '../../styles/profile/MyFarmsPage.css';

/* ─── Constants ─────────────────────────────────────────────── */
const CROP_OPTIONS = [
  { label: 'Sunflowers',  emoji: '🌻' },
  { label: 'Apples',      emoji: '🍎' },
  { label: 'Clover',      emoji: '🍀' },
  { label: 'Lavender',    emoji: '💜' },
  { label: 'Wildflowers', emoji: '🌸' },
  { label: 'Olives',      emoji: '🫒' },
  { label: 'Figs',        emoji: '🍇' },
  { label: 'Thyme',       emoji: '🌿' },
  { label: 'Peaches',     emoji: '🍑' },
  { label: 'Oranges',     emoji: '🍊' },
  { label: 'Cherries',    emoji: '🍒' },
  { label: 'Carrots',     emoji: '🥕' },
  { label: 'Sesame',      emoji: '🌾' },
  { label: 'Watermelons', emoji: '🍉' },
  { label: 'Hazelnuts',   emoji: '🌰' },
  { label: 'Tea',         emoji: '🍵' },
  { label: 'Cotton',      emoji: '☁️' }
];

const CROP_EMOJI = Object.fromEntries(CROP_OPTIONS.map(c => [c.label, c.emoji]));

/* ─── Helpers ───────────────────────────────────────────────── */
function totalAcres(farms) {
  return farms.reduce((sum, f) => sum + (parseFloat(f.acres) || 0), 0);
}

function uniqueCrops(farms) {
  return [...new Set(farms.map(f => f.crop).filter(Boolean))].length;
}

/* ─── Sub-components ────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = { active: 'Active', inactive: 'Inactive', pending: 'Pending Review' };
  return (
    <span className={`farm-card__status-badge farm-card__status-badge--${status}`}>
      {map[status] ?? status}
    </span>
  );
}

function FarmCard({ farm, onView, onDelete }) {
  const emoji = CROP_EMOJI[farm.crop] ?? '🌿';
  const locationStr = [farm.district, farm.city].filter(Boolean).join(', ');

  return (
    <div className="farm-card" onClick={() => onView(farm)}>
      {/* Hero */}
      <div className="farm-card__hero">
        {farm.images?.length > 0 ? (
          <img
            className="farm-card__hero-img"
            src={farm.images[0].image}
            alt={`${farm.crop} field`}
          />
        ) : (
          <div className="farm-card__hero-placeholder">
            <span className="farm-card__hero-emoji">{emoji}</span>
            <span className="farm-card__hero-placeholder-text">Photos coming soon</span>
          </div>
        )}
        <StatusBadge status={farm.status ?? 'active'} />
      </div>

      {/* Body */}
      <div className="farm-card__body">
        <div className="farm-card__crop-row">
          {farm.crop && (
            <span className="farm-card__crop-tag">
              {emoji} {farm.crop}
            </span>
          )}
          {farm.acres && (
            <span className="farm-card__acres">{farm.acres} ac</span>
          )}
        </div>

        <h3 className="farm-card__title">
          {[farm.district, farm.crop, 'Farm'].filter(Boolean).join(' ')}
        </h3>

        {locationStr && (
          <div className="farm-card__location">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {locationStr}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="farm-card__footer" onClick={e => e.stopPropagation()}>
        <button className="farm-card__action farm-card__action--view" onClick={() => onView(farm)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </button>
        <button className="farm-card__action farm-card__action--delete" onClick={() => onDelete(farm)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

function AddFarmCard({ onClick }) {
  return (
    <div className="farm-card farm-card--add" onClick={onClick}>
      <div className="farm-card__add-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <p className="farm-card__add-label">List a new farmland</p>
      <p className="farm-card__add-sublabel">Connect with beekeepers across Turkey</p>
    </div>
  );
}

/* ─── Delete Confirm Modal ──────────────────────────────────── */
function DeleteModal({ farm, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const response = await apiFetch(
        `${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${farm.id}/`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Delete failed');
      onConfirm(farm.id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const name = [farm.district, farm.crop, 'Farm'].filter(Boolean).join(' ');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Remove farmland</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="delete-modal__body">
          <div className="delete-modal__icon">🗑️</div>
          <p className="delete-modal__text">
            Are you sure you want to remove <strong>{name}</strong> from your listings?
            This action cannot be undone and beekeepers will no longer be able to find it.
          </p>
        </div>

        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose}>Keep it</button>
          <button className="btn btn--danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? 'Removing…' : 'Yes, remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function MyFarmsPage() {
  const navigate = useNavigate();

  const [farms, setFarms]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState('newest');

  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Fetch user's farms ──────────────────────────────────── */
  const fetchMyFarms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/`, {
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Could not load your farmlands.');
      const data = await response.json();
      setFarms(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMyFarms(); }, [fetchMyFarms]);


  /* ── Optimistic updates ──────────────────────────────────── */
  const handleDeleted = (id) => {
    setFarms(prev => prev.filter(f => f.id !== id));
    setDeleteTarget(null);
  };

  /* ── Filtered + sorted list ──────────────────────────────── */
  const displayedFarms = farms
    .filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        f.crop?.toLowerCase().includes(q) ||
        f.district?.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.region?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'acres-desc') return (b.acres ?? 0) - (a.acres ?? 0);
      if (sortBy === 'acres-asc')  return (a.acres ?? 0) - (b.acres ?? 0);
      if (sortBy === 'alpha')      return (a.district ?? '').localeCompare(b.district ?? '');
      return b.id - a.id; // newest first
    });

  /* ── Stats ───────────────────────────────────────────────── */
  const stats = {
    total: farms.length,
    acres: Math.round(totalAcres(farms)),
    crops: uniqueCrops(farms),
    active: farms.filter(f => (f.status ?? 'active') === 'active').length,
  };

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-dots">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
        <span>Loading your farmlands…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <span style={{ fontStyle: 'normal', fontSize: '0.95rem', color: 'var(--color-bark)' }}>{error}</span>
        <button className="btn btn-secondary" onClick={fetchMyFarms}>Retry</button>
      </div>
    );
  }

  return (
    <div className="my-farms-page">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="my-farms-header">
        <div className="my-farms-header__left">
          <p className="my-farms-header__eyebrow">My Portfolio</p>
          <h1 className="my-farms-header__title">
            Your <em>farmlands</em>
          </h1>
          <p className="my-farms-header__subtitle">
            Manage your listings and connect with beekeepers across Turkey.
          </p>
        </div>
        {/* Note: You may want to add an onClick here later to route to your new farm creation page */}
        <button className="btn btn-primary" onClick={() => navigate('/profile/farms/createfarm')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Farmland
        </button>
      </div>

      {/* ── Stats Strip ────────────────────────────────────── */}
      {farms.length > 0 && (
        <div className="my-farms-stats">
          <div className="my-farms-stat">
            <span className="my-farms-stat__value">{stats.total}</span>
            <span className="my-farms-stat__label">Listings</span>
          </div>
          <div className="my-farms-stat__sep" />
          <div className="my-farms-stat">
            <span className="my-farms-stat__value">{stats.active}</span>
            <span className="my-farms-stat__label">Active</span>
          </div>
          <div className="my-farms-stat__sep" />
          <div className="my-farms-stat">
            <span className="my-farms-stat__value">{stats.acres.toLocaleString()}</span>
            <span className="my-farms-stat__label">Total Acres</span>
          </div>
          <div className="my-farms-stat__sep" />
          <div className="my-farms-stat">
            <span className="my-farms-stat__value">{stats.crops}</span>
            <span className="my-farms-stat__label">Crop Types</span>
          </div>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────── */}
      {farms.length > 0 && (
        <div className="my-farms-toolbar">
          <div className="my-farms-search">
            <span className="my-farms-search__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className="my-farms-search__input"
              type="text"
              placeholder="Search by crop, district, city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="my-farms-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="alpha">A → Z (district)</option>
            <option value="acres-desc">Largest area</option>
            <option value="acres-asc">Smallest area</option>
          </select>
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────── */}
      <div className="my-farms-grid">
        {displayedFarms.map(farm => (
          <FarmCard
            key={farm.id}
            farm={farm}
            onView={f => navigate(`/profile/farms/${f.id}`)}
            onDelete={f => setDeleteTarget(f)}
          />
        ))}

        {/* Empty state when search yields nothing */}
        {farms.length > 0 && displayedFarms.length === 0 && (
          <div className="my-farms-empty">
            <span className="my-farms-empty__icon">🔍</span>
            <p className="my-farms-empty__text">No farmlands match "{search}"</p>
            <button className="btn btn-ghost" onClick={() => setSearch('')}>Clear search</button>
          </div>
        )}

        {/* Add card — always visible. Note: You may want to add an onClick here later. */}
        <AddFarmCard onClick={() => navigate('/profile/farms/createfarm')} />

        {/* Zero state */}
        {farms.length === 0 && (
          <div className="my-farms-empty">
            <span className="my-farms-empty__icon">🌾</span>
            <p className="my-farms-empty__text">You haven't listed any farmlands yet.</p>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          farm={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleted}
        />
      )}
    </div>
  );
}