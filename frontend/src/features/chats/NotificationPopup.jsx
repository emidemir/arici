import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../api/apiFetch';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/chats/NotificationPopup.css'

/* ─── Helpers ───────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function notifIcon(type) {
  switch (type) {
    case 'message': return { emoji: '💬', cls: 'notif-item__icon--message', tag: 'Message',  tagCls: 'notif-item__tag--message' };
    case 'farm':    return { emoji: '🌾', cls: 'notif-item__icon--farm',    tag: 'Farmland', tagCls: 'notif-item__tag--farm' };
    default:        return { emoji: '🔔', cls: 'notif-item__icon--system',  tag: 'System',   tagCls: '' };
  }
}

/* ─── Component ─────────────────────────────────────────────── */
export default function NotificationPopup({ onClose, onRead, onReadAll }) {
  const navigate    = useNavigate();
  const popupRef    = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);

  /* ── Fetch notifications ──────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/notifications/`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNotifications(data.results ?? data);
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  /* ── Close on outside click ───────────────────────────────── */
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  /* ── Mark single as read ──────────────────────────────────── */
  const markRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    try {
      await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/notifications/${id}/read/`, { method: 'PATCH' });
    } catch { }
  };

  /* ── Mark all as read ─────────────────────────────────────── */
  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    onReadAll?.(); // ← drops badge to 0 immediately in Navbar
    try {
      await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/notifications/read-all/`, { method: 'POST' });
    } catch { }
  };

  /* ── Handle click on a notification ──────────────────────── */
  const handleNotifClick = async (notif) => {  // ← async
    if (!notif.is_read) {
      await markRead(notif.id);  // ← await — DB is updated before we leave
      onRead?.();
    }
    onClose();
    if (notif.type === 'message' && notif.conversation_id) {
      navigate(`/chats/?conversation=${notif.conversation_id}`);
    } else if (notif.type === 'farm' && notif.farm_id) {
      navigate(`/farms/${notif.farm_id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notif-popup" ref={popupRef}>

      {/* Header */}
      <div className="notif-popup__header">
        <h3 className="notif-popup__title">
          Notifications {unreadCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-bark)', fontFamily: 'var(--font-body)', fontStyle: 'normal', fontWeight: 400 }}>
              · {unreadCount} new
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button className="notif-popup__mark-all" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="notif-popup__list">
        {loading ? (
          <div className="notif-popup__empty">
            <div className="loading-dots" style={{ marginBottom: '0.25rem' }}>
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-popup__empty">
            <span className="notif-popup__empty-icon">🔔</span>
            <p className="notif-popup__empty-text">You're all caught up</p>
          </div>
        ) : (
          notifications.map(notif => {
            const { emoji, cls, tag, tagCls } = notifIcon(notif.type);
            return (
              <div
                key={notif.id}
                className={`notif-item ${!notif.is_read ? 'notif-item--unread' : ''}`}
                onClick={() => handleNotifClick(notif)}
              >
                <div className={`notif-item__icon ${cls}`}>{emoji}</div>
                <div className="notif-item__body">
                  <p className="notif-item__text">
                    {notif.actor_name && <strong>{notif.actor_name} </strong>}
                    {notif.verb ?? notif.message}
                    {notif.message_count > 1 && (
                      <span style={{ color: 'var(--color-bark)', fontWeight: 400 }}>
                        {' '}· {notif.message_count} messages
                      </span>
                    )}
                  </p>
                  <div className="notif-item__meta">
                    <span className="notif-item__time">{timeAgo(notif.created_at)}</span>
                    <span className={`notif-item__tag ${tagCls}`}>{tag}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {!loading && notifications.length > 0 && (
        <div className="notif-popup__footer">
          <Link to="/notifications/" className="notif-popup__footer-link" onClick={onClose}>
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Export unread count hook for Navbar badge ─────────────── */
export function useUnreadNotifCount() {
  const [count, setCount]     = useState(0);
  const [ringing, setRinging] = useState(false);
  const prevCount             = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res  = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/notifications/unread-count/`);
      if (!res.ok) return;
      const data = await res.json();
      const n    = data.count ?? 0;
      if (n > prevCount.current) {
        setRinging(true);
        setTimeout(() => setRinging(false), 700);
      }
      prevCount.current = n;
      setCount(n);
    } catch { }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [poll]);

  return { count, ringing, refetch: poll };
}

/* ─── Export unread chat count hook for Navbar badge ────────── */
export function useUnreadChatCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function poll() {
      try {
        const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/chats/unread-count/`);
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, []);

  return count;
}