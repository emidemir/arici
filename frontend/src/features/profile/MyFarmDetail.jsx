import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../api/apiFetch'; // Adjust the import path if necessary
import '../../styles/profile/MyFarmDetail.css';

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

const REGIONS = [
  'MARMARA', 'KARADENIZ', 'IC_ANADOLU', 'DOGU_ANADOLU',
  'EGE', 'AKDENIZ', 'GUNEY_DOGU_ANADOLU',
];


/* ─── Helpers ───────────────────────────────────────────────── */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}


/* ─── Delete Confirm Modal ──────────────────────────────────── */
function DeleteModal({ farmName, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmText.trim().toLowerCase() === 'delete';

  const handleConfirm = async () => {
    if (!confirmed) return;
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Remove farmland</h2>
          <button className="modal__close" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__body-text">
            You're about to permanently remove <strong>{farmName}</strong>. This will
            delete all photos, data, and beekeeper connections associated with this listing.
          </p>
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-bark)', marginBottom: '0.4rem', opacity: 0.7 }}>
              Type <strong style={{ color: 'var(--color-soil)' }}>delete</strong> to confirm
            </p>
            <input
              className="modal__confirm-input"
              type="text"
              placeholder="delete"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose}>Keep it</button>
          <button
            className="btn btn--danger"
            onClick={handleConfirm}
            disabled={!confirmed || deleting}
            style={{ opacity: confirmed ? 1 : 0.45, transition: 'opacity 0.2s' }}
          >
            {deleting ? 'Removing…' : 'Remove permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function MyFarmDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ── Server state ─────────────────────────────────────────── */
  const [farm, setFarm]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  /* ── Edit state (local draft) ─────────────────────────────── */
  const [draft, setDraft]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);

  /* ── Image state ──────────────────────────────────────────── */
  const [heroIndex, setHeroIndex]     = useState(0);
  const [uploading, setUploading]     = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const uploadRef = useRef(null);

  /* ── UI ───────────────────────────────────────────────────── */
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /* ── Dirty detection ──────────────────────────────────────── */
  const isDirty = farm && draft && !deepEqual(
    { crop: farm.crop, district: farm.district, city: farm.city, region: farm.region,
      acres: farm.acres, description: farm.description, benefits: farm.benefits },
    { crop: draft.crop, district: draft.district, city: draft.city, region: draft.region,
      acres: draft.acres, description: draft.description, benefits: draft.benefits}
  );

  /* ── Fetch ────────────────────────────────────────────────── */
  const loadFarm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Replaced plain fetch with apiFetch and updated DRF ViewSet URL pattern
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${id}/`);
      if (!res.ok) throw new Error('Could not load this farmland.');
      const data = await res.json();
      setFarm(data);
      setDraft({
        crop: data.crop ?? '',
        district: data.district ?? '',
        city: data.city ?? '',
        region: data.region ?? REGIONS[0],
        acres: data.acres ?? '',
        description: data.description ?? '',
        benefits: Array.isArray(data.benefits) ? [...data.benefits] : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadFarm(); }, [loadFarm]);

  /* ── Draft helpers ────────────────────────────────────────── */
  const set = (key, val) => setDraft(prev => ({ ...prev, [key]: val }));

  const discard = () => {
    if (!farm) return;
    setDraft({
      crop: farm.crop ?? '', district: farm.district ?? '',
      city: farm.city ?? '', region: farm.region ?? REGIONS[0],
      acres: farm.acres ?? '', description: farm.description ?? '',
      benefits: Array.isArray(farm.benefits) ? [...farm.benefits] : [],
    });
  };

  /* ── Save ─────────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Replaced plain fetch with apiFetch and updated DRF ViewSet URL pattern
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Save failed. Please try again.');
      const updated = await res.json();
      setFarm(updated);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

/* ── Image upload ─────────────────────────────────────────── */
const handleImageUpload = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  setUploading(true);
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      
      // Use apiFetch targeting the custom backend @action
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${id}/images/upload/`, {
        method: 'POST',
        body: formData, // Do NOT set Content-Type header manually for FormData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const newImage = await res.json(); // Now returns { id, image }
      
      setFarm(prev => ({
        ...prev,
        images: [...(prev.images ?? []), newImage],
      }));
    }
  } catch (err) {
    console.error('Image upload error:', err);
  } finally {
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = '';
  }
};

