import express from 'express';

import {
    loginController,
    logoutController,
    meController,
    registerController,
} from '../controllers/userControllers.js';

import {
    googleOAuthCallback,
    googleOAuthStart,
    googleOAuthTokenLogin,
} from '../controllers/oauthControllers.js';

import { requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Rate limited
router.post('/login', rateLimiter, loginController);

router.post('/register', rateLimiter, registerController);

router.post('/signup', rateLimiter, registerController);

// Other routes
router.post('/logout', logoutController);

router.get('/me', requireAuth, meController);

router.get('/oauth/google', googleOAuthStart);

router.get('/oauth/google/callback', googleOAuthCallback);

router.post('/oauth/google', googleOAuthTokenLogin);

export default router;