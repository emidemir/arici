import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/lands/FarmlandList.css';

const cropEmoji = {
  Sunflowers: '🌻', Apples: '🍎', Clover: '🍀', Lavender: '💜',
  Wildflowers: '🌸', Olives: '🫒', Figs: '🍇', Thyme: '🌿',
  Peaches: '🍑', Oranges: '🍊', Cherries: '🍒', Carrots: '🥕',
  Sesame: '🌾', Watermelons: '🍉', Hazelnuts: '🌰', Tea: '🍵', Cotton: '☁️',
};

const cropColor = {
  Sunflowers:  '#F5E6A3',
  Apples:      '#F4C4C4',
  Clover:      '#C4E0C4',
  Lavender:    '#DDD0F0',
  Wildflowers: '#F9D4E8',
  Olives:      '#C8D8A8',
  Figs:        '#D4B8D4',
  Thyme:       '#B8D4B8',
  Peaches:     '#F9D4B4',
  Oranges:     '#FAD4A0',
  Cherries:    '#F4B4B4',
  Carrots:     '#FAD4A8',
  Sesame:      '#E8DCC8',
  Watermelons: '#C8E8C8',
  Hazelnuts:   '#D4C4A8',
  Tea:         '#C4D8C4',
  Cotton:      '#E8E8E8',
};

export default function FarmlandList({ farmlands }) {
  const navigate = useNavigate();

  if (!farmlands.length) {
    return (
      <div className="farmland-list farmland-list--empty">
        <p>No farmlands found in this area.</p>
      </div>
    );
  }

  return (
    <div className="farmland-list">
      {farmlands.map((farm, index) => {
        // ── FIX 2: use backend field names (crop_type, acres) ──────────────
        const crop  = farm.crop_type ?? farm.crop ?? '—';
        const size  = farm.acres     != null ? `${farm.acres} acres` : farm.size ?? '—';
        const title = farm.title
          ?? (farm.district ? `${farm.district} ${crop} Farm` : `${farm.city ?? farm.region} ${crop} Farm`);

        return (
          <div
            key={farm.id}
            className="farmland-card"
            onClick={() => navigate(`/farm/${farm.id}/`)}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div
              className="farmland-card__band"
              style={{ backgroundColor: cropColor[crop] || 'var(--color-mist)' }}
            >
              <span className="farmland-card__emoji">{cropEmoji[crop] || '🌿'}</span>
            </div>

            <div className="farmland-card__body">
              <div className="farmland-card__top">
                <div>
                  <h2 className="farmland-card__title">{title}</h2>
                  <div className="farmland-card__meta">
                    <span className="tag tag--green">{crop}</span>
                    <span className="farmland-card__size">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      {size}
                    </span>
                  </div>
                </div>

                <div className="farmland-card__arrow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>

              <p className="farmland-card__hint">Tap to view details & contact farmer</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}