import jwt from 'jsonwebtoken';

export const ACCESS_COOKIE = 'access_token';

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not set');
    }
    return secret;
}

export function getTokenTtl(rememberMe = false) {
    return rememberMe ? '30d' : '7d';
}

export function getTokenMaxAgeMs(rememberMe = false) {
    return rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

export function signAccessToken(user, { rememberMe = false } = {}) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            role: user.role,
        },
        getSecret(),
        { expiresIn: getTokenTtl(rememberMe) },
    );
}

export function verifyAccessToken(token) {
    return jwt.verify(token, getSecret());
}

export function signOAuthState(payload) {
    return jwt.sign(payload, getSecret(), { expiresIn: '10m' });
}

export function verifyOAuthState(token) {
    return jwt.verify(token, getSecret());
}

export function setAuthCookie(res, token, { rememberMe = false } = {}) {
    res.cookie(ACCESS_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: getTokenMaxAgeMs(rememberMe),
        path: '/',
    });
}

export function clearAuthCookie(res) {
    res.clearCookie(ACCESS_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

export function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
        authProvider: user.authProvider,
    };
}

export function sendAuthPayload(res, user, { rememberMe = false, status = 200, message = 'Authenticated' } = {}) {
    const token = signAccessToken(user, { rememberMe });
    setAuthCookie(res, token, { rememberMe });
    return res.status(status).json({
        message,
        token,
        user: publicUser(user),
    });
}
