const TOKEN_KEY = 'workday_access_token';

export function getStoredToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setStoredToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearStoredToken() {
    setStoredToken(null);
}
