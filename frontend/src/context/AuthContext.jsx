import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredToken, setStoredToken } from '../api/authStorage';
import {
    consumeAuthRedirect,
    getGoogleOAuthUrl,
    loginApi,
    logoutApi,
    meApi,
    registerApi,
} from '../api/userApi';

const AuthContext = createContext(null);

function applySession(token) {
    if (token) setStoredToken(token);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    const restore = useCallback(async () => {
        const { token: tokenFromUrl, authError: redirectError } = consumeAuthRedirect();
        if (redirectError) setAuthError(redirectError);
        if (tokenFromUrl) applySession(tokenFromUrl);

        try {
            const data = await meApi();
            setUser(data.user);
        } catch {
            clearStoredToken();
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        restore();
    }, [restore]);

    const completeAuth = useCallback((data) => {
        applySession(data.token);
        setUser(data.user);
        setAuthError('');
        return data.user;
    }, []);

    const login = useCallback(async (credentials) => {
        const data = await loginApi(credentials);
        return completeAuth(data);
    }, [completeAuth]);

    const register = useCallback(async (payload) => {
        const data = await registerApi(payload);
        return completeAuth(data);
    }, [completeAuth]);

    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch {
            /* still clear local session */
        }
        clearStoredToken();
        setUser(null);
    }, []);

    const startGoogleAuth = useCallback(({ role = 'USER', rememberMe = false } = {}) => {
        window.location.href = getGoogleOAuthUrl({ role, rememberMe });
    }, []);

    const value = useMemo(
        () => ({
            user,
            loading,
            authError,
            setAuthError,
            isAuthenticated: Boolean(user),
            login,
            register,
            logout,
            startGoogleAuth,
            restore,
        }),
        [user, loading, authError, login, register, logout, startGoogleAuth, restore],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
