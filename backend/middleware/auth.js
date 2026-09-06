import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../config/schemas.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/jwt.js';

function readToken(req) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        return header.slice(7).trim();
    }
    return req.cookies?.[ACCESS_COOKIE] || null;
}

export async function requireAuth(req, res, next) {
    try {
        const token = readToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const payload = verifyAccessToken(token);
        const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, Number(payload.sub)))
            .limit(1);

        if (!user) {
            return res.status(401).json({ message: 'Account no longer exists' });
        }

        req.user = user;
        req.tokenPayload = payload;
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired session' });
    }
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}
