import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { apiFetch } from '../../api/apiFetch'; 
import '../../styles/profile/CreateFarmPage.css';

// Note: Ensure you have leaflet CSS imported somewhere in your app (e.g., App.js or index.html)
// import 'leaflet/dist/leaflet.css';

/* ─── Constants ─────────────────────────────────────────────── */
const CROP_OPTIONS = [
  { label: 'Sunflowers', emoji: '🌻' }, { label: 'Apples',     emoji: '🍎' },
  { label: 'Clover',     emoji: '🍀' }, { label: 'Lavender',   emoji: '💜' },
  { label: 'Wildflowers',emoji: '🌸' }, { label: 'Olives',     emoji: '🫒' },
  { label: 'Figs',       emoji: '🍇' }, { label: 'Thyme',      emoji: '🌿' },
  { label: 'Peaches',    emoji: '🍑' }, { label: 'Oranges',    emoji: '🍊' },
  { label: 'Cherries',   emoji: '🍒' }, { label: 'Sesame',     emoji: '🌾' },
  { label: 'Watermelons',emoji: '🍉' }, { label: 'Hazelnuts',  emoji: '🌰' },
  { label: 'Tea',        emoji: '🍵' }, { label: 'Cotton',     emoji: '☁️' },
];

const CROP_EMOJI = Object.fromEntries(CROP_OPTIONS.map(c => [c.label, c.emoji]));

const REGIONS = [
  'MARMARA', 'KARADENIZ', 'IC_ANADOLU', 'DOGU_ANADOLU',
  'EGE', 'AKDENIZ', 'GUNEY_DOGU_ANADOLU',
];

function FieldError({ name, errors }) {
  const msgs = errors[name];
  if (!msgs?.length) return null;
  return (
    <p className="cfp-field-error">
      {msgs.join(' ')}
    </p>
  );
}

