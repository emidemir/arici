// lib/notifySocket.js
//
// One persistent WebSocket per logged-in session, connected to
// /ws/notify/ (UserNotifyConsumer on the backend) — independent of
// whichever conversation or page is currently open. This is what makes
// "someone started a new conversation with me" or "someone messaged me
// while I was on /explore/" show up without a manual reload or waiting
// for the next ~20-30s poll.
//
// Before this existed, the ONLY live-update mechanism was ChatConsumer's
// per-conversation rooms — which can only ever notify someone already
// connected to that specific conversation. A brand new conversation has
// no room with a pre-existing listener, by definition, so its first
// message had no live delivery path at all. This is the fix for that gap.
//
// Other parts of the app (the unread-count badges, the conversation list)
// don't import this module directly — they just listen for the
// 'chat:new-message' window event it dispatches, the same pattern this
// codebase already uses for 'auth:logout' in apiFetch.js/TokenManager.js.

import { logger } from './logger';

class NotifySocket {
  constructor() {
    this.ws = null;
    this.token = null;
    this.cancelled = true;
    this.retryCount = 0;
    this.reconnectTimer = null;
  }

  connect(token) {
    if (this.ws && this.token === token) return; // already connected for this session
    this.disconnect(); // tear down any previous connection (e.g. a stale token)
    this.token = token;
    this.cancelled = false;
    this.retryCount = 0;
    this._open();
  }

  disconnect() {
    this.cancelled = true;
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000); // normal closure — must not trigger reconnect below
      this.ws = null;
    }
  }

  _open() {
    if (this.cancelled) return;

    const wsHost   = process.env.REACT_APP_WS_HOST ?? window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${wsHost}/ws/notify/?token=${this.token}`);
    this.ws = ws;

    ws.onopen = () => {
      this.retryCount = 0;
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        logger.error('Could not parse notify socket message', err);
        return;
      }
      if (data.type === 'chat.new_message') {
        window.dispatchEvent(new CustomEvent('chat:new-message', {
          detail: { conversationId: data.conversation_id },
        }));
      }
    };

    ws.onerror = (event) => {
      logger.error('Notify WebSocket error', event);
    };

    ws.onclose = (event) => {
      if (event.code !== 1000) {
        logger.warn(`Notify WebSocket closed (code ${event.code})`);
      }
      // Same bounded-backoff reconnect pattern as ChatPage's WebSocket —
      // this connection is meant to live for the entire session, so it
      // needs to recover from idle timeouts / network blips on its own
      // rather than silently going stale until the next full page reload.
      if (!this.cancelled && event.code !== 1000) {
        const delay = Math.min(1000 * 2 ** this.retryCount, 10_000);
        this.retryCount += 1;
        this.reconnectTimer = setTimeout(() => this._open(), delay);
      }
    };
  }
}

export const notifySocket = new NotifySocket();
