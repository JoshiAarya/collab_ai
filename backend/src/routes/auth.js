import express from 'express';
import authService from '../services/authService.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email, and password required' 
      });
    }

    const result = await authService.register(username, email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password required' 
      });
    }

    const result = await authService.login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// Google OAuth (stubbed)
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, username } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Google ID and email required' 
      });
    }

    const result = await authService.googleAuth(googleId, email, username);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token' });
    }

    const decoded = authService.verifyToken(token);
    const user = await authService.getUserById(decoded.userId);

    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

export default router;
