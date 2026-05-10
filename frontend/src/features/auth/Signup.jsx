import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/auth/AuthPages.css';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [form, setForm] = useState({
    username: '', email: '', password: '', passwordConfirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.passwordConfirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError(null);
    try {
      await signup({
        username: form.username,
        email: form.email,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      });
      navigate('/explore/');
    } catch (err) {
      setError(err.message ?? 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, signup, navigate]);

  const passwordStrength = () => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6) return 'weak';
    if (p.length < 10) return 'medium';
    return 'strong';
  };
  const strength = passwordStrength();

  return (
    <div className="auth-page">
      <div className="auth-panel">

        <div className="auth-panel__deco" aria-hidden="true">
          <span className="auth-panel__deco-emoji">🌻</span>
          <span className="auth-panel__deco-emoji">🍎</span>
          <span className="auth-panel__deco-emoji">🍯</span>
          <span className="auth-panel__deco-emoji">🌿</span>
          <span className="auth-panel__deco-emoji">🫒</span>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <Link to="/" className="auth-card__logo">
              <span className="auth-card__logo-icon">🐝</span>
              <span className="auth-card__logo-text">Agri<span>Hive</span></span>
            </Link>
            <h1 className="auth-card__title">Join AgriHive</h1>
            <p className="auth-card__subtitle">Connect your farmland with beekeepers</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {error && (
              <div className="auth-form__error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="auth-form__row">
              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="auth-form__input"
                  placeholder="your_username"
                  value={form.username}
                  onChange={handleChange}
                />
              </div>
              <div className="auth-form__field">
                <label className="auth-form__label" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="auth-form__input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="auth-form__field">
              <label className="auth-form__label" htmlFor="password">Password</label>
              <div className="auth-form__input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="auth-form__input auth-form__input--icon"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="auth-form__toggle"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {strength && (
                <div className="auth-form__strength">
                  <div className={`auth-form__strength-bar auth-form__strength-bar--${strength}`} />
                  <span className="auth-form__strength-label">{strength}</span>
                </div>
              )}
            </div>

            <div className="auth-form__field">
              <label className="auth-form__label" htmlFor="passwordConfirm">Confirm password</label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className={`auth-form__input ${
                  form.passwordConfirm && form.password !== form.passwordConfirm
                    ? 'auth-form__input--error'
                    : ''
                }`}
                placeholder="••••••••"
                value={form.passwordConfirm}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-form__submit"
              disabled={loading || !form.username || !form.email || !form.password || !form.passwordConfirm}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Creating account…
                </>
              ) : 'Create account'}
            </button>
          </form>

          <p className="auth-card__footer">
            Already have an account?{' '}
            <Link to="/auth/login/" className="auth-card__link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}