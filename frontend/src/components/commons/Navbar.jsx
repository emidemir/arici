import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationPopup, { useUnreadNotifCount, useUnreadChatCount } from '../../features/chats/NotificationPopup';
import '../../styles/common/Navbar.css'
import '../../styles/chats/NotificationPopup.css'

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [isMenuOpen, setIsMenuOpen]   = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const menuRef   = useRef(null);
  const notifRef  = useRef(null);

  /* ── Badge counts (polls silently) ───────────────────────── */
  const { count: notifCount, ringing, refetch: refetchNotifCount } = useUnreadNotifCount();
  const [localNotifCount, setLocalNotifCount] = useState(0);

  const chatCount = useUnreadChatCount();
  const [localChatCount, setLocalChatCount] = useState(0);

  const onChatPage = location.pathname.startsWith('/chats');

  /* ── Keep local counts in sync when polls return ─────────── */
  useEffect(() => {
    setLocalNotifCount(notifCount);
  }, [notifCount]);

  useEffect(() => {
    // If the user is already on the chat page, badge should always be 0
    if (onChatPage) {
      setLocalChatCount(0);
    } else {
      setLocalChatCount(chatCount);
    }
  }, [chatCount, onChatPage]);

  /* ── Clear chat badge instantly when navigating to chats ─── */
  useEffect(() => {
    if (onChatPage) {
      setLocalChatCount(0);
    }
  }, [onChatPage]);

  /* ── Notif read handlers ──────────────────────────────────── */
  const handleNotifRead = () => {
    setLocalNotifCount(prev => Math.max(0, prev - 1));
    refetchNotifCount();
  };

  const handleAllNotifRead = () => {
    setLocalNotifCount(0);
    refetchNotifCount();
  };

  /* ── Close account menu on outside click ─────────────────── */
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccountClick = () => {
    if (!user) {
      navigate('/auth/login/');
    } else {
      setIsMenuOpen(o => !o);
      setNotifOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate('/explore/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleBellClick = () => {
    if (!user) { navigate('/auth/login/'); return; }
    setNotifOpen(o => !o);
    setIsMenuOpen(false);
  };

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <div className="app-header__logo-icon">🐝</div>
        <span className="app-header__logo-text">
          Agri<span>Hive</span>
        </span>
      </Link>

      <nav className="app-header__nav">

        {/* ── Chat icon ─────────────────────────────────────── */}
        <Link
          to="/chats/"
          className={`nav-icon-btn ${onChatPage ? 'nav-icon-btn--active' : ''}`}
          title="Messages"
          aria-label="Open messages"
          onClick={() => setLocalChatCount(0)}  // ← clear instantly on click
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {user && localChatCount > 0 && (
            <span className="nav-icon-btn__badge">{localChatCount > 9 ? '9+' : localChatCount}</span>
          )}
        </Link>

        {/* ── Notification bell ──────────────────────────────── */}
        <div className="nav-account-container" ref={notifRef} style={{ position: 'relative' }}>
          <button
            className={`nav-icon-btn ${notifOpen ? 'nav-icon-btn--active' : ''} ${ringing ? 'nav-icon-btn--ringing' : ''}`}
            onClick={handleBellClick}
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={notifOpen}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {user && localNotifCount > 0 && (
              <span className="nav-icon-btn__badge">{localNotifCount > 9 ? '9+' : localNotifCount}</span>
            )}
          </button>

          {notifOpen && user && (
            <NotificationPopup
              onClose={() => setNotifOpen(false)}
              onRead={handleNotifRead}
              onReadAll={handleAllNotifRead}
            />
          )}
        </div>

        {/* ── Account pill / login ───────────────────────────── */}
        <div className="nav-account-container" ref={menuRef}>
          <button
            className={`nav-pill${!user ? ' nav-pill--auth' : ''}`}
            onClick={handleAccountClick}
          >
            {user ? 'Account ▾' : 'Login'}
          </button>

          {user && isMenuOpen && (
            <div className="nav-popup-menu">
              <div className="nav-popup-header">
                <p className="nav-popup-name">{user.full_name || user.username || 'Farmer'}</p>
                <p className="nav-popup-email">{user.email}</p>
              </div>

              <div className="nav-popup-divider" />

              <Link to="/profile/farms/" className="nav-popup-item" onClick={() => setIsMenuOpen(false)}>My Farms</Link>
              <Link
                to="/chats/"
                className="nav-popup-item"
                onClick={() => { setIsMenuOpen(false); setLocalChatCount(0); }} // ← clear instantly from menu too
              >
                Messages
                {localChatCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: 18, height: 18,
                    borderRadius: 9,
                    background: 'var(--color-honey)',
                    color: 'var(--color-soil)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {localChatCount}
                  </span>
                )}
              </Link>

              <div className="nav-popup-divider" />

              <button className="nav-popup-item text-danger" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}
        </div>

      </nav>
    </header>
  );
}