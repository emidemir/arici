import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '../../api/apiFetch';
import { useAuth } from '../../context/AuthContext';
import '../../styles/lands/FarmlandDetail.css';

const cropEmoji = {
  Sunflowers: '🌻',
  Apples: '🍎',
  Clover: '🍀',
  Lavender: '💜',
  Wildflowers: '🌸',
  Olives: '🫒',
  Figs: '🍇',
  Thyme: '🌿',
  Peaches: '🍑',
  Oranges: '🍊',
  Cherries: '🍒',
  Carrots: '🥕',
  Sesame: '🌾',
  Watermelons: '🍉',
  Hazelnuts: '🌰',
  Tea: '🍵',
  Cotton: '☁️',
};

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="
    background-color: #D4891A;
    width: 32px; height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #FBF8F2;
    box-shadow: 0 4px 12px rgba(28,43,26,0.35);
    display: flex; justify-content: center; align-items: center;
  "><span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">🌾</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function parseWKTPoint(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return null;
  if (locationStr.includes(',')) {
    const parts = locationStr.split(',');
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  }
  const match = locationStr.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i);
  if (!match) return null;
  return [parseFloat(match[2]), parseFloat(match[1])];
}

export default function FarmlandDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [farm, setFarm]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Message button state
  const [startingChat, setStartingChat]   = useState(false);
  const [chatError, setChatError]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/farms/retrieve/${id}/`);
        if (!response.ok) throw new Error('Could not load this farmland.');
        const data = await response.json();
        if (!cancelled) setFarm(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Start / resume a conversation with the farmer ──────────────────────
  const handleSendMessage = async () => {
    console.log(farm.id)
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // The farmer's id comes straight from the farm object.
    // farm.user may be a UUID string or an object — handle both.
    const farmerId = typeof farm.user === 'object' ? farm.user?.id : farm.user;

    if (!farmerId) {
      setChatError('Could not identify the farm owner.');
      return;
    }

    // Don't let a farmer message themselves
    if (String(farmerId) === String(currentUser.id)) {
      setChatError("That's your own farm listing.");
      return;
    }

    setStartingChat(true);
    setChatError(null);

    try {
      // POST to get-or-create a conversation.
      // The backend should return the conversation object (with its id)
      // whether it already exists or was just created.
      const res = await apiFetch(
        `${process.env.REACT_APP_BACKEND_URL}/chats/conversations/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: farmerId,
            farm_id: id,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? 'Could not start conversation.');
      }

      const conversation = await res.json();
      navigate(`/chats?conversation=${conversation.id}`);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-dots">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
        <span>Finding this farmland…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <span style={{ fontStyle: 'normal', fontSize: '0.95rem', color: 'var(--color-bark)' }}>{error}</span>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back to Explore</button>
      </div>
    );
  }

  const cropType    = farm.crop;
  const emoji       = cropEmoji[cropType] ?? '🌿';
  const locationStr = [farm.district, farm.city, farm.region].filter(Boolean).join(', ');
  const acres       = farm.acres ? `${farm.acres} Acres` : '—';

  const farmerName  = farm.user?.full_name ?? farm.user?.username ?? 'Farm Owner';
  const farmerEmail = farm.user?.email ?? '—';
  const initials    = farmerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const position    = parseWKTPoint(farm.location);

  const hasImages         = Array.isArray(farm.images) && farm.images.length > 0;
  const hasMultipleImages = hasImages && farm.images.length > 1;

  const handlePrevImage = () =>
    setCurrentImageIndex(prev => (prev === 0 ? farm.images.length - 1 : prev - 1));
  const handleNextImage = () =>
    setCurrentImageIndex(prev => (prev === farm.images.length - 1 ? 0 : prev + 1));

  // Is this the current user's own farm?
  const farmerId  = typeof farm.user === 'object' ? farm.user?.id : farm.user;
  const isOwnFarm = currentUser && String(farmerId) === String(currentUser.id);

  return (
    <div className="detail-page">
      <div className={`detail-body ${position ? 'detail-body--with-map' : ''}`}>

        {/* Col 1 — main content */}
        <div className="detail-body__main">
          <div className="detail-title-block">
            <h1 className="detail-title">{farm.district} {cropType} Farm</h1>
            <div className="detail-stats-row">
              <div className="detail-stat">
                <span className="detail-stat__value">{acres}</span>
                <span className="detail-stat__label">Total Area</span>
              </div>
              <div className="detail-stat__sep" />
              <div className="detail-stat">
                <span className="detail-stat__value">{farm.region}</span>
                <span className="detail-stat__label">Region</span>
              </div>
              <div className="detail-stat__sep" />
              <div className="detail-stat">
                <span className="detail-stat__value">{farm.city}</span>
                <span className="detail-stat__label">City</span>
              </div>
            </div>
          </div>

          {farm.description && (
            <div className="detail-section">
              <h3 className="detail-section__heading">About this Farmland</h3>
              <p className="detail-section__body">{farm.description}</p>
            </div>
          )}

          {Array.isArray(farm.benefits) && farm.benefits.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section__heading">Why Beekeepers Love It</h3>
              <ul className="detail-benefits">
                {farm.benefits.map((b) => (
                  <li key={b} className="detail-benefit">
                    <span className="detail-benefit__dot" />{b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Col 2 — contact sidebar */}
        <aside className="detail-sidebar">
          <div className="contact-card">
            <div className="contact-card__header">
              <div className="contact-card__avatar">{initials}</div>
              <div>
                <p className="contact-card__name">{farmerName}</p>
                <p className="contact-card__role">Farm Owner</p>
              </div>
            </div>

            <div className="contact-card__email">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {farmerEmail}
            </div>

            {/* ── Send a Message button ── */}
            {!isOwnFarm && (
              <>
                <button
                  className="btn btn-primary contact-card__cta"
                  onClick={handleSendMessage}
                  disabled={startingChat}
                >
                  {startingChat ? (
                    <>
                      <span style={{ display: 'inline-flex', gap: 3 }}>
                        <span className="loading-dot" style={{ width: 6, height: 6 }} />
                        <span className="loading-dot" style={{ width: 6, height: 6 }} />
                        <span className="loading-dot" style={{ width: 6, height: 6 }} />
                      </span>
                      Opening chat…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Send a Message
                    </>
                  )}
                </button>

                {chatError && (
                  <p style={{
                    fontSize: '0.78rem',
                    color: '#c0392b',
                    marginTop: '-0.25rem',
                    textAlign: 'center',
                  }}>
                    ⚠ {chatError}
                  </p>
                )}
              </>
            )}

            {isOwnFarm && (
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--color-bark)',
                textAlign: 'center',
                padding: '0.5rem 0',
                fontStyle: 'italic',
              }}>
                This is your farm listing.
              </p>
            )}

            <button className="btn btn-secondary contact-card__cta">
              Schedule a Visit
            </button>

            <p className="contact-card__disclaimer">
              AgriHive Connect facilitates introductions. Always verify details in person.
            </p>
          </div>
        </aside>

        {/* Col 3 — hero image */}
        <div
          className="detail-hero-col"
          style={hasImages ? { padding: 0, overflow: 'hidden' } : {}}
        >
          {hasImages ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={farm.images[currentImageIndex].image}
                alt={`${cropType} field in ${farm.district}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s ease' }}
              />
              {hasMultipleImages && (
                <>
                  <button className="carousel-btn carousel-btn--prev" onClick={handlePrevImage} aria-label="Previous image">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <button className="carousel-btn carousel-btn--next" onClick={handleNextImage} aria-label="Next image">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                  <div className="carousel-counter">
                    {currentImageIndex + 1} / {farm.images.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <span className="detail-hero-col__emoji">{emoji}</span>
              <p className="detail-hero-col__placeholder-text">Field photos coming soon</p>
            </>
          )}
        </div>

        {/* Row 2 — full-width map */}
        {position && (
          <div className="detail-map-col">
            <div className="detail-map-col__label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {locationStr}
            </div>
            <MapContainer
              center={position}
              zoom={13}
              zoomControl={false}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <Marker position={position} icon={pinIcon} />
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}