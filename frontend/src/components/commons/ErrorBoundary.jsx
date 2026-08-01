import React from 'react';
import { logger } from '../../lib/logger';

// There was no error boundary anywhere in this app before. React unmounts
// the entire tree on an uncaught render error by default, so any crash —
// a bad import, a null dereference, a component whose file was accidentally
// left empty (this genuinely happened: see features/profile/Dashboard.jsx,
// which rendered `undefined` as a component and crashed the whole app for
// anyone visiting /profile/) — showed the user a blank white page with
// nothing on it, and the only trace was a React error printed to the
// browser console that most people never open.
//
// This won't catch everything (errors in event handlers, async code, or
// outside React's render — see the AuthProvider / localStorage guard in
// AuthContext.jsx for that case — still need their own handling), but it
// catches render-time crashes anywhere below it in the tree, which is the
// single biggest gap this app had.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.error(`Unhandled render error${this.props.label ? ` (${this.props.label})` : ''}`, error);
    if (process.env.NODE_ENV !== 'production') {
      console.error(info?.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen" role="alert">
          <span style={{ fontSize: '2rem', fontStyle: 'normal' }}>⚠️</span>
          <span style={{ fontStyle: 'normal' }}>Something went wrong loading this page.</span>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
