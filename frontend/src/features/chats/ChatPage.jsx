import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api/apiFetch';
import { tokenManager } from '../../lib/TokenManager';
import { useAuth } from '../../context/AuthContext';
import '../../styles/chats/ChatPage.css';

/* ─── Constants ─────────────────────────────────────────────── */
const CROP_EMOJI = {
  Sunflowers: '🌻', Apples: '🍎', Clover: '🍀', Lavender: '💜',
  Wildflowers: '🌸', Olives: '🫒', Figs: '🍇', Thyme: '🌿',
  Peaches: '🍑', Oranges: '🍊', Cherries: '🍒', Sesame: '🌾',
  Watermelons: '🍉', Hazelnuts: '🌰', Tea: '🍵', Cotton: '☁️',
};

/* ─── Helpers ───────────────────────────────────────────────── */
function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMsgTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupMessages(messages) {
  const byDate = [];
  let lastDate = null;

  for (const msg of messages) {
    const dateLabel = formatDateLabel(msg.created_at);
    if (dateLabel !== lastDate) {
      byDate.push({ type: 'divider', label: dateLabel });
      lastDate = dateLabel;
    }
    byDate.push({ type: 'msg', ...msg });
  }

  const groups = [];
  let currentGroup = null;

  for (const item of byDate) {
    if (item.type === 'divider') {
      if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
      groups.push(item);
    } else {
      if (!currentGroup || currentGroup.sender_id !== item.sender_id) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          type: 'group',
          sender_id: item.sender_id,
          sender_name: item.sender_name,
          messages: [],
        };
      }
      currentGroup.messages.push(item);
    }
  }
  if (currentGroup) groups.push(currentGroup);
  return groups;
}

/* ─── Conversation Sidebar Item ─────────────────────────────── */
function ConvoItem({ convo, active, onClick }) {
  const other  = convo.other_participant;
  const name   = other?.full_name ?? other?.username ?? 'Unknown';
  const unread = convo.unread_count ?? 0;

  return (
    <div
      className={`chat-convo-item ${active ? 'chat-convo-item--active' : ''} ${unread > 0 ? 'chat-convo-item--unread' : ''}`}
      onClick={onClick}
    >
      <div className="chat-convo-item__avatar">
        {other?.avatar
          ? <img className="chat-convo-item__avatar--img" src={other.avatar} alt={name} />
          : initials(name)
        }
        {other?.is_online && <span className="chat-convo-item__online" />}
      </div>

      <div className="chat-convo-item__content">
        <div className="chat-convo-item__top">
          <span className="chat-convo-item__name">{name}</span>
          {convo.last_message && (
            <span className="chat-convo-item__time">{timeAgo(convo.last_message.created_at)}</span>
          )}
        </div>

        {convo.farm && (
          <div className="chat-convo-item__preview chat-convo-item__preview--farm">
            <span>{CROP_EMOJI[convo.farm.crop] ?? '🌾'}</span>
            {convo.farm.district} {convo.farm.crop}
          </div>
        )}

        {convo.last_message && (
          <div className="chat-convo-item__preview">
            {convo.last_message.is_mine ? 'You: ' : ''}{convo.last_message.body}
          </div>
        )}
      </div>

      {unread > 0 && (
        <span className="chat-convo-item__badge">{unread > 9 ? '9+' : unread}</span>
      )}
    </div>
  );
}

