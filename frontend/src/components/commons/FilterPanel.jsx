import React, { useRef, useEffect } from 'react';
import '../../styles/common/FilterPanel.css'

// 1. Updated to match backend CROPS list exactly
const ALL_CROPS = [
  'Sunflowers', 'Apples', 'Clover', 'Lavender', 
  'Wildflowers', 'Olives', 'Figs', 'Thyme', 
  'Peaches', 'Oranges', 'Cherries', 'Carrots', 
  'Sesame', 'Watermelons', 'Hazelnuts', 'Tea', 'Cotton'
];

// 2. Updated to match backend REGIONS list exactly 
// (Keeping 'All Regions' for the reset state)
const REGIONS = [
  'Tüm Bölgeler',
  'IC_ANADOLU',
  'EGE',
  'MARMARA',
  'AKDENIZ',
  'KARADENIZ',
  'DOGU_ANADOLU',
  'GUNEY_DOGU_ANADOLU',
];

// 3. Updated to match the max value of 500.0 generated in the backend
const SIZE_MAX = 500;

export default function FilterPanel({ filters, onChange, onClose, anchorRef }) {
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  function toggleCrop(crop) {
    const next = filters.crops.includes(crop)
      ? filters.crops.filter(c => c !== crop)
      : [...filters.crops, crop];
    onChange({ ...filters, crops: next });
  }

  function clearAll() {
    onChange({ crops: [], minSize: 0, region: 'All Regions' });
  }

  const hasFilters =
    filters.crops.length > 0 ||
    filters.minSize > 0 ||
    filters.region !== 'All Regions';

  return (
    <div className="filter-panel" ref={panelRef} role="dialog" aria-label="Filter farmlands">
      {/* Header */}
      <div className="filter-panel__header">
        <span className="filter-panel__heading">Filter Farmlands</span>
        <div className="filter-panel__header-actions">
          {hasFilters && (
            <button className="filter-panel__clear" onClick={clearAll}>
              Clear all
            </button>
          )}
          <button className="filter-panel__close" onClick={onClose} aria-label="Close filters">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Region */}
      <div className="filter-section">
        <label className="filter-section__label">Region</label>
        <select
          className="filter-select"
          value={filters.region}
          onChange={e => onChange({ ...filters, region: e.target.value })}
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Min size slider */}
      <div className="filter-section">
        <div className="filter-section__label-row">
          <label className="filter-section__label">Minimum Size</label>
          <span className="filter-section__value">
            {filters.minSize === 0 ? 'Any' : `${filters.minSize}+ acres`}
          </span>
        </div>
        <input
          type="range"
          className="filter-slider"
          min="0"
          max={SIZE_MAX}
          step="10"
          value={filters.minSize}
          onChange={e => onChange({ ...filters, minSize: Number(e.target.value) })}
        />
        <div className="filter-slider__labels">
          <span>Any</span>
          <span>{SIZE_MAX} acres</span>
        </div>
      </div>

      {/* Crop type chips */}
      <div className="filter-section">
        <label className="filter-section__label">Crop Type</label>
        <div className="filter-crops">
          {ALL_CROPS.map(crop => (
            <button
              key={crop}
              className={`filter-crop-chip ${filters.crops.includes(crop) ? 'filter-crop-chip--active' : ''}`}
              onClick={() => toggleCrop(crop)}
            >
              {crop}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}