/* ─── Map Click Handler Sub-component ───────────────────────── */
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function CreateFarmPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  /* ── Form State ───────────────────────────────────────────── */
  const [form, setForm] = useState({
    crop: '',
    district: '',
    city: '',
    region: REGIONS[0],
    acres: '',
    description: '',
  });
  
  const [position, setPosition] = useState(null); 
  
  // Image state
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  /* ── Helpers ──────────────────────────────────────────────── */
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  /* ── Image Handlers ───────────────────────────────────────── */
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    setImages(prev => [...prev, ...files]);
    
    // Create local object URLs for immediate preview
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
    
    // Reset input so the same files can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      // Revoke the object URL to avoid memory leaks
      URL.revokeObjectURL(prev[idx]); 
      return updated;
    });
  };

  /* ── Save / Create ────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crop) {
      setError("Please select a crop type.");
      return;
    }
  
    setSaving(true);
    setError(null);
    setFieldErrors({});   // ← reset on each submit
  
    const currentUserStr = localStorage.getItem('user');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};
  
    const payload = {
      ...form,
      location: position ? `${position.lat},${position.lng}` : '',
      user: currentUser.id,
    };
  
    try {
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
  
      if (!res.ok) {
        // ← Parse Django's field-level error response
        const body = await res.json().catch(() => ({}));
        if (typeof body === 'object' && !body.detail) {
          // Shape: { description: ["Ensure this field has no more than 500 characters."], ... }
          setFieldErrors(body);
          if (typeof body === 'object' && !body.detail) {
            setFieldErrors(body);
          
            // Scroll to the first field with an error
            const firstErrorKey = Object.keys(body)[0];
            const fieldMap = {
              district:    '[name="district"]',
              city:        '[name="city"]',
              region:      '[name="region"]',
              acres:       '[name="acres"]',
              description: '[name="description"]',
              location:    '.cfp-map-container',
              crop:        '.cfp-crop-grid',
            };
            const selector = fieldMap[firstErrorKey];
            if (selector) {
              const el = document.querySelector(selector);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el?.focus?.();
            }
          
            throw new Error('Please fix the errors highlighted below.');
          }
        }
        throw new Error(body.detail ?? `Request failed (${res.status})`);
      }
  
      const newFarm = await res.json();
  
      if (images.length > 0) {
        for (const file of images) {
          const formData = new FormData();
          formData.append('image', file);
          await apiFetch(
            `${process.env.REACT_APP_BACKEND_URL}/farms/myfarms/${newFarm.id}/images/upload/`,
            { method: 'POST', body: formData }
          );
        }
      }
  
      navigate(`/profile/farms/${newFarm.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="cfp-page">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="cfp-header">
        <Link to="/profile/farms/" className="cfp-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to My Farms
        </Link>
        <h1 className="cfp-title">List a new <em>farmland</em></h1>
        <p className="cfp-subtitle">Fill out the details below to connect your land with local beekeepers.</p>
      </div>

      <form className="cfp-body" onSubmit={handleSubmit}>
        
        <div className="cfp-main">

          {/* — Core Details — */}
          <div className="cfp-section">
            <h2 className="cfp-section__heading">
              <span className="cfp-section__heading-icon">📝</span>
              Farm Details
            </h2>

            <div className="cfp-form-grid">
              <div className="cfp-field">
                <label className="cfp-label">District *</label>
                <input
                  className="cfp-input"
                  placeholder="e.g. Alaşehir"
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                  required
                />
                <FieldError name="District" errors={fieldErrors} />
              </div>

              <div className="cfp-field">
                <label className="cfp-label">City *</label>
                <input
                  className="cfp-input"
                  placeholder="e.g. Manisa"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  required
                />
                <FieldError name="city" errors={fieldErrors} />
              </div>

              <div className="cfp-field">
                <label className="cfp-label">Region *</label>
                <select
                  className="cfp-select"
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                >
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <FieldError name="region" errors={fieldErrors} />
              </div>

              <div className="cfp-field">
                <label className="cfp-label">Area (Acres)</label>
                <input
                  name='acres'
                  className="cfp-input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 45"
                  value={form.acres}
                  onChange={e => set('acres', e.target.value)}
                />
                <FieldError name="acres" errors={fieldErrors} />
              </div>

              <div className="cfp-field cfp-field--full">
                <label className="cfp-label">Description</label>
                <textarea
                  className="cfp-textarea"
                  placeholder="Describe bloom seasons, access roads, water sources, what makes your land special for bees…"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
                <FieldError name="description" errors={fieldErrors} />
              </div>
            </div>
          </div>

          {/* — Photos — */}
          <div className="cfp-section">
            <h2 className="cfp-section__heading">
              <span className="cfp-section__heading-icon">📸</span>
              Photos
            </h2>
            <p className="cfp-help-text">Add photos of your land to attract beekeepers.</p>
            
            {previews.length > 0 && (
              <div className="cfp-image-strip">
                {previews.map((src, idx) => (
                  <div key={idx} className="cfp-thumb">
                    <img src={src} alt={`Preview ${idx + 1}`} />
                    <button
                      type="button"
                      className="cfp-thumb__delete"
                      onClick={() => removeImage(idx)}
                      aria-label="Remove photo"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="cfp-image-upload-box" onClick={() => fileInputRef.current?.click()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{color: '#888', marginBottom: '0.5rem'}}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p style={{margin: 0, fontWeight: 600, color: '#444'}}>Click to upload images</p>
              <p style={{margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888'}}>JPG, PNG, WEBP allowed</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* — Map Location — */}
          <div className="cfp-section">
            <h2 className="cfp-section__heading">
              <span className="cfp-section__heading-icon">📍</span>
              Pinpoint Location
            </h2>
            <p className="cfp-help-text">Click on the map to drop a pin exactly where your farm is located.</p>

            <div className={`cfp-map-container ${fieldErrors.location ? 'cfp-map-container--invalid' : ''}`}>
            <MapContainer
              center={[38.9637, 35.2433]}
              zoom={6}
              scrollWheelZoom={true}
              className="cfp-leaflet-map"
            >
              {/* Base: Esri satellite */}
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri'
              />

              {/* Overlay: Esri Boundaries and Places */}
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                /* No attribution needed here if you already have the Esri one above */
              />

              <LocationMarker
                position={position}
                setPosition={(pos) => {
                  setPosition(pos);
                  if (fieldErrors.location) setFieldErrors(f => ({ ...f, location: null }));
                }}
              />
            </MapContainer>
            </div>

  {/* Inline error message */}
  <FieldError name="location" errors={fieldErrors} />

  {position && (
    <p className="cfp-coordinates">
      Selected Coordinates: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
    </p>
  )}
</div>

          {/* — Crop Type — */}
          <div className="cfp-section">
            <h2 className="cfp-section__heading">
              <span className="cfp-section__heading-icon">🌾</span>
              Primary Crop *
            </h2>
            <div className="cfp-crop-grid">
              {CROP_OPTIONS.map(({ label, emoji: em }) => (
                <button
                  key={label}
                  type="button"
                  className={`cfp-crop-option ${form.crop === label ? 'cfp-crop-option--selected' : ''}`}
                  onClick={() => set('crop', label)}
                >
                  {em} {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="cfp-error-banner">
              ⚠️ {error}
            </div>
          )}

          {/* — Submit Actions — */}
          <div className="cfp-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/profile/farms/')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Listing'}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}