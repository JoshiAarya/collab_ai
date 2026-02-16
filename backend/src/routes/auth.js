import express from 'express';
import authService from '../services/authService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { AuthenticationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Register
router.post('/register', 
  validate('register'),
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const result = await authService.register(username, email, password);
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

// Google OAuth (stubbed)
router.post('/google', asyncHandler(async (req, res) => {
  const { googleId, email, username } = req.body;

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
