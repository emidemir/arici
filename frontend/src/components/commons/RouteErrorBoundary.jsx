import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { logger } from '../../lib/logger';

// Used as `errorElement` on the router (see index.js). react-router's data
// router already isolates render errors thrown by a route's element to the
// nearest ancestor errorElement — but with none defined anywhere, an error
// thrown while rendering any routed page (the empty Dashboard.jsx being the
// concrete example this app had) bubbled all the way up with nothing to
// catch it.
export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const isResponse = isRouteErrorResponse(error);

  useEffect(() => {
    logger.error('Route error', error);
  }, [error]);

  const message = isResponse
    ? `${error.status} ${error.statusText}`
    : 'This page ran into a problem loading.';

  return (
    <div className="loading-screen" role="alert">
      <span style={{ fontSize: '2rem', fontStyle: 'normal' }}>⚠️</span>
      <span style={{ fontStyle: 'normal' }}>{message}</span>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Go back
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/explore/')}>
          Back to Explore
        </button>
      </div>
    </div>
  );
}
