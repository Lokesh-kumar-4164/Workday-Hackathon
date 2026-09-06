import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../config/schemas.js';
import { clearAuthCookie, publicUser, sendAuthPayload } from '../utils/jwt.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
}

function normalizeRole(role) {
    if (!role) return null;
    const value = String(role).trim().toUpperCase();
    if (value === 'ADMIN') return 'ADMIN';
    if (value === 'USER') return 'USER';
    return null;
}

export const registerController = async (req, res) => {
    try {
        const { email, password, name, role, rememberMe } = req.body ?? {};

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address' });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const normalizedEmail = normalizeEmail(email);
        const existing = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.email, normalizedEmail))
            .limit(1);

        if (existing.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const displayName =
            typeof name === 'string' && name.trim()
                ? name.trim()
                : normalizedEmail.split('@')[0];

        const [user] = await db
            .insert(usersTable)
            .values({
                name: displayName,
                email: normalizedEmail,
                password: hashedPassword,
                authProvider: 'local',
                role: normalizeRole(role) ?? 'USER',
            })
            .returning();

        return sendAuthPayload(res, user, {
            rememberMe: Boolean(rememberMe),
            status: 201,
            message: 'Registration successful',
        });
    } catch (error) {
        console.error('registerController:', error);
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

export const loginController = async (req, res) => {
    try {
        const { email, password, role, rememberMe } = req.body ?? {};

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, normalizedEmail))
            .limit(1);

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.password) {
            return res.status(400).json({
                message: 'This account uses Google sign-in. Continue with Google instead.',
            });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const requestedRole = normalizeRole(role);
        if (requestedRole && user.role !== requestedRole) {
            return res.status(403).json({
                message: `This account cannot sign in as ${requestedRole.toLowerCase()}`,
            });
        }

        return sendAuthPayload(res, user, {
            rememberMe: Boolean(rememberMe),
            message: 'Login successful',
        });
    } catch (error) {
        console.error('loginController:', error);
        return res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};

export const meController = async (req, res) => {
    return res.status(200).json({ user: publicUser(req.user) });
};

export const logoutController = async (_req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ message: 'Logged out' });
};
