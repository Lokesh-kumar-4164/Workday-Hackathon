import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../config/schemas.js';
import {
    sendAuthPayload,
    setAuthCookie,
    signAccessToken,
    signOAuthState,
    verifyOAuthState,
} from '../utils/jwt.js';

function frontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function callbackUrl() {
    return process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/user/oauth/google/callback`;
}

function redirectWithError(res, message) {
    const url = new URL(frontendUrl());
    url.searchParams.set('authError', message);
    return res.redirect(url.toString());
}

function normalizeRole(role) {
    const value = String(role || 'USER').trim().toUpperCase();
    return value === 'ADMIN' ? 'ADMIN' : 'USER';
}

export const googleOAuthStart = async (req, res) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return redirectWithError(res, 'Google sign-in is not configured on the server.');
        }

        const role = normalizeRole(req.query.role);
        const rememberMe = String(req.query.rememberMe) === 'true';
        const state = signOAuthState({ role, rememberMe });

        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: callbackUrl(),
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'select_account',
        });

        return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    } catch (error) {
        console.error('googleOAuthStart:', error);
        return redirectWithError(res, 'Unable to start Google sign-in.');
    }
};

async function exchangeCodeForProfile(code) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: callbackUrl(),
            grant_type: 'authorization_code',
        }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Failed to exchange Google authorization code');
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) {
        throw new Error('Failed to load Google profile');
    }

    return profile;
}

async function upsertGoogleUser(profile) {
    const email = String(profile.email).trim().toLowerCase();
    const googleId = profile.sub;
    const name = profile.name || email.split('@')[0];
    const avatarUrl = profile.picture || null;

    const [byGoogleId] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.googleId, googleId))
        .limit(1);

    if (byGoogleId) {
        const [updated] = await db
            .update(usersTable)
            .set({ name, avatarUrl, authProvider: byGoogleId.password ? 'local' : 'google' })
            .where(eq(usersTable.id, byGoogleId.id))
            .returning();
        return updated;
    }

    const [byEmail] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

    if (byEmail) {
        const [updated] = await db
            .update(usersTable)
            .set({
                googleId,
                avatarUrl: byEmail.avatarUrl || avatarUrl,
                authProvider: byEmail.password ? 'local' : 'google',
            })
            .where(eq(usersTable.id, byEmail.id))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(usersTable)
        .values({
            name,
            email,
            googleId,
            avatarUrl,
            authProvider: 'google',
            role: 'USER',
        })
        .returning();

    return created;
}

export const googleOAuthCallback = async (req, res) => {
    try {
        if (req.query.error) {
            return redirectWithError(res, 'Google sign-in was cancelled.');
        }

        const { code, state } = req.query;
        if (!code || !state) {
            return redirectWithError(res, 'Google sign-in did not complete.');
        }

        let statePayload;
        try {
            statePayload = verifyOAuthState(state);
        } catch {
            return redirectWithError(res, 'Google sign-in expired. Please try again.');
        }

        const profile = await exchangeCodeForProfile(code);
        const user = await upsertGoogleUser(profile);
        const requestedRole = normalizeRole(statePayload.role);

        if (requestedRole === 'ADMIN' && user.role !== 'ADMIN') {
            return redirectWithError(res, 'This Google account is not an admin.');
        }

        const rememberMe = Boolean(statePayload.rememberMe);
        const token = signAccessToken(user, { rememberMe });
        setAuthCookie(res, token, { rememberMe });

        const url = new URL(frontendUrl());
        url.searchParams.set('token', token);
        return res.redirect(url.toString());
    } catch (error) {
        console.error('googleOAuthCallback:', error);
        return redirectWithError(res, error.message || 'Google sign-in failed.');
    }
};

export const googleOAuthTokenLogin = async (req, res) => {
    try {
        const { code, role, rememberMe } = req.body ?? {};
        if (!code) {
            return res.status(400).json({ message: 'Google authorization code is required' });
        }

        const profile = await exchangeCodeForProfile(code);
        const user = await upsertGoogleUser(profile);
        const requestedRole = normalizeRole(role);

        if (requestedRole === 'ADMIN' && user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'This Google account is not an admin.' });
        }

        return sendAuthPayload(res, user, {
            rememberMe: Boolean(rememberMe),
            message: 'Login successful',
        });
    } catch (error) {
        console.error('googleOAuthTokenLogin:', error);
        return res.status(401).json({ message: error.message || 'Google sign-in failed.' });
    }
};