/* ─── Message Thread ─────────────────────────────────────────── */
function MessageThread({ conversation, currentUserId, onMessageSent }) {
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [wsReady, setWsReady]   = useState(false);

  const bottomRef        = useRef(null);
  const textareaRef      = useRef(null);
  const wsRef            = useRef(null);
  const currentUserIdRef = useRef(currentUserId);

  // Keep the ref in sync whenever the prop changes
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const other     = conversation.other_participant;
  const otherName = other?.full_name ?? other?.username ?? 'Unknown';
  const farm      = conversation.farm;

  // ── 1. Load message history via REST ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch(
          `${process.env.REACT_APP_BACKEND_URL}/chats/conversations/${conversation.id}/messages/`
        );
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) setMessages(data.results ?? data);
      } catch { /* silently fail — WS still works */ }
      finally  { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [conversation.id]);

  // ── 2. Open WebSocket for real-time send/receive ───────────────────────
  useEffect(() => {
    let ws = null;

    async function openSocket() {
      let token = '';
      try {
        token = await tokenManager.get_valid_token();
      } catch {
        // Not authenticated — consumer will reject the connection
      }

      const wsHost   = process.env.REACT_APP_WS_HOST ?? window.location.host;
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(
        `${protocol}://${wsHost}/ws/chat/${conversation.id}/?token=${token}`
      );

      wsRef.current = ws;

      ws.onopen = () => {
        setWsReady(true);
        ws.send(JSON.stringify({ type: 'chat.read' }));
      };

      ws.onclose = () => setWsReady(false);
      ws.onerror = () => setWsReady(false);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'chat.message') {
          // Always read from the ref — never from the closed-over prop value,
          // which may have been undefined at the time the socket opened.
          const isMine = String(data.sender_id) === String(currentUserIdRef.current);

          if (isMine) {
            setMessages(prev => {
              const idx = data.temp_id
                ? prev.findIndex(m => m.id === data.temp_id)
                : prev.findIndex(m => m.status === 'sending' && m.is_mine);

              if (idx === -1) return prev;

              const next = [...prev];
              next[idx] = { ...data, is_mine: true, status: 'sent' };
              return next;
            });
            setSending(false);
          } else {
            setMessages(prev => {
              // Deduplication guard for incoming messages
              if (prev.some(m => String(m.id) === String(data.id))) return prev;
              return [...prev, { ...data, is_mine: false }];
            });
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'chat.read' }));
            }
          }

          onMessageSent?.(data);
        }

        if (data.type === 'chat.read') {
          if (String(data.reader_id) !== String(currentUserIdRef.current)) {
            setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
          }
        }

        if (data.type === 'chat.error') {
          setMessages(prev =>
            prev.map(m => m.status === 'sending' ? { ...m, status: 'failed' } : m)
          );
          setSending(false);
        }
      };
    }

    openSocket();

    return () => {
      if (ws) ws.close();
      wsRef.current = null;
      setWsReady(false);
    };
  }, [conversation.id]);

  // ── 3. Scroll to bottom whenever messages change ───────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 4. Auto-grow textarea ──────────────────────────────────────────────
  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  };

  // ── 5. Send via WebSocket only ────────────────────────────────────────
  const handleSend = () => {
    const body = text.trim();
    if (!body || sending || !wsReady) return;

    const tempId = `temp-${Date.now()}`;

    setMessages(prev => [...prev, {
      id:          tempId,
      body,
      sender_id:   currentUserIdRef.current,
      sender_name: 'You',
      is_mine:     true,
      created_at:  new Date().toISOString(),
      is_read:     false,
      status:      'sending',
    }]);

    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    wsRef.current.send(JSON.stringify({
      type:    'chat.message',
      body,
      temp_id: tempId,
    }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 6. Retry a failed message ──────────────────────────────────────────
  const handleRetry = (failedMsg) => {
    setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
    setText(failedMsg.body);
    textareaRef.current?.focus();
  };

  const grouped = groupMessages(messages);

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="chat-header__avatar">
          {initials(otherName)}
          {other?.is_online && <span className="chat-header__online" />}
        </div>

        <div className="chat-header__info">
          <p className="chat-header__name">{otherName}</p>
          <p className="chat-header__sub">
            {wsReady
              ? other?.is_online ? '🟢 Online' : '🟡 Connected'
              : '⚪ Connecting…'
            }
          </p>
        </div>

        {farm && (
          <Link
            to={`/farm/${farm.id}`}
            className="chat-header__farm-pill"
            title="View this farm listing"
          >
            {CROP_EMOJI[farm.crop] ?? '🌾'} {farm.district} {farm.crop}
          </Link>
        )}
      </div>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div className="chat-messages">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="loading-dots">
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
          </div>
        ) : (
          <>
            {farm && (
              <Link to={`/farm/${farm.id}`} className="chat-farm-context">
                <span className="chat-farm-context__emoji">{CROP_EMOJI[farm.crop] ?? '🌾'}</span>
                <div className="chat-farm-context__info">
                  <p className="chat-farm-context__label">Discussing this farmland</p>
                  <p className="chat-farm-context__name">
                    {farm.district} {farm.crop} Farm · {farm.region}
                  </p>
                </div>
                <span className="chat-farm-context__arrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </span>
              </Link>
            )}

            {grouped.map((item, i) => {
              if (item.type === 'divider') {
                return (
                  <div key={`d-${i}`} className="chat-date-divider">
                    <span className="chat-date-divider__text">{item.label}</span>
                  </div>
                );
              }

              const isMine = item.messages[0]?.is_mine;

              return (
                <div
                  key={`g-${i}`}
                  className={`chat-msg-group ${isMine ? 'chat-msg-group--mine' : 'chat-msg-group--theirs'}`}
                >
                  {!isMine && (
                    <span className="chat-msg-group__sender">{item.sender_name}</span>
                  )}

                  {item.messages.map((msg, mi) => {
                    const isFirst = mi === 0;
                    const isLast  = mi === item.messages.length - 1;
                    return (
                      <div key={msg.id}>
                        <div
                          className={[
                            'chat-bubble',
                            isMine   ? 'chat-bubble--mine'    : 'chat-bubble--theirs',
                            isFirst  ? 'chat-bubble--first'   : '',
                            isLast   ? 'chat-bubble--last'    : '',
                            msg.status === 'sending' ? 'chat-bubble--sending' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {msg.body}

                          {msg.status === 'failed' && (
                            <span
                              className="chat-bubble__failed"
                              onClick={() => handleRetry(msg)}
                              title="Tap to retry"
                            >
                              ⚠ Tap to retry
                            </span>
                          )}
                        </div>

                        {isLast && (
                          <div className="chat-bubble__time">
                            {msg.status === 'sending'
                              ? 'Sending…'
                              : formatMsgTime(msg.created_at)
                            }
                            {isMine && msg.status !== 'sending' && msg.status !== 'failed' && (
                              <span className={`chat-bubble__status ${
                                msg.is_read ? 'chat-bubble__status--read' : 'chat-bubble__status--sent'
                              }`}>
                                <svg width="12" height="8" viewBox="0 0 16 10" fill="none">
                                  <path d="M1 5L5 9L15 1" stroke="currentColor"
                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  {msg.is_read && (
                                    <path d="M5 5L9 9L15 3" stroke="currentColor"
                                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  )}
                                </svg>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input ───────────────────────────────────────────────────── */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={wsReady ? `Message ${otherName}…` : 'Connecting…'}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!wsReady}
          />
          <button className="chat-input-emoji" type="button" title="Add emoji">
            🌻
          </button>
        </div>
        <button
          className={`chat-send-btn ${text.trim() && wsReady ? 'chat-send-btn--ready' : ''}`}
          onClick={handleSend}
          disabled={!text.trim() || sending || !wsReady}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function ChatPage() {
  const { user } = useAuth();
  const currentUserId = user?.id;  // ← pulled from context, not props

  const [searchParams, setSearchParams] = useSearchParams();
  const initialConvoId = searchParams.get('conversation');

  const [conversations, setConversations]   = useState([]);
  const [loadingConvos, setLoadingConvos]   = useState(true);
  const [activeConvoId, setActiveConvoId]   = useState(
    initialConvoId ? Number(initialConvoId) : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Fetch conversation list ────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const res = await apiFetch(`${process.env.REACT_APP_BACKEND_URL}/chats/conversations/`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConversations(data.results ?? data);
    } catch { /* silently fail */ }
    finally { setLoadingConvos(false); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Sync URL param → active conversation ──────────────────────────────
  useEffect(() => {
    if (initialConvoId) setActiveConvoId(Number(initialConvoId));
  }, [initialConvoId]);

  // ── Select a conversation ──────────────────────────────────────────────
  const handleSelectConvo = (convo) => {
    setActiveConvoId(convo.id);
    setSearchParams({ conversation: convo.id });
    setSidebarOpen(false);
    setConversations(prev =>
      prev.map(c => c.id === convo.id ? { ...c, unread_count: 0 } : c)
    );
  };

  // ── Update sidebar preview when a message is sent or received ──────────
  const handleMessageSent = (msg) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConvoId
          ? { ...c, last_message: { ...msg, is_mine: true }, unread_count: 0 }
          : c
      )
    );
  };

  // ── Filter sidebar by search ───────────────────────────────────────────
  const filteredConvos = conversations.filter(c => {
    if (!searchQuery) return true;
    const q    = searchQuery.toLowerCase();
    const name = (c.other_participant?.full_name ?? c.other_participant?.username ?? '').toLowerCase();
    const farm = [(c.farm?.district ?? ''), (c.farm?.crop ?? '')].join(' ').toLowerCase();
    return name.includes(q) || farm.includes(q);
  });

  const activeConvo = conversations.find(c => c.id === activeConvoId) ?? null;

  return (
    <div className="chat-page">

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <div className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar--open' : ''}`}>
        <div className="chat-sidebar__header">
          <h2 className="chat-sidebar__title">
            Your <em>conversations</em>
          </h2>
          <div className="chat-search">
            <span className="chat-search__icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className="chat-search__input"
              type="text"
              placeholder="Search farmers, farms…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="chat-convo-list">
          {loadingConvos ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div className="loading-dots">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="chat-convo-empty">
              <span className="chat-convo-empty__icon">💬</span>
              <p className="chat-convo-empty__text">
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <>
              {filteredConvos.some(c => (c.unread_count ?? 0) > 0) && (
                <p className="chat-convo-list__label">Unread</p>
              )}
              {filteredConvos
                .filter(c => (c.unread_count ?? 0) > 0)
                .map(c => (
                  <ConvoItem key={c.id} convo={c}
                    active={c.id === activeConvoId}
                    onClick={() => handleSelectConvo(c)} />
                ))}

              {filteredConvos.some(c => (c.unread_count ?? 0) === 0) && (
                <p className="chat-convo-list__label">All messages</p>
              )}
              {filteredConvos
                .filter(c => (c.unread_count ?? 0) === 0)
                .map(c => (
                  <ConvoItem key={c.id} convo={c}
                    active={c.id === activeConvoId}
                    onClick={() => handleSelectConvo(c)} />
                ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="chat-main">
        {activeConvo ? (
          <MessageThread
            key={activeConvo.id}
            conversation={activeConvo}
            currentUserId={currentUserId}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-state__icon">🐝</div>
            <h2 className="chat-empty-state__title">Start a conversation</h2>
            <p className="chat-empty-state__subtitle">
              Select a conversation from the left, or contact a farmer
              directly from their farm listing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}