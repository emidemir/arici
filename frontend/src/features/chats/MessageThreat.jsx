function MessageThread({ conversation, currentUserId, onMessageSent }) {
    const [text, setText]         = useState('');
    const [sending, setSending]   = useState(false);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [wsReady, setWsReady]   = useState(false);
  
    const bottomRef   = useRef(null);
    const textareaRef = useRef(null);
    const wsRef       = useRef(null);          // stable ref to the WebSocket
    const pendingRef  = useRef({});            // tempId → resolve, keyed optimistic sends
  
    const other     = conversation.other_participant;
    const otherName = other?.full_name ?? other?.username ?? 'Unknown';
    const farm      = conversation.farm;
    
    
    const currentUserIdRef = useRef(currentUserId);
    useEffect(() => {
      currentUserIdRef.current = currentUserId;
    }, [currentUserId]);
    // ── 1. Load message history via REST ──────────────────────────────────────
    useEffect(() => {
      let cancelled = false;
      async function load() {
        setLoading(true);
        try {
          const res = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/chats/conversations/${conversation.id}/messages/`
          );
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          if (!cancelled) setMessages(data.results ?? data);
        } catch { /* silently fail — WS will still work */ }
        finally  { if (!cancelled) setLoading(false); }
      }
      load();
      return () => { cancelled = true; };
    }, [conversation.id]);
  
    // ── 2. Open WebSocket for this conversation ────────────────────────────────
    useEffect(() => {
      const wsHost = process.env.REACT_APP_WS_HOST
        ?? window.location.host;           // fallback: same host, different protocol
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${wsHost}/ws/chat/${conversation.id}/`);
  
      wsRef.current = ws;
  
      ws.onopen = () => {
        setWsReady(true);
        // Tell the server we've seen everything — marks messages read
        ws.send(JSON.stringify({ type: 'chat.read' }));
      };
  
      ws.onclose = () => setWsReady(false);
  
      ws.onerror = () => setWsReady(false);
  
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
      
        if (data.type === 'chat.message') {
          // ADD THIS:
          console.log('WS message received:', {
            sender_id: data.sender_id,
            sender_id_type: typeof data.sender_id,
            currentUserId: currentUserIdRef.current,
            currentUserId_type: typeof currentUserIdRef.current,
            isMine: String(data.sender_id) === String(currentUserIdRef.current),
            temp_id: data.temp_id,
          });
      
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
          if (String(data.reader_id) !== String(currentUserIdRef.current)) { // ← ref
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
  
      return () => {
        ws.close();
        wsRef.current  = null;
        pendingRef.current = {};
        setWsReady(false);
      };
    }, [conversation.id, currentUserId]);  // reconnect if conversation changes
  
    // ── 3. Scroll to bottom when messages change ───────────────────────────────
    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
  
    // ── 4. Auto-grow textarea ──────────────────────────────────────────────────
    const handleTextChange = (e) => {
      setText(e.target.value);
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
      }
    };
  
    // ── 5. Send via WebSocket ──────────────────────────────────────────────────
    const handleSend = () => {
      const body = text.trim();
      if (!body || sending || !wsReady) return;
  
      const tempId = `temp-${Date.now()}`;
  
      // Optimistic bubble appears instantly
      const optimistic = {
        id:          tempId,
        body,
        sender_id:   currentUserId,
        sender_name: 'You',
        is_mine:     true,
        created_at:  new Date().toISOString(),
        is_read:     false,
        status:      'sending',
      };
  
      setMessages(prev => [...prev, optimistic]);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setSending(true);
  
      // Send over the socket — no HTTP at all
      wsRef.current.send(JSON.stringify({
        type:    'chat.message',
        body,
        temp_id: tempId,   // echoed back so we can match the optimistic bubble
      }));
    };
  
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };
  
    // ── 6. Retry a failed message ──────────────────────────────────────────────
    const handleRetry = (failedMsg) => {
      // Remove the failed bubble and resend
      setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
      setText(failedMsg.body);
      textareaRef.current?.focus();
    };
  
    const grouped = groupMessages(messages);
  
    // ... rest of the JSX stays exactly the same as before,
    // except add the retry button on failed bubbles and the wsReady indicator:
    console.log('currentUserId:', currentUserId, typeof currentUserId, 'sender_id:', /* you'll see it in onmessage */);
    return (
      <>
        {/* Header */}
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
  
        {/* Messages */}
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
                <Link to={`/farms/${farm.id}`} className="chat-farm-context">
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
                              isMine ? 'chat-bubble--mine' : 'chat-bubble--theirs',
                              isFirst ? 'chat-bubble--first' : '',
                              isLast  ? 'chat-bubble--last'  : '',
                              msg.status === 'sending' ? 'chat-bubble--sending' : '',
                            ].join(' ')}
                          >
                            {msg.body}
  
                            {/* Inline status for failed sends */}
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
                                <span className={`chat-bubble__status ${msg.is_read
                                  ? 'chat-bubble__status--read'
                                  : 'chat-bubble__status--sent'}`}
                                >
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
  
        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder={
                wsReady
                  ? `Message ${otherName}…`
                  : 'Connecting…'
              }
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