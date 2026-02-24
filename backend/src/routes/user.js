import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { username, email, bio, theme } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if username is taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
      user.username = username;
    }

    // Check if email is taken by another user
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email already taken' });
      }
      user.email = email;
    }

    if (bio !== undefined) user.bio = bio;
    if (theme) user.theme = theme;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Change password
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has a password (OAuth users don't)
    if (!user.password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot change password for OAuth accounts' 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      });
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user stats
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('projects')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const stats = {
      projectCount: user.projects.length,
      messageCount: user.messageCount,
      joinedAt: user.createdAt,
      lastSeen: user.lastSeen
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
