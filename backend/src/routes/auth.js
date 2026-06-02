import express from 'express';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Register
router.post('/register', 
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

  // Redirect to frontend with token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}?token=${result.token}&provider=google`);
}));

// Google OAuth - Direct (for mobile/SPA with Google Sign-In button)
router.post('/google', asyncHandler(async (req, res) => {
  const { idToken, googleId, email, username } = req.body;

  // Support both ID token verification and direct credentials
  if (idToken) {
    // Verify Google ID token
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const userInfo = await response.json();

    if (userInfo.error) {
      throw new ValidationError('Invalid Google ID token');
    }

    const result = await authService.googleAuth(userInfo.sub, userInfo.email, userInfo.name);
    return res.json({ success: true, ...result });
  }

  // Fallback to direct credentials (for testing)
  if (!googleId || !email) {
    throw new ValidationError('Google ID and email required');
  }

  const result = await authService.googleAuth(googleId, email, username);
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
