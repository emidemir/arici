class TokenManager {
    constructor() {
        this.refreshPromise = null;
        this.access_token = localStorage.getItem('access_token');
        this.refresh_token = localStorage.getItem('refresh_token');
        this.expires_at = Number(localStorage.getItem('expires_at')) || null;
    }

    setToken({ access_token, refresh_token, expires_in }) {
        this.access_token = access_token;
        this.refresh_token = refresh_token;
        this.expires_at = Date.now() + expires_in * 1000 - 30_000;

        localStorage.setItem('access_token', this.access_token);
        localStorage.setItem('refresh_token', this.refresh_token);
        localStorage.setItem('expires_at', this.expires_at);
    }

    clear() {
        this.access_token = null;
        this.refresh_token = null;
        this.expires_at = null;

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('expires_at');
    }

    is_expired() {
        return !this.expires_at || Date.now() >= this.expires_at;
    }

    async get_valid_token() {
        if (!this.is_expired()) return this.access_token;
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = this._refresh().finally(() => {
            this.refreshPromise = null;
        });

        return this.refreshPromise;
    }

    async _refresh() {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: this.refresh_token }),
        });

        if (!response.ok) {
            throw new Error('Session Expired');
        }

        const data = await response.json();
        const tokenPayload = JSON.parse(atob(data.access.split('.')[1]));
        const expiresInSeconds = tokenPayload.exp - Math.floor(Date.now() / 1000);

        this.setToken({
            access_token: data.access,
            refresh_token: data.refresh || this.refresh_token,
            expires_in: expiresInSeconds, // ← was expiresIn, which setToken didn't recognize
        });

        return this.access_token;
    }
}

export const tokenManager = new TokenManager();