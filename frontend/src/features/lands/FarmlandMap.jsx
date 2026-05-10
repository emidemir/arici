import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '../../api/apiFetch';
import '../../styles/lands/FarmlandMap.css';

// ─── Icons ────────────────────────────────────────────────────────────────────

const farmIcon = L.divIcon({
  className: 'custom-farm-icon',
  html: `
    <div style="
      background-color: #D4891A;
      width: 38px; height: 38px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #FBF8F2;
      box-shadow: 0 4px 12px rgba(28, 43, 26, 0.35);
      display: flex; justify-content: center; align-items: center;
    ">
      <span style="transform: rotate(45deg); font-size: 17px; line-height:1;">🌻</span>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -40],
});

function makeClusterIcon(count) {
  const size = count > 99 ? 58 : count > 9 ? 52 : 46;
  return L.divIcon({
    html: `
      <div style="
        background: #2D4A2A;
        color: #F5F0E8;
        font-family: 'DM Sans', sans-serif;
        font-weight: 600;
        font-size: ${count > 99 ? 13 : 15}px;
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        display: flex; justify-content: center; align-items: center;
        border: 3px solid #F0C96A;
        box-shadow: 0 4px 12px rgba(28, 43, 26, 0.4);
      ">${count}</div>
    `,
    className: 'custom-marker-cluster',
    iconSize: L.point(size, size, true),
  });
}

// ─── Inner component — has access to the Leaflet map instance ─────────────────

function MapInner({ filters, onClusters, onLoading, onError }) {
  const map = useMap();

  const fetchClusters = useCallback(async () => {
    const zoom   = map.getZoom();
    const bounds = map.getBounds();
    const sw     = bounds.getSouthWest();
    const ne     = bounds.getNorthEast();

    onLoading(true);
    onError(null);
    try {
      // 1. Build the base payload
      const payload = {
        zoom,
        sw_lat: sw.lat, 
        sw_lng: sw.lng,
        ne_lat: ne.lat, 
        ne_lng: ne.lng,
      };

      // 2. Map React state to Django GET parameters
      if (filters.crops && filters.crops.length > 0) {
        payload.crop_type__in = filters.crops.join(','); // Array to comma-string
      }

      if (filters.minSize > 0) {
        payload.acres__gte = filters.minSize;
      }

      if (filters.region && filters.region !== 'All Regions') {
        payload.region = filters.region; // Only send if it's a specific region
      }

      // 3. Send formatted payload to your API service

      
      const params = new URLSearchParams({
        zoom,
        sw_lat: sw.lat, sw_lng: sw.lng,
        ne_lat: ne.lat, ne_lng: ne.lng,
        ...(filters.crops?.length        && { crop_type__in: filters.crops.join(',') }),
        ...(filters.minSize > 0          && { acres__gte: filters.minSize }),
        ...(filters.region !== 'All Regions' && { region: filters.region }),
      });
      
      const response = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/farms/clusters/?${params}`);
      if (!response.ok) throw new Error('Cluster fetch failed');
      const data = await response.json();
      onClusters(data.clusters ?? []);

    } catch (err) {
      console.error('Cluster fetch failed:', err);
      onError(true);
    } finally {
      onLoading(false);
    }
  }, [map, filters, onClusters, onLoading, onError]);

  // ── FIX 1: fetch on mount via useEffect ───────────────────────────────────
  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]); // also re-fetches when filters change

  // ── Also fetch on pan / zoom ──────────────────────────────────────────────
  useMapEvents({
    moveend: fetchClusters,
    zoomend: fetchClusters,
  });

  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TURKEY_BOUNDS = [[35.0, 24.5], [43.5, 45.5]];
const DEFAULT_CENTER = [39.0, 35.0];
const DEFAULT_ZOOM   = 6;

// ─── Main component ───────────────────────────────────────────────────────────

export default function FarmlandMap({ filters = {} }) {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const renderMarkers = () =>
    clusters.map((cluster, i) => {
      const pos = [cluster.lat, cluster.lng];

      if (cluster.count === 1) {
        return (
          <Marker key={cluster.single_id ?? `solo-${i}`} position={pos} icon={farmIcon}>
            <Popup className="farm-popup">
              <div className="map-popup-card">
                <div className="map-popup-card__header">
                  <span className="map-popup-card__icon">🌻</span>
                  <div>
                    <h3 className="map-popup-card__title">
                      {cluster.district ?? cluster.city ?? 'Farmland'}
                    </h3>
                    <span className="tag tag--green">{cluster.crop_type}</span>
                  </div>
                </div>
                <div className="map-popup-card__row">
                  <span className="map-popup-card__label">Available Area</span>
                  <span className="map-popup-card__value">{cluster.acres} acres</span>
                </div>
                <button
                  className="btn btn-primary map-popup-card__cta"
                  onClick={() => navigate(`/farm/${cluster.single_id}`)}
                >
                  View Details →
                </button>
              </div>
            </Popup>
          </Marker>
        );
      }

      return (
        <Marker key={`cluster-${i}`} position={pos} icon={makeClusterIcon(cluster.count)}>
          <Popup className="farm-popup">
            <div className="map-popup-card">
              <div className="map-popup-card__header">
                <span className="map-popup-card__icon">🗺️</span>
                <div>
                  <h3 className="map-popup-card__title">{cluster.count} Farmlands</h3>
                  <span className="tag tag--green">{cluster.region ?? 'This area'}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-bark)', margin: '0.25rem 0 0' }}>
                Zoom in to explore individual farms.
              </p>
            </div>
          </Popup>
        </Marker>
      );
    });

  return (
    <div className="farmland-map-wrapper">
      {loading && (
        <div className="map-loading-overlay">
          <div className="loading-dots">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
        </div>
      )}
      {error && !loading && (
        <p></p>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={5}
        maxZoom={16}
        maxBounds={TURKEY_BOUNDS}
        maxBoundsViscosity={0.85}
        className="farmland-map"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri'
        />
        {/* MapInner lives inside MapContainer so useMap() works */}
        <MapInner
          filters={filters}
          onClusters={setClusters}
          onLoading={setLoading}
          onError={setError}
        />
        {renderMarkers()}
      </MapContainer>
    </div>
  );
}