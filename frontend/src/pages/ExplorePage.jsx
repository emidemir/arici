import React, { useState, useEffect, useRef, useCallback } from 'react';
import FarmlandList from '../features/lands/FarmlandList';
import FarmlandMap  from '../features/lands/FarmlandMap';
import FilterPanel from '../components/commons/FilterPanel'
import '../styles/pages/ExplorePage.css';

const DEFAULT_FILTERS = { crops: [], minSize: 0, region: 'All Regions' };

export default function ExplorePage() {

  const [viewMode, setViewMode]   = useState('map');
  const [filters, setFilters]     = useState(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  // List-view state
  const [farmlands, setFarmlands] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError]     = useState(null);

  const filterBtnRef = useRef(null);

  // ── Fetch list data whenever filters change OR user switches to list view ──
  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (filters.crops?.length)             params.set('crop', filters.crops.join(','));
      if (filters.minSize > 0)              params.set('acres__gte', filters.minSize);
      if (filters.region !== 'All Regions') params.set('region', filters.region);
  
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/farms/list/?${params}`);
      if (!response.ok) throw new Error('Failed to fetch farmlands');
      const data = await response.json();
  
      setFarmlands(data.results ?? data);
      setTotalCount(data.count ?? (data.results ?? data).length);
    } catch (err) {
      console.error('Failed to fetch farmlands:', err);
    } finally {
      setListLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (viewMode === 'list') fetchList();
  }, [viewMode, fetchList]);

  // ── Active filter count for badge ──────────────────────────────────────────
  const activeCount =
    filters.crops.length +
    (filters.minSize > 0 ? 1 : 0) +
    (filters.region !== 'All Regions' ? 1 : 0);

  // ── List content ───────────────────────────────────────────────────────────
  const renderListContent = () => {
    if (listLoading) {
      return (
        <div className="loading-screen">
          <div className="loading-dots">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <span>Finding farmlands…</span>
        </div>
      );
    }
    if (listError) {
      return (
        <div className="explore-empty">
          <span className="explore-empty__icon">⚠️</span>
          <p className="explore-empty__text">{listError}</p>
          <button className="btn btn-secondary" onClick={fetchList}>Retry</button>
        </div>
      );
    }
    if (farmlands.length === 0) {
      return (
        <div className="explore-empty">
          <span className="explore-empty__icon">🌾</span>
          <p className="explore-empty__text">No farmlands match your filters.</p>
          <button className="btn btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        </div>
      );
    }
    return <FarmlandList farmlands={farmlands} />;
  };

  return (
    <div className={`explore-page explore-page--${viewMode}`}>

      {/* ── Floating toolbar ──────────────────────────────────────────────── */}
      <div className="explore-toolbar">
        <div className="explore-toolbar__brand">
          <span className="explore-toolbar__title">
            Polenlenmeye hazır <em>tarlalar</em>
          </span>
          <span className="explore-toolbar__pill">
            {viewMode === 'list' && !listLoading
              ? `${totalCount} found`
              : 'Explore Turkey'}
          </span>
        </div>

        <div className="explore-toolbar__right">
          <div className="explore-toolbar__stats">
            <span className="explore-toolbar__stat"><strong>170+</strong> Listed</span>
            <span className="explore-toolbar__sep">·</span>
            <span className="explore-toolbar__stat"><strong>12</strong> Regions</span>
            <span className="explore-toolbar__sep">·</span>
            <span className="explore-toolbar__stat"><strong>94%</strong> Satisfied</span>
          </div>

          {/* ── Filter button + panel ────────────────────────────────────── */}
          <div className="filter-wrapper">
            <button
              ref={filterBtnRef}
              className={`filter-btn ${panelOpen ? 'filter-btn--open' : ''} ${activeCount > 0 ? 'filter-btn--active' : ''}`}
              onClick={() => setPanelOpen(o => !o)}
              aria-expanded={panelOpen}
              aria-label="Open filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filters
              {activeCount > 0 && (
                <span className="filter-btn__badge">{activeCount}</span>
              )}
            </button>

            {panelOpen && (
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onClose={() => setPanelOpen(false)}
                anchorRef={filterBtnRef}
              />
            )}
          </div>

          {/* ── View toggle ──────────────────────────────────────────────── */}
          <div className="view-toggle">
            <button
              className={`view-toggle__btn ${viewMode === 'map' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              </svg>
              Map
            </button>
            <button
              className={`view-toggle__btn ${viewMode === 'list' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              List
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {viewMode === 'map' ? (
        <div className="explore-map-fullscreen">
          {/* Map manages its own fetching via MapEventHandler + getClusters */}
          <FarmlandMap filters={filters} />
        </div>
      ) : (
        <div className="explore-list-view">
          {renderListContent()}
        </div>
      )}
    </div>
  );
}