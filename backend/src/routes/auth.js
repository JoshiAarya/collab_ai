import express from 'express';
import rateLimit from 'express-rate-limit';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Brute-force protection for credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' }
});

// Register
router.post('/register',
  authLimiter,
  validate('register'),
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const result = await authService.register(username, email, password);
    
    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail({ to: email, username }).catch(err => {
      logger.error('Failed to send welcome email', { email, error: err.message });
    });
    
    res.json({ success: true, ...result });
  })
);

// Login
router.post('/login',
  authLimiter,
  validate('login'),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, ...result });
  })
);

// Google OAuth - Initiate
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback';
  
  if (!clientId) {
    return res.status(500).json({ 
      success: false, 
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID in environment variables.' 
    });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=openid%20email%20profile&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(googleAuthUrl);
});

// Google OAuth - Callback
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback';

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  if (!tokens.access_token) {
    throw new Error('Failed to get access token');
  }

  // Get user info
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  const userInfo = await userInfoResponse.json();

  // Authenticate or create user
  const result = await authService.googleAuth(userInfo.id, userInfo.email, userInfo.name);

  // Redirect to frontend with token in the URL fragment — fragments are not
  // sent to servers, so the token stays out of access logs and referrers.
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}#token=${encodeURIComponent(result.token)}&provider=google`);
}));

// Google OAuth - Direct (for mobile/SPA with Google Sign-In button)
// Only a verified Google ID token is accepted — unverified credentials
// would allow anyone to mint a session as an arbitrary OAuth user.
router.post('/google', authLimiter, asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new ValidationError('Google ID token required');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  const userInfo = await response.json();

  if (userInfo.error || !userInfo.sub) {
    throw new ValidationError('Invalid Google ID token');
  }

  // Token must have been issued for this app
  if (process.env.GOOGLE_CLIENT_ID && userInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new ValidationError('Invalid Google ID token');
  }

  const result = await authService.googleAuth(userInfo.sub, userInfo.email, userInfo.name);
  res.json({ success: true, ...result });
}));

// Verify token
router.get('/verify', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  const decoded = authService.verifyToken(token);
  const user = await authService.getUserById(decoded.userId);

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  res.json({ success: true, user });
}));

export default router;