/* ── Image delete ─────────────────────────────────────────── */
const handleImageDelete = async (imageId, idx) => {
  try {
    // Use apiFetch targeting the custom backend @action
    const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${id}/images/${imageId}/delete/`, {
      method: 'DELETE',
    });
    
    if (!res.ok) throw new Error('Delete failed');

    setFarm(prev => {
      const updated = prev.images.filter(img => img.id !== imageId);
      return { ...prev, images: updated };
    });
    setHeroIndex(prev => Math.max(0, prev === idx ? 0 : prev > idx ? prev - 1 : prev));
  } catch (err) {
    console.error('Image delete error:', err);
  }
};

  /* ── Delete farm ──────────────────────────────────────────── */
  const handleDeleteFarm = async () => {
    try {
      // Replaced plain fetch with apiFetch and updated DRF ViewSet URL pattern
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${id}/`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      navigate('/profile/farms/');
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Loading / Error ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="mfd-loading">
        <div className="loading-dots">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
        <span>Loading your farmland…</span>
      </div>
    );
  }

  if (error || !farm || !draft) {
    return (
      <div className="mfd-loading">
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <span style={{ fontStyle: 'normal', fontSize: '0.9rem' }}>{error ?? 'Something went wrong.'}</span>
        <button className="btn btn-secondary" onClick={() => navigate('/profile/farms/')}>← Back to My Farms</button>
      </div>
    );
  }

  const images     = farm.images ?? [];
  const heroImage  = images[heroIndex]?.image ?? null;
  const farmName   = [farm.district, farm.crop, 'Farm'].filter(Boolean).join(' ');
  const emoji      = CROP_EMOJI[draft.crop] ?? '🌿';
  const locationStr = [draft.district, draft.city, draft.region].filter(Boolean).join(', ');

  return (
    <div className="mfd-page">

      {/* ── Hero Image Zone ───────────────────────────────────── */}
      <div className="mfd-hero-zone">
        {heroImage
          ? <img className="mfd-hero-zone__img" src={heroImage} alt={farmName} />
          : (
            <div className="mfd-hero-zone__placeholder">
              <span className="mfd-hero-zone__placeholder-emoji">{emoji}</span>
              <span className="mfd-hero-zone__placeholder-text">No photos yet — add some below</span>
            </div>
          )
        }

        {/* Back */}
        <Link to="/profile/farms/" className="mfd-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          My Farms
        </Link>

        {/* Title overlay */}
        <div className="mfd-hero-overlay">
          <p className="mfd-hero-eyebrow">{locationStr || 'Your farmland'}</p>
          <h1 className="mfd-hero-title">{farmName}</h1>
        </div>
      </div>

      {/* ── Image Manager ─────────────────────────────────────── */}
      <div className="mfd-image-manager">
        <p className="mfd-image-manager__label">
          Photos · {images.length} {images.length === 1 ? 'image' : 'images'} · click a thumbnail to set as hero
        </p>
        <div className="mfd-image-strip">

          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`mfd-thumb ${idx === heroIndex ? 'mfd-thumb--active' : ''}`}
              onClick={() => setHeroIndex(idx)}
              title="Click to set as cover photo"
            >
              <img
                className="mfd-thumb__img"
                src={img.image}
                alt={`Farm photo ${idx + 1}`}
              />
              {idx === heroIndex && (
                <span className="mfd-thumb__hero-label">Cover</span>
              )}
              <button
                className="mfd-thumb__delete"
                onClick={e => { e.stopPropagation(); handleImageDelete(img.id, idx); }}
                aria-label="Delete photo"
                title="Remove this photo"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              {/* Click on image opens lightbox */}
              <div
                style={{ position: 'absolute', inset: 0, cursor: 'zoom-in' }}
                onClick={e => { e.stopPropagation(); setLightboxSrc(img.image); }}
              />
            </div>
          ))}

          {/* Upload tile */}
          <div className={`mfd-thumb mfd-thumb--upload ${uploading ? 'mfd-thumb--uploading' : ''}`}>
            {uploading ? (
              <div className="mfd-thumb__spinner" />
            ) : (
              <>
                <span className="mfd-thumb--upload__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </span>
                <span className="mfd-thumb--upload__text">Add photo</span>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                />
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="mfd-body">

        {/* ── Main column ─────────────────────────────────────── */}
        <div className="mfd-main">

          {/* — Core Details — */}
          <div className="mfd-section">
            <h2 className="mfd-section__heading">
              <span className="mfd-section__heading-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              Farm Details
            </h2>

            <div className="mfd-form-grid">
              <div className="mfd-field">
                <label className="mfd-label">District</label>
                <input
                  className={`mfd-input ${draft.district !== farm.district ? 'mfd-input--dirty' : ''}`}
                  placeholder="e.g. Alaşehir"
                  value={draft.district}
                  onChange={e => set('district', e.target.value)}
                />
              </div>

              <div className="mfd-field">
                <label className="mfd-label">City</label>
                <input
                  className={`mfd-input ${draft.city !== farm.city ? 'mfd-input--dirty' : ''}`}
                  placeholder="e.g. Manisa"
                  value={draft.city}
                  onChange={e => set('city', e.target.value)}
                />
              </div>

              <div className="mfd-field">
                <label className="mfd-label">Region</label>
                <select
                  className={`mfd-select ${draft.region !== farm.region ? 'mfd-select--dirty' : ''}`}
                  value={draft.region}
                  onChange={e => set('region', e.target.value)}
                >
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="mfd-field">
                <label className="mfd-label">Area (Acres)</label>
                <input
                  className={`mfd-input ${draft.acres !== farm.acres ? 'mfd-input--dirty' : ''}`}
                  type="number"
                  min="0"
                  placeholder="e.g. 45"
                  value={draft.acres}
                  onChange={e => set('acres', e.target.value)}
                />
              </div>

              <div className="mfd-field mfd-field--full">
                <label className="mfd-label">Description</label>
                <textarea
                  className={`mfd-textarea ${draft.description !== farm.description ? 'mfd-textarea--dirty' : ''}`}
                  placeholder="Describe bloom seasons, access roads, water sources, what makes your land special for bees…"
                  value={draft.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* — Crop Type — */}
          <div className="mfd-section">
            <h2 className="mfd-section__heading">
              <span className="mfd-section__heading-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </span>
              Crop Type
            </h2>
            <div className="mfd-crop-grid">
              {CROP_OPTIONS.map(({ label, emoji: em }) => (
                <button
                  key={label}
                  type="button"
                  className={`mfd-crop-option ${draft.crop === label ? 'mfd-crop-option--selected' : ''}`}
                  onClick={() => set('crop', label)}
                >
                  {em} {label}
                </button>
              ))}
            </div>
          </div>

          {saveError && (
            <p style={{ fontSize: '0.85rem', color: '#C0392B', marginTop: '-1rem', marginBottom: '1rem' }}>
              ⚠️ {saveError}
            </p>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────── */}
        <aside className="mfd-sidebar">

          {/* Listing metadata */}
          <div className="mfd-info-card">
            <p className="mfd-info-card__title">Listing Info</p>
            <div className="mfd-info-row">
              <span className="mfd-info-row__label">Farm ID</span>
              <span className="mfd-info-row__value">#{farm.id}</span>
            </div>
            <div className="mfd-info-row">
              <span className="mfd-info-row__label">Photos</span>
              <span className="mfd-info-row__value">{images.length}</span>
            </div>
            {farm.acres && (
              <div className="mfd-info-row">
                <span className="mfd-info-row__label">Area</span>
                <span className="mfd-info-row__value">{farm.acres} acres</span>
              </div>
            )}
            {farm.crop && (
              <div className="mfd-info-row">
                <span className="mfd-info-row__label">Crop</span>
                <span className="mfd-info-row__value">{CROP_EMOJI[farm.crop]} {farm.crop}</span>
              </div>
            )}
          </div>

          {/* Public listing link */}
          <Link to={`/farm/${farm.id}/`} className="mfd-public-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            View public listing
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </Link>

          {/* Danger zone */}
          <div className="mfd-danger-zone">
            <p className="mfd-danger-zone__title">Danger Zone</p>
            <p className="mfd-danger-zone__desc">
              Permanently removing this listing will delete all photos and
              beekeeper connections. This cannot be undone.
            </p>
            <button
              className="btn btn--danger"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowDeleteModal(true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
              Remove this farmland
            </button>
          </div>

        </aside>
      </div>

      {/* ── Sticky Save Bar ───────────────────────────────────── */}
      {isDirty && (
        <div className="mfd-save-bar">
          <p className="mfd-save-bar__text">
            You have <strong>unsaved changes</strong> — don't forget to save before leaving.
          </p>
          <div className="mfd-save-bar__actions">
            <button className="mfd-save-bar__discard" onClick={discard}>
              Discard
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────── */}
      {showDeleteModal && (
        <DeleteModal
          farmName={farmName}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteFarm}
        />
      )}

      {/* ── Lightbox ──────────────────────────────────────────── */}
      {lightboxSrc && (
        <div className="mfd-lightbox" onClick={() => setLightboxSrc(null)}>
          <img className="mfd-lightbox__img" src={lightboxSrc} alt="Full size" onClick={e => e.stopPropagation()} />
          <button className="mfd-lightbox__close" onClick={() => setLightboxSrc(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

    </div>
  );
}