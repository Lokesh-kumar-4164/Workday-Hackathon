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

const router = express.Router();

router.post('/login', loginController);
router.post('/register', registerController);
router.post('/signup', registerController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, meController);

router.get('/oauth/google', googleOAuthStart);
router.get('/oauth/google/callback', googleOAuthCallback);
router.post('/oauth/google', googleOAuthTokenLogin);

export default router;
