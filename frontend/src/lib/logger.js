// lib/logger.js
//
// Before this file existed, error handling across the app fell into one of
// two patterns: `console.error(...)` calls with no consistent shape, or —
// far more often — a bare `catch { }` / `catch { /* silently fail */ }`
// with nothing logged at all (see ChatPage.jsx, NotificationPopup.jsx,
// TokenManager.js). Background polling failing silently is sometimes the
// right UX call (you don't want a scary banner every 20s if a notification
// poll misses once), but "the right UX call" and "invisible to anyone
// debugging this" shouldn't be the same decision. This gives every one of
// those call sites a single, cheap line that at least puts the failure
// somewhere a developer will see it, with enough context to know what
// failed and why — and a single place to later wire up real error
// reporting (Sentry, etc.) without touching every call site.

const PREFIX = '[Arici]';

export const logger = {
  error(context, error) {
    console.error(`${PREFIX} ${context}`, error);
  },
  warn(context, error) {
    console.warn(`${PREFIX} ${context}`, error);
  },
  info(context, ...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`${PREFIX} ${context}`, ...args);
    }
  },
};
