import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN = config.jwtExpiresIn;

class AuthService {
  // Register new user
  async register(username, email, password) {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        authProvider: 'local',
        isOnline: true
      });

      await user.save();

      // Generate token
      const token = this.generateToken(user);

      return {
        user: this.sanitizeUser(user),
        token
      };
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      
      if (!user || !user.password) {
        throw new Error('Invalid credentials');
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update online status
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      const token = this.generateToken(user);

      return {
        user: this.sanitizeUser(user),
        token
      };
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  }

  // Google OAuth
  async googleAuth(googleId, email, username) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      let user = await User.findOne({ googleId });

      if (!user) {
        // No account linked to this Google ID yet. If one already exists with
        // the same email (e.g. a prior email/password signup), link Google to
        // it instead of creating a duplicate; Google verifies the email, so
        // this is a safe account-linking by address.
        user = await User.findOne({ email: normalizedEmail });
        if (user) {
          user.googleId = googleId;
        } else {
          user = new User({
            username: username || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            googleId,
            authProvider: 'google'
          });
        }
      }

      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      const token = this.generateToken(user);

      return {
        user: this.sanitizeUser(user),
        token
      };
    } catch (error) {
      console.error('Error with Google auth:', error);
      throw error;
    }
  }

  // Verify token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Remove sensitive data
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.googleId;
    return userObj;
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }
}

export default new AuthService();
