ation...`);
      try {
        const summaryContent = await aiService.generateSummary(
          project._id,
          disc._id,
          llmConfig,
          `Summarize the key architectural and technical decisions in this ${threadName} thread.`
        );

        const savedSummary = await summaryService.createSummary(
          project._id,
          disc._id,
          summaryContent,
          'discussion',
          llmConfig.provider,
          await Message.countDocuments({ discussionId: disc._id })
        );

      } catch (err) {
        log(`Failed to summarize ${threadName}: ${err.message}`);
      }
    }
  }

  log('\nDone. Open the dashboard to see results.');
  log(`Project ID: ${project._id}`);
  log(`Full log saved to: ${LOG_FILE}`);
  logStream.end();
  setTimeout(() => process.exit(0), 100);
}


=== backend\src\scripts\simulations\healthsync-data.js ===

export const usersToCreate = ['dr_smith', 'alice', 'bob', 'charlie'];

export const threadSummaries = {
  'Frontend': 'Focuses on the React-based user interface, UI/UX design components, client-side LiveKit video integration, and the overall patient/doctor dashboard experience.',
  'Backend': 'Focuses on the Node.js API server, Postgres database schema modeling, JWT authentication, RBAC, WebSockets integration, and background worker queues.',
  'Infrastructure': 'Handles cloud deployment, VPC setup, database encryption, LiveKit self-hosting, Redis streams, system metrics, and HIPAA compliance enforcement.',
  'Testing': 'Dedicated to QA tracking, Cypress end-to-end testing, security vulnerability scanning, load testing, and resolving platform bugs.'
};

export const stage1_ideation = [
  { thread: 'Main', user: 'dr_smith', text: 'Hey team, let\'s kick off the HealthSync project today. The goal is to build a modern telemedicine platform where patients can book appointments and have secure video consultations with doctors.' },
  { thread: 'Main', user: 'alice', text: 'Sounds like a great initiative. What are the key user roles we need to support for MVP?' },
  { thread: 'Main', user: 'dr_smith', text: 'Just two to start: Doctors and Patients. And eventually an Admin role, but let\'s keep it out of scope for v1.' },
  { thread: 'Main', user: 'bob', text: 'For the patient side, do they need to upload medical documents before the call?' },
  { thread: 'Main', user: 'dr_smith', text: 'Yes, a simple file upload feature during the booking process would be ideal so doctors can review the history.' },
  { thread: 'Main', user: 'charlie', text: 'Since we are dealing with medical records and patient data, HIPAA compliance is absolutely critical. We need strict data encryption at rest and in transit.' },
  { thread: 'Main', user: 'alice', text: 'Agreed. That means we cannot use just any public cloud SaaS without a BAA. We should probably self-host as much as possible.' },
  { thread: 'Main', user: 'dr_smith', text: 'What about the video conferencing piece? Building WebRTC from scratch sounds like a massive headache.' },
  { thread: 'Main', user: 'bob', text: 'We definitely shouldn\'t build it from scratch. There are open-source WebRTC frameworks we could use.' },
  { thread: 'Main', user: 'alice', text: 'I\'ll look into the backend options for WebRTC signaling. Maybe something we can run on our own instances.' },
  { thread: 'Main', user: 'dr_smith', text: 'We also need a clean dashboard for doctors to see their upcoming appointments for the week, and a simple calendar booking node for patients.' },
  { thread: 'Main', user: 'bob', text: 'I can leverage some existing React calendar libraries for that. We\'ll need to ensure timezones are handled correctly though.' },
  { thread: 'Main', user: 'alice', text: 'Timezones are always tricky. Let\'s make sure we store all datetime fields in UTC in the database, and only convert to local time on the frontend.' },
  { thread: 'Main', user: 'bob', text: 'Good call. I\'ll enforce UTC-only payload structures from the React client to the Node API.' },
  { thread: 'Main', user: 'charlie', text: 'Before we go too deep, how are we handling user authenticated sessions? Since it\'s web-first.' },
  { thread: 'Main', user: 'alice', text: 'Let\'s hash that out in the Backend thread. I have some strong opinions on stateless auth.' },
  { thread: 'Main', user: 'dr_smith', text: 'Perfect. I will create specific discussion threads for Frontend, Backend, Infrastructure, and Testing where we can distribute the detailed technical work.' },
  { thread: 'Main', user: 'dr_smith', text: 'Let\'s map out the architecture documents today and start sprinting tomorrow.' },
  { thread: 'Main', user: 'bob', text: 'I\'ll gather some UI inspiration for the dashboard and post it in the Frontend thread.' },
  { thread: 'Main', user: 'charlie', text: 'And I\'ll start writing up the AWS infrastructure requirements.' }
];

export const stage2_planning = [
  { thread: 'Backend', user: 'alice', text: 'Let us finalize the backend architecture. For the web server, I propose using Node.js with Express.' },
  { thread: 'Backend', user: 'charlie', text: 'Express is fine, but maybe Fastify for better performance?' },
  { thread: 'Backend', user: 'alice', text: 'Express has a larger ecosystem and more middleware for things like rate limiting and security headers which we need right away. Let\'s stick with Express.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Fair enough. For the database, since patient records will have complex documents, should we use MongoDB?' },
  { thread: 'Backend', user: 'alice', text: 'Given the strict financial and medical transaction nature, we need strong ACID compliance. I strongly suggest we use Postgres instead. We can use JSONB columns if we need document flexibility.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Okay, Postgres it is. I will provision a managed Postgres instance with automated daily backups.' },
  { thread: 'Backend', user: 'alice', text: 'For authentication, we should use JWTs but with short expirations and httpOnly secure cookies to mitigate XSS.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Yes, and we need role-based access control (RBAC). A patient absolutely cannot access another patient\'s records.' },
  { thread: 'Frontend', user: 'bob', text: 'Over on the frontend, I\'m setting up the React boilerplate. We will use Vite instead of Create React App for faster builds.', isDecision: true },
  { thread: 'Frontend', user: 'dr_smith', text: 'Sounds good. What about styling? Should we use Tailwind CSS or styled-components?' },
  { thread: 'Frontend', user: 'bob', text: 'Let\'s adopt Tailwind CSS. It will speed up our UI development significantly, especially for the complex dashboard layouts.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'For state management, we should use Zustand. It\'s lighter than Redux and perfect for our needs.', isDecision: true },
  { thread: 'Infrastructure', user: 'charlie', text: 'Looking into the video call infrastructure. LiveKit seems to be the best open-source WebRTC option.' },
  { thread: 'Infrastructure', user: 'alice', text: 'Can we self-host LiveKit to maintain HIPAA compliance?' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Yes, we can deploy the LiveKit server on our own EC2 instances within a private VPC. I\'ve read through their deployment docs.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'LiveKit has an amazing React SDK. I\'ll use that to build the video room components.' },
  { thread: 'Backend', user: 'alice', text: 'We also need a background worker system to send email reminders 24 hours before an appointment.' },
  { thread: 'Backend', user: 'charlie', text: 'I\'ll set up Redis. We can use BullMQ to manage the job queues reliably.', isDecision: true },
  { thread: 'Backend', user: 'alice', text: 'Perfect. Keep the Redis instance inside the VPC so it\'s isolated from the public internet.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I am creating the Terraform scripts now to codify the Postgres, Redis, and EC2 deployments.' },
  { thread: 'Frontend', user: 'bob', text: 'I\'ve created the initial Figma wireframes for the patient booking flow. It\'s a clean 3-step wizard.' },
  { thread: 'Backend', user: 'alice', text: 'Make sure step 2 of the wizard allows them to upload PDFs. I\'ll build the S3 bucket pre-signed URL endpoint for direct uploads.' }
];

export const stage3_development = [
  { thread: 'Backend', user: 'alice', text: 'I\'ve pushed the initial Postgres schema. The Users, Appointments, and MedicalRecords tables are live.' },
  { thread: 'Backend', user: 'charlie', text: 'I\'m reviewing the RBAC middleware PR now. Looks solid, but make sure to add generic error messages so we don\'t leak route info on 403s.' },
  { thread: 'Backend', user: 'alice', text: 'Good catch, fixing the error responses now.' },
  { thread: 'Frontend', user: 'bob', text: 'The doctor dashboard layout is complete. I\'ve built the calendar view using react-big-calendar.' },
  { thread: 'Frontend', user: 'dr_smith', text: 'The calendar looks great! But how do we handle the transition when a doctor actually enters the video room?' },
  { thread: 'Backend', user: 'alice', text: 'I\'m working on the LiveKit integration right now. When the doctor clicks "Join", they will hit an endpoint that generates a secure LiveKit access token.' },
  { thread: 'Frontend', user: 'bob', text: 'Okay, once I get that token, I can initialize the LiveKit `LiveKitRoom` component. But how does the doctor know the patient is waiting?' },
  { thread: 'Backend', user: 'alice', text: 'We should use WebSockets. When the patient connects, our backend will emit a `participant_joined` event down to the doctor\'s client.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'I\'ll integrate Socket.io on the frontend to listen for those room status events.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'The LiveKit server is fully deployed in the staging VPC. Alice, I DM\'d you the API keys and secret.' },
  { thread: 'Backend', user: 'alice', text: 'Thanks! I\'ve configured the environment variables and the token generation is working.' },
  { thread: 'Frontend', user: 'dr_smith', text: 'Make sure the doctor can also share their screen if they need to show lab results during the call.' },
  { thread: 'Frontend', user: 'bob', text: 'Will do. I am adding the `ScreenShare` component from the LiveKit SDK right now.' },
  { thread: 'Backend', user: 'charlie', text: 'Alice, I noticed some performance issues locally. We have an N+1 query problem in the appointment fetching endpoint.' },
  { thread: 'Backend', user: 'charlie', text: 'It\'s doing a separate query for every single patient profile attached to the appointments.' },
  { thread: 'Backend', user: 'alice', text: 'Ah, my bad. I will add an INNER JOIN to fetch the patient details alongside the appointment to optimize that lookup.' },
  { thread: 'Frontend', user: 'bob', text: 'Just pushed the video UI. It handles camera/mic muting seamlessly. I\'m moving on to building the post-call prescription form.' },
  { thread: 'Backend', user: 'alice', text: 'The BullMQ worker for email reminders is implemented. It scans for appointments starting in < 24 hours.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I\'ve verified the worker is running. I had to increase the Redis maxmemory-policy to allkeys-lru to prevent OOM errors.' },
  { thread: 'Frontend', user: 'bob', text: 'I am integrating the prescription form with the backend endpoint. Currently hitting a CORS error though on the staging environment.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Let me update the allowed origins in the Nginx reverse proxy. It should only accept requests from our specific frontend domain.' },
  { thread: 'Frontend', user: 'bob', text: 'CORS issue resolved. The prescription form is successfully submitting now.' }
];

export const stage4_testing = [
  { thread: 'Testing', user: 'charlie', text: 'I ran automated security scans on our staging environment using OWASP ZAP.' },
  { thread: 'Testing', user: 'charlie', text: 'We have a critical vulnerability in our JWT validation—we weren\'t strictly verifying the issuer claim.' },
  { thread: 'Backend', user: 'alice', text: 'Wow, scary. I will implement a strict issuer verification check in the auth middleware immediately.' },
  { thread: 'Testing', user: 'dr_smith', text: 'I did a manual walkthrough of the patient booking flow. It was very smooth. However, during the video test, I heard a terrible audio echo.' },
  { thread: 'Frontend', user: 'bob', text: 'Ah, I think I missed a configuration in the WebRTC setup. I need to explicitly enable echo cancellation in the LiveKit room options.' },
  { thread: 'Frontend', user: 'bob', text: 'I\'m pushing a hotfix now to set `echoCancellation: true`.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Retesting the video room... The echo is completely gone. Great job Bob.' },
  { thread: 'Testing', user: 'alice', text: 'I just finished running the K6 load tests against the staging backend.' },
  { thread: 'Testing', user: 'alice', text: 'Our database handles 500 concurrent bookings without breaking a sweat, but the email worker queue was logging an enormous lag.' },
  { thread: 'Testing', user: 'alice', text: 'It took almost 20 minutes for some reminder emails to actually dispatch under load.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'That\'s unacceptable for our SLAs. I will bump the background worker instances from 1 to 3.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I also think we should switch from standard Redis Lists to Redis Streams for better queue management and consumer group scaling.', isDecision: true },
  { thread: 'Backend', user: 'alice', text: 'Sounds like a plan. I\'ll update the BullMQ configuration to leverage the new Redis parameters.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Is the file upload feature verified? Patients uploading previous medical PDFs?' },
  { thread: 'Testing', user: 'bob', text: 'Yes, I wrote Cypress end-to-end tests that mock the file upload. They are passing.' },
  { thread: 'Backend', user: 'alice', text: 'And I\'ve verified the S3 bucket policies restrict public access. The pre-signed URLs expire after 15 minutes.' },
  { thread: 'Testing', user: 'charlie', text: 'I re-ran the load test with 3 worker instances. The email queue lag is down to under 2 seconds at peak load. We are golden.' },
  { thread: 'Testing', user: 'bob', text: 'All frontend unit tests are passing in the CI pipeline. Code coverage is at 85%.' },
  { thread: 'Testing', user: 'dr_smith', text: 'The screen sharing for lab results works flawlessly. We\'ve addressed all critical bugs. Are we ready for launch?' },
  { thread: 'Testing', user: 'alice', text: 'All end-to-end Cypress tests are passing green. I\'m confident in the backend stability.' },
  { thread: 'Testing', user: 'charlie', text: 'Infrastructure is fully provisioned and locked down. We are good to go.' }
];

export const stage5_deployment = [
  { thread: 'Infrastructure', user: 'charlie', text: 'Initiating the production deployment sequence now. Locking the main branch.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'The Postgres database migrations are running on the production cluster.' },
  { thread: 'Backend', user: 'alice', text: 'Migrations completed successfully. Node instances are spinning up and passing health checks.' },
  { thread: 'Frontend', user: 'bob', text: 'The React frontend bundle is building. It is actively deploying to out global CDN.' },
  { thread: 'Frontend', user: 'bob', text: 'Frontend is live! I\'m monitoring the error logs on Sentry to catch any client-side crashes early.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'LiveKit cluster is up. Routing rules are established. DNS propagation looks complete.' },
  { thread: 'Backend', user: 'dr_smith', text: 'Fantastic. I\'m doing a quick smoke test as a patient on production.' },
  { thread: 'Backend', user: 'dr_smith', text: 'First real test patient successfully booked a slot with me. The transactional email reminder arrived instantly.' },
  { thread: 'Infrastructure', user: 'alice', text: 'Production metrics look completely stable. I am not seeing any memory leaks detected in the LiveKit server after the smoke test.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Let\'s keep a close eye on the database CPU usage for the first 48 hours. I\'ve set up aggressive Datadog alerts just in case.' },
  { thread: 'Backend', user: 'alice', text: 'I will monitor the BullMQ dashboard to make sure no background jobs get stuck in the failed state.' },
  { thread: 'Frontend', user: 'bob', text: 'Sentry is completely quiet. Zero unhandled promise rejections so far.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Incredible work team. HealthSync v1 is officially live and working perfectly under real-world conditions.' },
  { thread: 'Main', user: 'dr_smith', text: 'I wanted to thank everyone for their hard work over the last few weeks. We built a rock-solid product.' },
  { thread: 'Main', user: 'alice', text: 'It was a great team effort. The infrastructure decisions really paid off.' },
  { thread: 'Main', user: 'bob', text: 'Agreed. Time to celebrate! Let\'s do a formal retro tomorrow to plan v1.1.' }
];

export const allConversations = [
  ...stage1_ideation,
  ...stage2_planning,
  ...stage3_development,
  ...stage4_testing,
  ...stage5_deployment
];


=== backend\src\server.js ===

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/index.js";
import logger from "./utils/logger.js";
import connectDB from "./config/database.js";
import connectionManager from "./services/connectionManager.js";
import embeddingWorker from "./services/EmbeddingWorker.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { sanitize } from "./middleware/validation.js";
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger.js'

// Routes
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import userRoutes from './routes/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
await connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(sanitize);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(req.method, req.path, res.statusCode, duration, {
      userId: req.user?.userId,
      ip: req.ip
    });
  });
  
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const wsStats = connectionManager.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      services: {
        database: dbStatus,
        websocket: {
          status: 'active',
          connections: wsStats.totalConnections,
          authenticated: wsStats.authenticated
        },
        embeddingWorker: embeddingWorker.getStats()
      },
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// System info endpoint (development only)
if (config.isDevelopment) {
  app.get('/api/system/info', (req, res) => {
    res.json({
      config: config.toObject(),
      websocket: connectionManager.getStats(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  });
}

// Serve frontend static files in production
if (config.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.use((req, res, next) => {
    // Skip API routes and health check
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// HTTP Server
const server = app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`, {
    environment: config.nodeEnv,
    port: config.port
  });
});

// Initialize WebSocket server
connectionManager.initialize(server);

// Start background embedding worker (retry/backfill)
embeddingWorker.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    connectionManager.shutdown();
    embeddingWorker.stop();
    process.exit(0);
  });
});

logger.info('CollabAI Server ready', {
  version: '1.0.0',
  environment: config.nodeEnv
});



=== backend\src\services\aiService.js ===

/**
 * AI Service - PHASE 1 Refactor
 * Thin wrapper that delegates all AI operations to AIOrchestrator
 * This maintains backward compatibility while centralizing AI logic
 */

import AIOrchestrator from '../core/orchestrator/AIOrchestrator.js';
import logger from '../utils/logger.js';

class AIService {
  /**
   * Generate AI response (delegates to orchestrator)
   */
  async generateResponse(projectId, discussionId, prompt, llmConfig, userId = null) {
    logger.info('aiService.generateResponse called - delegating to orchestrator');
    
    return await AIOrchestrator.handleRequest({
      projectId,
      discussionId,
      prompt,
      llmConfig,
      userId
    });
  }

  /**
   * Generate summary (delegates to orchestrator)
   */
  async generateSummary(projectId, discussionId, llmConfig, customPrompt = null) {
    logger.info('aiService.generateSummary called - delegating to orchestrator');
    
    return await AIOrchestrator.handleSummaryRequest({
      projectId,
      discussionId,
      llmConfig,
      customPrompt
    });
  }

  /**
   * Regenerate summary with custom prompt (delegates to orchestrator)
   */
  async regenerateSummary(projectId, discussionId, existingSummary, customPrompt, llmConfig) {
    logger.info('aiService.regenerateSummary called - delegating to orchestrator');
    
    return await AIOrchestrator.handleSummaryRefinement({
      projectId,
      discussionId,
      existingSummary,
      customPrompt,
      llmConfig
    });
  }
}

export default new AIService();


=== backend\src\services\authService.js ===

import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

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

  // Google OAuth (stubbed for MVP)
  async googleAuth(googleId, email, username) {
    try {
      let user = await User.findOne({ googleId });

      if (!user) {
        user = new User({
          username: username || email.split('@')[0],
          email: email.toLowerCase().trim(),
          googleId,
          authProvider: 'google',
          isOnline: true
        });
        await user.save();
      } else {
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();
      }

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


=== backend\src\services\connectionManager.js ===

/**
 * WebSocket Connection Manager
 * Handles WebSocket lifecycle, authentication, and message routing
 */

import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import authService from './authService.js';
import projectService from './projectService.js';
import discussionService from './discussionService.js';
import aiService from './aiService.js';


class ConnectionManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> metadata
    this.heartbeatInterval = null;
    this.messageRateLimits = new Map(); // clientId -> { count, resetTime }
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat mechanism
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    
    // Initialize client metadata
    this.clients.set(ws, {
      id: clientId,
      userId: null,
      username: null,
      projectId: null,
      discussionId: null,
      isAlive: true,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });

    logger.ws('Client connected', { clientId, ip: req.socket.remoteAddress });

    // Setup pong handler for heartbeat
    ws.on('pong', () => {
      const meta = this.clients.get(ws);
      if (meta) {
        meta.isAlive = true;
        meta.lastActivity = Date.now();
      }
    });

    // Handle messages
    ws.on('message', async (msg) => {
      await this.handleMessage(ws, msg);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ws, msg) {
    const meta = this.clients.get(ws);
    if (!meta) return;

    try {
      const data = JSON.parse(msg);
      
      // Update activity timestamp
      meta.lastActivity = Date.now();

      // Rate limiting
      if (!this.checkRateLimit(meta.id)) {
        this.sendError(ws, 'Rate limit exceeded. Please slow down.');
        return;
      }

      // Route message based on type
      switch (data.type) {
        case 'auth':
          await this.handleAuth(ws, data);
          break;

        case 'join-project':
          await this.handleJoinProject(ws, data);
          break;

        case 'project-chat':
          await this.handleProjectChat(ws, data);
          break;

        case 'ping':
          this.send(ws, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          logger.warn('Unknown message type', { type: data.type, clientId: meta.id });
      }

    } catch (error) {
      logger.error('Error handling message', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to process message');
    }
  }

  /**
   * Handle authentication
   */
  async handleAuth(ws, data) {
    const meta = this.clients.get(ws);
    
    try {
      const decoded = authService.verifyToken(data.token);
      meta.userId = decoded.userId;
      meta.username = decoded.username;
      
      this.send(ws, { 
        type: 'auth-success', 
        user: { 
          userId: decoded.userId, 
          username: decoded.username 
        }
      });

      logger.ws('Client authenticated', { 
        clientId: meta.id, 
        userId: meta.userId 
      });

    } catch (error) {
      this.sendError(ws, 'Invalid token', 'auth-error');
      logger.warn('Authentication failed', { clientId: meta.id });
    }
  }

  /**
   * Handle join project
   */
  async handleJoinProject(ws, data) {
    const meta = this.clients.get(ws);
    const { projectId, discussionId } = data;

    try {
      // Verify membership
      if (meta.userId) {
        const isMember = await projectService.isProjectMember(projectId, meta.userId);
        if (!isMember) {
          this.sendError(ws, 'Not a project member');
          return;
        }
      }

      // Update metadata
      meta.projectId = projectId;
      meta.discussionId = discussionId;

      // Load and send discussion messages
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);
      const formattedMessages = messages.map(m => ({
        _id: m._id,
        user: m.user,
        text: m.text,
        time: m.timestamp,
        isAI: m.isAI
      }));

      this.send(ws, { 
        type: 'discussion-joined', 
        messages: formattedMessages,
        discussionId
      });

      logger.ws('Client joined discussion', { 
        clientId: meta.id, 
        projectId, 
        discussionId 
      });

    } catch (error) {
      logger.error('Error joining project', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to join discussion');
    }
  }

  /**
   * Handle project chat message
   */
  async handleProjectChat(ws, data) {
    const meta = this.clients.get(ws);
    const { text } = data;
    const { projectId, discussionId, userId, username } = meta;

    if (!projectId || !discussionId) {
      this.sendError(ws, 'Not in a project discussion');
      return;
    }

    try {
      // Save message
      const message = await discussionService.addMessage(
        discussionId,
        projectId,
        userId,
        username,
        text,
        false
      );

      // Broadcast to discussion
      this.broadcastToDiscussion(discussionId, {
        type: 'project-chat',
        message: {
          _id: message._id,
          user: message.user,
          text: message.text,
          time: message.timestamp,
          isAI: false
        }
      });

      logger.ws('Message sent', { 
        clientId: meta.id, 
        discussionId, 
        messageLength: text.length 
      });

      // Semantic search indexing — non-blocking. Worker will backfill failures.
      this._embedMessage(message, projectId, discussionId).catch(err => {
        logger.warn('Message embedding failed (worker will retry)', {
          messageId: message._id, error: err.message
        });
      });

      // Check for AI invocation
      if (text.startsWith('@CollabAI')) {
        const meta = this.clients.get(ws);
        await this.handleAIInvocation(ws, text, projectId, discussionId, meta?.userId);
      }

    } catch (error) {
      logger.error('Error handling chat message', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to send message');
    }
  }

  /**
   * Handle AI invocation
   */
  async handleAIInvocation(ws, text, projectId, discussionId, userId = null) {
    const prompt = text.replace('@CollabAI', '').trim();
    
    try {
      const project = await projectService.getProjectById(projectId);
      const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
      
      // Notify clients that AI is starting to stream
      this.broadcastToDiscussion(discussionId, {
        type: 'ai-stream-start'
      });

      // Stream the response — each chunk is broadcast in real-time
      const fullResponse = await AIOrchestrator.handleStreamingRequest(
        {
          projectId,
          discussionId,
          prompt,
          llmConfig: project.activeLLM,
          userId
        },
        (chunk) => {
          // Broadcast each chunk to all clients in the discussion
          this.broadcastToDiscussion(discussionId, {
            type: 'ai-stream-chunk',
            chunk
          });
        }
      );

      // Save the complete AI message to DB
      const aiMessage = await discussionService.addMessage(
        discussionId,
        projectId,
        null,
        'CollabAI',
        fullResponse,
        true
      );

      // Broadcast the final saved message (with _id for memory button)
      this.broadcastToDiscussion(discussionId, {
        type: 'ai-stream-end',
        message: {
          _id: aiMessage._id,
          user: aiMessage.user,
          text: aiMessage.text,
          time: aiMessage.timestamp,
          isAI: true
        }
      });

      logger.ai('Streaming response complete', { 
        projectId, 
        discussionId, 
        promptLength: prompt.length,
        responseLength: fullResponse.length
      });

    } catch (error) {
      logger.error('AI generation error', { 
        projectId, 
        discussionId, 
        error: error.message,
        statusCode: error.statusCode
      });
      
      let errorText = `⚠️ ${error.message}`;
      if (error.statusCode === 429 && error.retryAfter) {
        errorText = `⚠️ Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`;
      }
      
      const errorMessage = await discussionService.addMessage(
        discussionId,
        projectId,
        null,
        'System',
        errorText,
        false
      );

      this.broadcastToDiscussion(discussionId, {
        type: 'project-chat',
        message: {
          user: errorMessage.user,
          text: errorMessage.text,
          time: errorMessage.timestamp,
          isAI: false
        }
      });

      this.broadcastToDiscussion(discussionId, {
        type: 'ai-error',
        message: error.message
      });
    }
  }

  /**
   * Broadcast message to all clients in a discussion
   */
  broadcastToDiscussion(discussionId, payload) {
    let count = 0;
    
    this.clients.forEach((meta, ws) => {
      if (ws.readyState === 1 && meta.discussionId === discussionId) {
        this.send(ws, payload);
        count++;
      }
    });

    logger.debug(`Broadcast to ${count} clients in discussion ${discussionId}`);
  }

  /**
   * Send message to specific client
   */
  send(ws, payload) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Send error to client
   */
  sendError(ws, message, type = 'error') {
    this.send(ws, { type, message });
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(ws) {
    const meta = this.clients.get(ws);
    if (meta) {
      logger.ws('Client disconnected', { 
        clientId: meta.id, 
        userId: meta.userId,
        duration: Date.now() - meta.connectedAt
      });
      this.clients.delete(ws);
      this.messageRateLimits.delete(meta.id);
    }
  }

  /**
   * Heartbeat mechanism to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((meta, ws) => {
        if (!meta.isAlive) {
          logger.ws('Terminating dead connection', { clientId: meta.id });
          ws.terminate();
          return;
        }

        meta.isAlive = false;
        ws.ping();
      });
    }, config.wsHeartbeatInterval);

    logger.info('Heartbeat mechanism started');
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(clientId) {
    const now = Date.now();
    const limit = this.messageRateLimits.get(clientId);

    if (!limit || now > limit.resetTime) {
      this.messageRateLimits.set(clientId, {
        count: 1,
        resetTime: now + config.rateLimitWindow
      });
      return true;
    }

    if (limit.count >= config.wsRateLimitMaxMessages) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Embed and save message for semantic search
   * Non-blocking, fail-safe
   */
  async _embedMessage(message, projectId, discussionId) {
    try {
      if (!message.text || message.text.length < 20) return;
      if (message.text.startsWith('@CollabAI')) return;
      if (message.isAI) return;

      const [{ default: EmbeddingService }, { default: MessageEmbedding }] = await Promise.all([
        import('../core/embeddings/EmbeddingService.js'),
        import('../models/MessageEmbedding.js')
      ]);

      const embedding = await EmbeddingService.embedText(message.text);
      if (!embedding) return;

      await MessageEmbedding.create({
        projectId,
        discussionId,
        messageId: message._id,
        content: message.text,
        embedding: embedding,
        userId: message.user?._id || message.user,
        username: message.user?.username || 'Unknown',
        timestamp: message.timestamp || Date.now()
      });
    } catch (error) {
      logger.warn('Failed to embed message (non-critical)', {
        messageId: message._id,
        projectId,
        error: error.message
      });
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.clients.size,
      authenticated: 0,
      inDiscussions: 0,
      byProject: {}
    };

    this.clients.forEach((meta) => {
      if (meta.userId) stats.authenticated++;
      if (meta.discussionId) stats.inDiscussions++;
      if (meta.projectId) {
        stats.byProject[meta.projectId] = (stats.byProject[meta.projectId] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Shutdown gracefully
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((meta, ws) => {
      this.send(ws, { type: 'server-shutdown', message: 'Server is shutting down' });
      ws.close();
    });

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

export default new ConnectionManager();


=== backend\src\services\discussionService.js ===

import Discussion from '../models/Discussion.js';
import Message from '../models/Message.js';
import '../models/User.js'; // ensure User schema is registered for populate('participants')

class DiscussionService {
  // Get project discussions
  async getProjectDiscussions(projectId) {
    try {
      const discussions = await Discussion.find({ 
        projectId,
        $or: [
          { status: 'active' },
          { status: { $exists: false } } // Support old discussions without status field
        ]
      })
        .populate('participants', 'username email')
        .sort({ isMain: -1, lastActivity: -1 })
        .lean();

      return discussions;
    } catch (error) {
      console.error('Error getting discussions:', error);
      throw error;
    }
  }

  // Create parallel discussion
  async createDiscussion(projectId, title, description, creatorId, ownerId, parentDiscussionId = null) {
    try {
      const participants = [creatorId];
      if (ownerId && ownerId.toString() !== creatorId.toString()) {
        participants.push(ownerId);
      }

      // Calculate branch depth
      let branchDepth = 0;
      if (parentDiscussionId) {
        const parent = await Discussion.findById(parentDiscussionId);
        if (parent) {
          branchDepth = parent.branchDepth + 1;
        }
      }

      const discussion = new Discussion({
        projectId,
        title: title.trim(),
        description,
        isMain: false,
        participants,
        creatorId,
        parentDiscussionId,
        branchDepth
      });

      await discussion.save();
      return discussion;
    } catch (error) {
      console.error('Error creating discussion:', error);
      throw error;
    }
  }

  // Get discussion graph
  async getDiscussionGraph(projectId) {
    try {
      const discussions = await Discussion.find({ 
        projectId,
        $or: [
          { status: 'active' },
          { status: { $exists: false } }
        ]
      })
        .select('_id title parentDiscussionId branchDepth messageCount lastActivity')
        .lean();

      return discussions;
    } catch (error) {
      console.error('Error getting discussion graph:', error);
      throw error;
    }
  }

  // Get discussion by ID
  async getDiscussionById(discussionId) {
    try {
      const discussion = await Discussion.findById(discussionId)
        .populate('participants', 'username email')
        .lean();
      return discussion;
    } catch (error) {
      console.error('Error getting discussion:', error);
      return null;
    }
  }

  // Get discussion messages
  async getDiscussionMessages(discussionId, limit = 100) {
    try {
      const messages = await Message.find({ discussionId })
        .sort({ timestamp: -1 })  // Sort descending (newest first)
        .limit(limit)
        .lean();

      // Reverse to get chronological order (oldest to newest)
      return messages.reverse();
    } catch (error) {
      console.error('Error getting discussion messages:', error);
      return [];
    }
  }

  // Add message to discussion
  async addMessage(discussionId, projectId, userId, username, text, isAI = false) {
    try {
      const message = new Message({
        discussionId,
        projectId,
        userId,
        user: username,
        text,
        timestamp: Date.now(),
        isAI
      });

      await message.save();

      // Update discussion activity
      await Discussion.findByIdAndUpdate(discussionId, {
        lastActivity: new Date(),
        $inc: { messageCount: 1 }
      });

      return message;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  // Join discussion
  async joinDiscussion(discussionId, userId) {
    try {
      await Discussion.findByIdAndUpdate(discussionId, {
        $addToSet: { participants: userId }
      });
    } catch (error) {
      console.error('Error joining discussion:', error);
    }
  }
}

export default new DiscussionService();


=== backend\src\services\documentService.js ===

import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import EmbeddingService from '../core/embeddings/EmbeddingService.js';
import { chunkText } from '../utils/chunking.js';
import logger from '../utils/logger.js';

class DocumentService {
  // Upload document with embedding generation
  async uploadDocument(projectId, title, content, fileType, uploadedBy) {
    try {
      // Save document first
      const document = new Document({
        projectId,
        title: title.trim(),
        content,
        fileType,
        uploadedBy
      });

      await document.save();
      
      logger.info('Document uploaded', {
        documentId: document._id,
        projectId,
        title,
        contentLength: content.length
      });

      // Generate embeddings asynchronously (don't block upload)
      this.generateEmbeddingsForDocument(document).catch(error => {
        logger.error('Failed to generate embeddings for document', {
          documentId: document._id,
          error: error.message
        });
      });
      
      return document;
    } catch (error) {
      logger.error('Error uploading document', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for a document (PHASE 2)
   */
  async generateEmbeddingsForDocument(document) {
    try {
      logger.ai('Starting embedding generation for document', {
        documentId: document._id,
        title: document.title,
        contentLength: document.content.length
      });

      // Chunk the document
      const chunks = chunkText(document.content, 900, 100);

      if (chunks.length === 0) {
        logger.warn('No chunks generated for document', {
          documentId: document._id
        });
        return;
      }

      logger.ai('Document chunked', {
        documentId: document._id,
        chunkCount: chunks.length
      });

      // Generate embeddings for each chunk
      const embeddings = await EmbeddingService.embedBatch(chunks);

      // Save chunks with embeddings
      const chunkDocuments = chunks.map((content, index) => ({
        projectId: document.projectId,
        documentId: document._id,
        chunkIndex: index,
        content,
        embedding: embeddings[index],
        metadata: {
          title: document.title,
          documentTitle: document.title
        }
      }));

      await DocumentChunk.insertMany(chunkDocuments);

      logger.ai('Embeddings stored', {
        documentId: document._id,
        chunkCount: chunks.length,
        embeddingDimensions: embeddings[0]?.length
      });

    } catch (error) {
      logger.error('Error generating embeddings for document', {
        documentId: document._id,
        error: error.message,
        stack: error.stack
      });
      // Don't throw - embedding generation is non-critical
    }
  }

  // Get project documents
  async getProjectDocuments(projectId) {
    try {
      const documents = await Document.find({ projectId })
        .populate('uploadedBy', 'username')
        .sort({ createdAt: -1 })
        .lean();

      // Add chunk count for each document
      const documentsWithChunks = await Promise.all(
        documents.map(async (doc) => {
          const chunkCount = await DocumentChunk.countDocuments({ documentId: doc._id });
          return {
            ...doc,
            chunks: Array(chunkCount).fill(null) // Just for count, not actual data
          };
        })
      );

      return documentsWithChunks;
    } catch (error) {
      logger.error('Error getting documents', { error: error.message });
      return [];
    }
  }

  // Get document by ID
  async getDocumentById(documentId) {
    try {
      const document = await Document.findById(documentId)
        .populate('uploadedBy', 'username email')
        .lean();
      return document;
    } catch (error) {
      logger.error('Error getting document', { error: error.message });
      return null;
    }
  }

  // Get document chunks with embeddings
  async getDocumentChunks(documentId) {
    try {
      const chunks = await DocumentChunk.find({ documentId })
        .sort({ chunkIndex: 1 })
        .lean();
      
      // Return chunks with embedding info (truncate embeddings for display)
      return chunks.map(chunk => ({
        _id: chunk._id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embeddingDimensions: chunk.embedding?.length || 0,
        embeddingPreview: chunk.embedding?.slice(0, 5) || [], // First 5 values
        metadata: chunk.metadata,
        createdAt: chunk.createdAt
      }));
    } catch (error) {
      logger.error('Error getting document chunks', { error: error.message });
      return [];
    }
  }

  // Delete document and its chunks
  async deleteDocument(documentId) {
    try {
      // Delete document
      await Document.findByIdAndDelete(documentId);
      
      // Delete associated chunks
      await DocumentChunk.deleteMany({ documentId });
      
      logger.info('Document and chunks deleted', { documentId });
      return true;
    } catch (error) {
      logger.error('Error deleting document', { error: error.message });
      return false;
    }
  }

  // Search documents (simple text search for MVP)
  async searchDocuments(projectId, query) {
    try {
      const documents = await Document.find({
        projectId,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } }
        ]
      })
      .populate('uploadedBy', 'username')
      .limit(10)
      .lean();

      return documents;
    } catch (error) {
      logger.error('Error searching documents', { error: error.message });
      return [];
    }
  }

  /**
   * Get chunk count for a document
   */
  async getDocumentChunkCount(documentId) {
    try {
      return await DocumentChunk.countDocuments({ documentId });
    } catch (error) {
      logger.error('Error getting chunk count', { error: error.message });
      return 0;
    }
  }

  /**
   * Get all chunks for a project
   */
  async getProjectChunks(projectId) {
    try {
      return await DocumentChunk.find({ projectId }).lean();
    } catch (error) {
      logger.error('Error getting project chunks', { error: error.message });
      return [];
    }
  }
}

export default new DocumentService();


=== backend\src\services\emailService.js ===

/**
 * Email Service - SendGrid Integration
 * Handles all email notifications (invites, notifications, etc.)
 */

import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@collabai.com';
    this.fromName = process.env.FROM_NAME || 'CollabAI';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      logger.warn('SendGrid API key not configured - emails will be logged only');
    }
  }

  /**
   * Send email via SendGrid API
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.enabled) {
      logger.info('Email would be sent (SendGrid not configured)', {
        to,
        subject,
        preview: text?.substring(0, 100)
      });
      return { success: true, mock: true };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }]
          }],
          from: {
            email: this.fromEmail,
            name: this.fromName
          },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }

      logger.info('Email sent successfully', { to, subject });
      return { success: true };

    } catch (error) {
      logger.error('Failed to send email', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send project invite email
   */
  async sendProjectInvite({ to, inviterName, projectTitle, inviteCode }) {
    const inviteUrl = `${this.frontendUrl}/join/${inviteCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .code { background: #e5e7eb; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 You're Invited to CollabAI</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p><strong>${inviterName}</strong> has invited you to collaborate on the project:</p>
            <h2 style="color: #8b5cf6; margin: 20px 0;">${projectTitle}</h2>
            <p>Join the team and start collaborating with AI-powered discussions, document sharing, and intelligent insights.</p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Join Project</a>
            </div>

            <p style="margin-top: 30px;">Or use this invite code:</p>
            <div class="code">${inviteCode}</div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              This invite link will take you directly to the project. If you don't have an account yet, you'll be able to create one.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
You're invited to CollabAI!

${inviterName} has invited you to collaborate on: ${projectTitle}

Join the project: ${inviteUrl}

Or use invite code: ${inviteCode}

CollabAI - Real-Time AI Collaborative Workspace
    `.trim();

    return await this.sendEmail({
      to,
      subject: `You're invited to ${projectTitle} on CollabAI`,
      html,
      text
    });
  }

  /**
   * Send discussion invite email
   */
  async sendDiscussionInvite({ to, inviterName, projectTitle, discussionTitle, inviteCode, discussionId }) {
    // Use invite code format with discussion parameter
    const discussionUrl = `${this.frontendUrl}/join/${inviteCode}?discussion=${discussionId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10a37f 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10a37f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Discussion Invitation</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p><strong>${inviterName}</strong> has invited you to join a discussion in <strong>${projectTitle}</strong>:</p>
            <h2 style="color: #10a37f; margin: 20px 0;">${discussionTitle}</h2>
            
            <div style="text-align: center;">
              <a href="${discussionUrl}" class="button">Join Discussion</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Click the button above to join the discussion and start collaborating with your team.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
New Discussion Invitation

${inviterName} has invited you to join a discussion in ${projectTitle}:

Discussion: ${discussionTitle}

Join here: ${discussionUrl}

CollabAI - Real-Time AI Collaborative Workspace
    `.trim();

    return await this.sendEmail({
      to,
      subject: `Join discussion: ${discussionTitle}`,
      html,
      text
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail({ to, username }) {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #8b5cf6; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to CollabAI!</h1>
            <p style="font-size: 18px; margin-top: 10px;">Your AI-powered collaboration journey starts here</p>
          </div>
          <div class="content">
            <p>Hi <strong>${username}</strong>!</p>
            <p>Welcome to CollabAI - where teams collaborate with the power of AI. We're excited to have you on board!</p>

            <h3 style="color: #8b5cf6; margin-top: 30px;">What you can do:</h3>

            <div class="feature">
              <strong>🚀 Create Projects</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Start a new project and invite your team to collaborate in real-time.</p>
            </div>

            <div class="feature">
              <strong>💬 AI-Powered Discussions</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Mention @CollabAI to get intelligent assistance and insights.</p>
            </div>

            <div class="feature">
              <strong>📄 Document Intelligence</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Upload documents and let AI understand and reference them in discussions.</p>
            </div>

            <div class="feature">
              <strong>📊 Smart Dashboards</strong>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Get automatic insights, track decisions, and identify blockers.</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${loginUrl}" class="button">Get Started</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Need help? Check out our documentation or reach out to our support team.
            </p>
          </div>
          <div class="footer">
            <p>CollabAI - Real-Time AI Collaborative Workspace</p>
            <p>Happy collaborating! 🎯</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to CollabAI!

Hi ${username}!

Welcome to CollabAI - where teams collaborate with the power of AI.

What you can do:
- Create projects and invite your team
- Get AI assistance with @CollabAI mentions
- Upload documents for intelligent context
- Track decisions and insights automatically

Get started: ${loginUrl}

Happy collaborating!
CollabAI Team
    `.trim();

    return await this.sendEmail({
      to,
      subject: 'Welcome to CollabAI! 🎉',
      html,
      text
    });
  }
}

export default new EmailService();


=== backend\src\services\EmbeddingWorker.js ===

/**
 * EmbeddingWorker — Background reliability layer for embeddings
 * 
 * Problems solved:
 * 1. Messages that failed to embed (model loading, transient errors) are retried
 * 2. Decisions without embeddings get backfilled
 * 3. On startup, any orphaned messages/decisions are caught up
 * 
 * Runs on a simple setInterval — no Redis/Bull needed
 */

import logger from '../utils/logger.js';

class EmbeddingWorker {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.stats = {
      messagesBackfilled: 0,
      decisionsBackfilled: 0,
      failures: 0,
      lastRunAt: null
    };
  }

  /**
   * Start the worker — runs every 60 seconds
   */
  start(intervalMs = 60000) {
    if (this.interval) return;

    logger.info('[EmbeddingWorker] Starting background embedding worker', {
      intervalMs
    });

    // Run once immediately after a short delay (let the model warm up)
    setTimeout(() => this.run(), 10000);

    // Then run on interval
    this.interval = setInterval(() => this.run(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[EmbeddingWorker] Stopped');
    }
  }

  async run() {
    if (this.isRunning) return; // skip if previous run is still going
    this.isRunning = true;

    try {
      await this.backfillMessages();
      await this.backfillDecisions();
      this.stats.lastRunAt = new Date();
    } catch (err) {
      logger.error('[EmbeddingWorker] Run failed', { error: err.message });
      this.stats.failures++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Find messages that were saved but never embedded
   * (i.e., exist in Message but not in MessageEmbedding)
   */
  async backfillMessages() {
    try {
      const [
        { default: Message },
        { default: MessageEmbedding },
        { default: EmbeddingService }
      ] = await Promise.all([
        import('../models/Message.js'),
        import('../models/MessageEmbedding.js'),
        import('../core/embeddings/EmbeddingService.js')
      ]);

      // Get IDs of all already-embedded messages
      const embeddedIds = await MessageEmbedding.distinct('messageId');
      const embeddedIdSet = new Set(embeddedIds.map(id => id.toString()));

      // Find messages that should be embedded but aren't
      // Criteria: not AI, not @CollabAI commands, >= 20 chars, not already embedded
      const candidates = await Message.find({
        isAI: { $ne: true },
        text: { $exists: true }
      })
        .sort({ timestamp: -1 })
        .limit(100) // process max 100 per run to avoid overload
        .lean();

      const unembedded = candidates.filter(m => {
        if (!m.text || m.text.length < 20) return false;
        if (m.text.startsWith('@CollabAI')) return false;
        if (embeddedIdSet.has(m._id.toString())) return false;
        return true;
      });

      if (unembedded.length === 0) return;

      logger.info('[EmbeddingWorker] Backfilling messages', {
        found: unembedded.length
      });

      let count = 0;
      for (const msg of unembedded) {
        try {
          const embedding = await EmbeddingService.embedText(msg.text);
          if (!embedding) continue;

          await MessageEmbedding.create({
            projectId: msg.projectId,
            discussionId: msg.discussionId,
            messageId: msg._id,
            content: msg.text,
            embedding,
            userId: msg.userId,
            username: msg.user || 'Unknown',
            timestamp: msg.timestamp || Date.now()
          });
          count++;
        } catch (err) {
          // Skip duplicate key errors (race condition with live embedding)
          if (err.code === 11000) continue;
          logger.warn('[EmbeddingWorker] Failed to embed message', {
            messageId: msg._id,
            error: err.message
          });
        }
      }

      if (count > 0) {
        this.stats.messagesBackfilled += count;
        logger.info('[EmbeddingWorker] Messages backfilled', { count });
      }
    } catch (err) {
      logger.error('[EmbeddingWorker] Message backfill failed', { error: err.message });
    }
  }

  /**
   * Find decisions that don't have embeddings yet (pending or failed)
   */
  async backfillDecisions() {
    try {
      const [
        { default: Decision },
        { default: EmbeddingService }
      ] = await Promise.all([
        import('../models/Decision.js'),
        import('../core/embeddings/EmbeddingService.js')
      ]);

      const unembedded = await Decision.find({
        embeddingStatus: { $in: ['pending', 'failed'] }
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      if (unembedded.length === 0) return;

      logger.info('[EmbeddingWorker] Backfilling decisions', {
        found: unembedded.length
      });

      let count = 0;
      for (const dec of unembedded) {
        try {
          const textToEmbed = dec.text + (dec.rationale ? '. ' + dec.rationale : '');
          const embedding = await EmbeddingService.embedText(textToEmbed);
          if (!embedding) continue;

          await Decision.findByIdAndUpdate(dec._id, {
            embedding,
            embeddingStatus: 'done'
          });
          count++;
        } catch (err) {
          logger.warn('[EmbeddingWorker] Failed to embed decision', {
            decisionId: dec._id,
            error: err.message
          });
          // Don't flip to 'failed' again — leave it for next retry
        }
      }

      if (count > 0) {
        this.stats.decisionsBackfilled += count;
        logger.info('[EmbeddingWorker] Decisions backfilled', { count });
      }
    } catch (err) {
      logger.error('[EmbeddingWorker] Decision backfill failed', { error: err.message });
    }
  }

  /**
   * Get worker health stats
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning
    };
  }
}

export default new EmbeddingWorker();


=== backend\src\services\messageService.js ===

import Message from '../models/Message.js';

class MessageService {
  // Get all messages for a room (with optional limit and pagination)
  async getAllMessages(roomId = 'general', limit = 100, skip = 0) {
    try {
      const messages = await Message
        .find({ roomId })
        .sort({ timestamp: 1 }) // Oldest first for chat display
        .skip(skip)
        .limit(limit)
        .lean(); // Returns plain JS objects for better performance

      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Create a new message
  async createMessage(user, text, roomId = 'general', timestamp = Date.now()) {
    try {
      const message = new Message({
        user: user.trim(),
        text,
        roomId,
        timestamp
      });

      const savedMessage = await message.save();
      return savedMessage.toObject(); // Convert to plain object
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  // Get recent messages for a room (for new connections)
  async getRecentMessages(roomId = 'general', limit = 50) {
    try {
      const messages = await Message
        .find({ roomId })
        .sort({ timestamp: -1 }) // Newest first
        .limit(limit)
        .lean();

      return messages.reverse(); // Reverse to show oldest first in chat
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      throw error;
    }
  }

  // Get message count (for stats)
  async getMessageCount(roomId = null) {
    try {
      const filter = roomId ? { roomId } : {};
      return await Message.countDocuments(filter);
    } catch (error) {
      console.error('Error counting messages:', error);
      return 0;
    }
  }

  // Get all rooms with message counts
  async getRoomsWithStats() {
    try {
      const rooms = await Message.aggregate([
        {
          $group: {
            _id: '$roomId',
            messageCount: { $sum: 1 },
            lastMessage: { $max: '$timestamp' }
          }
        },
        {
          $sort: { lastMessage: -1 }
        }
      ]);

      return rooms.map(room => ({
        roomId: room._id,
        messageCount: room.messageCount,
        lastActivity: new Date(room.lastMessage)
      }));
    } catch (error) {
      console.error('Error fetching room stats:', error);
      return [];
    }
  }

  // Delete old messages (cleanup utility)
  async deleteOldMessages(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await Message.deleteMany({
        createdAt: { $lt: cutoffDate }
      });

      console.log(`🧹 Deleted ${result.deletedCount} old messages`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting old messages:', error);
      throw error;
    }
  }
}

export default new MessageService();

=== backend\src\services\projectService.js ===

import Project from '../models/Project.js';
import Discussion from '../models/Discussion.js';
import User from '../models/User.js';
import crypto from 'crypto';

class ProjectService {
  // Create new project
  async createProject(title, problemStatement, ownerId) {
    try {
      const inviteCode = crypto.randomBytes(4).toString('hex');

      const project = new Project({
        title: title.trim(),
        problemStatement,
        ownerId,
        members: [{
          userId: ownerId,
          role: 'owner'
        }],
        inviteCode,
        activeLLM: {
          provider: 'server',
          model: 'llama-3.1-8b-instant'
        }
      });

      await project.save();

      // Create main discussion
      const mainDiscussion = new Discussion({
        projectId: project._id,
        title: 'Main Discussion',
        description: 'Primary project discussion',
        isMain: true,
        participants: [ownerId]
      });

      await mainDiscussion.save();

      // Add project to user
      await User.findByIdAndUpdate(ownerId, {
        $addToSet: { projects: project._id }
      });

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Get project by ID
  async getProjectById(projectId) {
    try {
      const project = await Project.findById(projectId)
        .populate('ownerId', 'username email')
        .populate('members.userId', 'username email')
        .lean();
      return project;
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  }

  // Get user's projects
  async getUserProjects(userId) {
    try {
      const projects = await Project.find({
        'members.userId': userId
      })
      .populate('ownerId', 'username email')
      .populate('members.userId', 'username email')
      .sort({ updatedAt: -1 })
      .lean();

      return projects;
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  // Join project via invite code
  async joinProject(inviteCode, userId) {
    try {
      const project = await Project.findOne({ inviteCode });

      if (!project) {
        throw new Error('Invalid invite code');
      }

      // Check if already a member
      const isMember = project.members.some(
        m => m.userId.toString() === userId.toString()
      );

      if (isMember) {
        console.log(`User ${userId} already a member of project ${project._id}, skipping add`);
        // Return populated project
        return await Project.findById(project._id)
          .populate('ownerId', 'username email')
          .populate('members.userId', 'username email')
          .lean();
      }

      console.log(`Adding user ${userId} to project ${project._id}`);

      // Add member
      project.members.push({
        userId,
        role: 'member'
      });

      await project.save();

      // Add project to user
      await User.findByIdAndUpdate(userId, {
        $addToSet: { projects: project._id }
      });

      // Add to main discussion only (not all discussions)
      await Discussion.findOneAndUpdate(
        { projectId: project._id, isMain: true },
        { $addToSet: { participants: userId } }
      );

      console.log(`User ${userId} successfully added to project ${project._id}`);

      // Return populated project
      return await Project.findById(project._id)
        .populate('ownerId', 'username email')
        .populate('members.userId', 'username email')
        .lean();
    } catch (error) {
      console.error('Error joining project:', error);
      throw error;
    }
  }

  // Update project stage
  async updateProjectStage(projectId, stage) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        { stage },
        { new: true }
      );
      return project;
    } catch (error) {
      console.error('Error updating project stage:', error);
      throw error;
    }
  }

  // Update active LLM
  async updateActiveLLM(projectId, llmConfig) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        { activeLLM: llmConfig },
        { new: true }
      );
      return project;
    } catch (error) {
      console.error('Error updating LLM:', error);
      throw error;
    }
  }

  // Update project (general)
  async updateProject(projectId, updates) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        updates,
        { new: true }
      ).populate('ownerId', 'username email');
      return project;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Check if user is project member
  async isProjectMember(projectId, userId) {
    try {
      const project = await Project.findById(projectId);
      if (!project) return false;

      return project.members.some(
        m => m.userId.toString() === userId.toString()
      );
    } catch (error) {
      return false;
    }
  }

  // Check if user is project owner
  async isProjectOwner(projectId, userId) {
    try {
      const project = await Project.findById(projectId);
      if (!project) return false;

      return project.ownerId.toString() === userId.toString();
    } catch (error) {
      return false;
    }
  }

  // Set API key for provider
  async setProjectApiKey(projectId, provider, apiKey) {
    try {
      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.apiKeys) {
        project.apiKeys = new Map();
      }
      
      project.apiKeys.set(provider, apiKey);
      await project.save();
      
      return project;
    } catch (error) {
      console.error('Error setting API key:', error);
      throw error;
    }
  }

  // Get API key for provider
  async getProjectApiKey(projectId, provider) {
    try {
      const project = await Project.findById(projectId);
      if (!project || !project.apiKeys) {
        return null;
      }
      
      return project.apiKeys.get(provider);
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }
}

export default new ProjectService();


=== backend\src\services\roomService.js ===

import Room from '../models/Room.js';

class RoomService {
  // Get all rooms
  async getAllRooms() {
    try {
      const rooms = await Room
        .find()
        .sort({ lastActivity: -1 })
        .lean();

      return rooms;
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
  }

  // Create a new room
  async createRoom(name, description = '', createdBy = 'System', isPrivate = false) {
    try {
      // Check if room already exists
      const existingRoom = await Room.findOne({ name: name.trim() });
      if (existingRoom) {
        throw new Error('Room already exists');
      }

      const room = new Room({
        name: name.trim(),
        description,
        createdBy,
        isPrivate,
        lastActivity: new Date()
      });

      const savedRoom = await room.save();
      return savedRoom.toObject();
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  // Get room by name
  async getRoomByName(name) {
    try {
      const room = await Room.findOne({ name }).lean();
      return room;
    } catch (error) {
      console.error('Error fetching room:', error);
      throw error;
    }
  }

  // Update room activity
  async updateRoomActivity(roomId) {
    try {
      await Room.findOneAndUpdate(
        { name: roomId },
        { lastActivity: new Date() }
      );
    } catch (error) {
      console.error('Error updating room activity:', error);
    }
  }

  // Delete room
  async deleteRoom(name, deletedBy) {
    try {
      const result = await Room.deleteOne({ name });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  // Initialize default rooms
  async initializeDefaultRooms() {
    try {
      const defaultRooms = [
        { name: 'general', description: 'General discussion', createdBy: 'System' },
        { name: 'random', description: 'Random conversations', createdBy: 'System' },
        { name: 'help', description: 'Ask for help here', createdBy: 'System' }
      ];

      for (const roomData of defaultRooms) {
        const existing = await this.getRoomByName(roomData.name);
        if (!existing) {
          await this.createRoom(roomData.name, roomData.description, roomData.createdBy);
          console.log(`✅ Created default room: ${roomData.name}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default rooms:', error);
    }
  }
}

export default new RoomService();

=== backend\src\services\summaryService.js ===

import Summary from '../models/Summary.js';

class SummaryService {
  // Create summary
  async createSummary(projectId, discussionId, content, type = 'discussion', generatedBy = 'server', messageCountAtSummary = 0) {
    try {
      const summary = new Summary({
        projectId,
        discussionId,
        content,
        type,
        generatedBy,
        messageCountAtSummary,
        messageRange: {
          start: new Date(),
          end: new Date()
        }
      });

      await summary.save();
      return summary;
    } catch (error) {
      console.error('Error creating summary:', error);
      throw error;
    }
  }

  // Get project summaries
  async getProjectSummaries(projectId, limit = 10) {
    try {
      const summaries = await Summary.find({ projectId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return summaries;
    } catch (error) {
      console.error('Error getting summaries:', error);
      return [];
    }
  }

  // Get discussion summaries
  async getDiscussionSummaries(discussionId, limit = null) {
    try {
      let query = Summary.find({ discussionId })
        .sort({ createdAt: -1 });
      
      if (limit) {
        query = query.limit(limit);
      }

      const summaries = await query.lean();
      return summaries;
    } catch (error) {
      console.error('Error getting discussion summaries:', error);
      return [];
    }
  }

  // Get summaries by type
  async getSummariesByType(projectId, type) {
    try {
      const summaries = await Summary.find({ projectId, type })
        .sort({ createdAt: -1 })
        .lean();

      return summaries;
    } catch (error) {
      console.error('Error getting summaries by type:', error);
      return [];
    }
  }

  // Get summary by ID
  async getSummaryById(summaryId) {
    try {
      const summary = await Summary.findById(summaryId).lean();
      return summary;
    } catch (error) {
      console.error('Error getting summary by ID:', error);
      return null;
    }
  }

  // Update summary
  async updateSummary(summaryId, newContent) {
    try {
      const summary = await Summary.findByIdAndUpdate(
        summaryId,
        { content: newContent },
        { new: true }
      ).lean();
      return summary;
    } catch (error) {
      console.error('Error updating summary:', error);
      throw error;
    }
  }

  // Delete summary
  async deleteSummary(summaryId) {
    try {
      await Summary.findByIdAndDelete(summaryId);
      return true;
    } catch (error) {
      console.error('Error deleting summary:', error);
      throw error;
    }
  }
}

export default new SummaryService();


=== backend\src\services\userService.js ===

import User from '../models/User.js';

class UserService {
  // Get or create user
  async getOrCreateUser(username) {
    try {
      let user = await User.findOne({ username: username.trim() });
      
      if (!user) {
        user = new User({
          username: username.trim(),
          lastSeen: new Date(),
          isOnline: true
        });
        await user.save();
        console.log(`👤 New user created: ${username}`);
      } else {
        // Update last seen and online status
        user.lastSeen = new Date();
        user.isOnline = true;
        await user.save();
      }
      
      return user.toObject();
    } catch (error) {
      console.error('Error getting/creating user:', error);
      throw error;
    }
  }

  // Update user online status
  async setUserOnline(username, isOnline = true) {
    try {
      await User.findOneAndUpdate(
        { username },
        { 
          isOnline,
          lastSeen: new Date()
        }
      );
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  // Increment user message count
  async incrementMessageCount(username) {
    try {
      await User.findOneAndUpdate(
        { username },
        { 
          $inc: { messageCount: 1 },
          lastSeen: new Date()
        }
      );
    } catch (error) {
      console.error('Error incrementing message count:', error);
    }
  }

  // Get online users
  async getOnlineUsers() {
    try {
      const users = await User
        .find({ isOnline: true })
        .select('username lastSeen')
        .sort({ lastSeen: -1 })
        .lean();

      return users;
    } catch (error) {
      console.error('Error fetching online users:', error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(username) {
    try {
      const user = await User.findOne({ username }).lean();
      return user || null;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }
  }

  // Get all users with stats
  async getAllUsersWithStats() {
    try {
      const users = await User
        .find()
        .select('username messageCount lastSeen isOnline createdAt')
        .sort({ messageCount: -1 })
        .lean();

      return users;
    } catch (error) {
      console.error('Error fetching users with stats:', error);
      return [];
    }
  }

  // Clean up offline users (mark users as offline if not seen for X minutes)
  async cleanupOfflineUsers(minutesThreshold = 5) {
    try {
      const cutoffTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
      
      const result = await User.updateMany(
        { 
          isOnline: true,
          lastSeen: { $lt: cutoffTime }
        },
        { isOnline: false }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Marked ${result.modifiedCount} users as offline`);
      }
      
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning up offline users:', error);
      return 0;
    }
  }
}

export default new UserService();

=== backend\src\utils\chunking.js ===

/**
 * Document Chunking Utility - PHASE 2
 * Splits documents into semantic chunks for embedding
 */

import logger from './logger.js';

// Get chunk settings from environment or use defaults
const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 100;

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || DEFAULT_CHUNK_SIZE, 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || DEFAULT_CHUNK_OVERLAP, 10);

/**
 * Split text into chunks of approximately targetSize characters
 * Tries to break at sentence boundaries for better semantic coherence
 */
export function chunkText(text, targetSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Clean whitespace
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  if (cleanedText.length === 0) {
    return [];
  }

  // If text is smaller than target, return as single chunk
  if (cleanedText.length <= targetSize) {
    return [cleanedText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + targetSize;

    // If this is the last chunk, take everything
    if (endIndex >= cleanedText.length) {
      chunks.push(cleanedText.slice(startIndex).trim());
      break;
    }

    // Try to find a sentence boundary (. ! ?)
    let sentenceEnd = -1;
    for (let i = endIndex; i > startIndex + targetSize / 2; i--) {
      const char = cleanedText[i];
      if (char === '.' || char === '!' || char === '?') {
        // Check if followed by space or end
        if (i === cleanedText.length - 1 || cleanedText[i + 1] === ' ') {
          sentenceEnd = i + 1;
          break;
        }
      }
    }

    // If found sentence boundary, use it
    if (sentenceEnd > 0) {
      endIndex = sentenceEnd;
    } else {
      // Otherwise, try to find a space
      let spaceIndex = cleanedText.lastIndexOf(' ', endIndex);
      if (spaceIndex > startIndex + targetSize / 2) {
        endIndex = spaceIndex;
      }
    }

    chunks.push(cleanedText.slice(startIndex, endIndex).trim());

    // Move start index with overlap
    startIndex = endIndex - overlap;
    if (startIndex < 0) startIndex = 0;
  }

  logger.debug('Text chunked', {
    originalLength: text.length,
    cleanedLength: cleanedText.length,
    chunkCount: chunks.length,
    targetSize,
    overlap
  });

  return chunks;
}

/**
 * Validate chunk size
 */
export function validateChunk(chunk, minSize = 50, maxSize = 2000) {
  if (!chunk || typeof chunk !== 'string') {
    return false;
  }

  const length = chunk.trim().length;
  return length >= minSize && length <= maxSize;
}


=== backend\src\utils\logger.js ===

/**
 * Structured Logging System
 * Provides consistent, queryable logging across the application
 */

import config from '../config/index.js';

class Logger {
  constructor() {
    this.level = config.logLevel;
    this.format = config.logFormat;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.format === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      });
    }

    // Pretty format for development
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍'
    }[level] || '📝';

    const metaStr = Object.keys(meta).length > 0 
      ? '\n' + JSON.stringify(meta, null, 2)
      : '';

    return `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  // Specialized logging methods
  http(method, path, statusCode, duration, meta = {}) {
    this.info(`${method} ${path} ${statusCode} ${duration}ms`, meta);
  }

  ws(event, meta = {}) {
    this.debug(`WebSocket: ${event}`, meta);
  }

  ai(action, meta = {}) {
    this.info(`AI: ${action}`, meta);
  }

  db(operation, collection, meta = {}) {
    this.debug(`DB: ${operation} on ${collection}`, meta);
  }
}

export default new Logger();


=== backend\src\utils\normalizeText.js ===

/**
 * Text normalization utilities for decision deduplication.
 */

/**
 * General-purpose normalization.
 * Lowercase, trim, collapse spaces, strip punctuation.
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decision text normalization for deduplication.
 * Strips leading commitment phrases so "We'll batch X" and "Let's batch X" both → "batch X"
 * Used before embedding similarity to catch phrasing duplicates.
 */
export function normalizeDecisionText(text) {
  if (!text || typeof text !== 'string') return normalizeText(text);
  const DECISION_PREFIXES = /^(we('ll| will| should| probably should| are going to| have decided| decided| chose| are using| will use)|let'?s|going with|decided (to|on)|we('ve| have) (chosen|selected|picked|agreed|adopted)|our (approach|stack|architecture|solution|choice) (is|will be))\s+/i;
  return normalizeText(text.replace(DECISION_PREFIXES, ''));
}


=== frontend\src\App.jsx ===

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import ProjectWorkspace from './components/ProjectWorkspace';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/shared/ErrorBoundary';
import apiRequest from './utils/api.js';
import { getInviteCodeFromUrl, getDiscussionInviteFromUrl, clearUrl } from './utils/router';

function AppContent() {
  const { user, loading, refreshAuth, token } = useAuth();
  const [selectedProject, setSelectedProject] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [discussionId, setDiscussionId] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProjectData, setInviteProjectData] = useState(null);
  const [oauthHandled, setOauthHandled] = useState(false);

  // Check for invite link in URL
  useEffect(() => {
    const code = getInviteCodeFromUrl();
    const discussion = getDiscussionInviteFromUrl();
    if (code) {
      setInviteCode(code);
      if (discussion) {
        setDiscussionId(discussion);
      }
    }
  }, []);

  // Auto-join project if user is logged in and has invite code
  useEffect(() => {
    if (user && inviteCode && token && !isJoining && !showInviteModal) {
      // Fetch project info first to show in modal
      fetchInviteProjectInfo();
    }
  }, [user, inviteCode, token]);

  const fetchInviteProjectInfo = async () => {
    try {
      // We need to get project info without joining first
      // For now, just show the modal - we'll fetch details in the modal
      setShowInviteModal(true);
    } catch (error) {
      console.error('Error fetching invite info:', error);
      // If we can't fetch, just show modal anyway
      setShowInviteModal(true);
    }
  };

  const handleAutoJoin = async () => {
    // Prevent multiple calls
    if (isJoining) return;
    
    setIsJoining(true);
    
    try {
      const requestBody = { inviteCode };
      
      // If there's a discussion ID, include it in the request
      if (discussionId) {
        requestBody.discussionId = discussionId;
      }
      
      const response = await apiRequest('/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      if (data.success) {
        clearUrl();
        setInviteCode(null);
        setShowInviteModal(false);
        
        // Show appropriate success message
        if (discussionId) {
          if (data.alreadyMember && data.addedToDiscussion) {
            toast.success(`Added to discussion in "${data.project.title}"!`);
          } else if (data.alreadyMember) {
            toast.success(`Opened "${data.project.title}"`);
          } else {
            toast.success(`Joined "${data.project.title}" and added to discussion!`);
          }
          
          // Store discussion ID for navigation
          sessionStorage.setItem('pendingDiscussionId', data.discussionId || discussionId);
          setDiscussionId(null);
          
          // For discussion invites, open the project workspace directly
          setSelectedProject(data.project);
        } else {
          // Project invite - stay on project list
          if (data.alreadyMember) {
            toast.info(`You're already a member of "${data.project.title}"`);
          } else {
            toast.success(`Joined "${data.project.title}" successfully!`);
          }
        }
      } else {
        toast.error(data.error || 'Failed to join project');
        clearUrl();
        setInviteCode(null);
        setDiscussionId(null);
        setShowInviteModal(false);
      }
    } catch (error) {
      toast.error('Failed to join project');
      clearUrl();
      setInviteCode(null);
      setDiscussionId(null);
      setShowInviteModal(false);
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeclineInvite = () => {
    clearUrl();
    setInviteCode(null);
    setDiscussionId(null);
    setShowInviteModal(false);
    toast.info('Invite declined');
  };

  // Check if user needs onboarding
  useEffect(() => {
    if (user && !localStorage.getItem('onboarding-completed') && !inviteCode) {
      console.log('Showing onboarding for new user');
      setShowOnboarding(true);
    }
  }, [user, inviteCode]);

  // Handle OAuth callback
  useEffect(() => {
    if (oauthHandled) return;
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const provider = params.get('provider');
    const error = params.get('error');

    if (error) {
      toast.error('Authentication failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setOauthHandled(true);
    } else if (token && provider) {
      // Store token
      localStorage.setItem('collab-ai-token', token);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setOauthHandled(true);
      // Trigger auth refresh
      refreshAuth().then(() => {
        toast.success(`Welcome! Signed in with ${provider}`);
      });
    }
  }, [toast, oauthHandled, refreshAuth]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner}></div>
        <div style={styles.loadingText}>Loading...</div>
      </div>
    );
  }

  // If not logged in but has invite code, show login with message
  if (!user) {
    if (inviteCode) {
      return (
        <div>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '8px',
            padding: '16px',
            margin: '20px auto',
            maxWidth: '420px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#10a37f', fontSize: '14px', marginBottom: '8px' }}>
              🎉 You've been invited to join a project!
            </p>
            <p style={{ color: '#b4b4b4', fontSize: '13px' }}>
              Please log in or create an account to continue
            </p>
          </div>
          <Auth />
        </div>
      );
    }
    return <Auth />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  if (selectedProject) {
    return (
      <>
        <ProjectWorkspace 
          project={selectedProject} 
          onBack={() => setSelectedProject(null)} 
        />
        {showInviteModal && (
          <InviteConfirmModal
            inviteCode={inviteCode}
            discussionId={discussionId}
            token={token}
            onAccept={handleAutoJoin}
            onDecline={handleDeclineInvite}
            isJoining={isJoining}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ProjectList onSelectProject={setSelectedProject} />
      {showInviteModal && (
        <InviteConfirmModal
          inviteCode={inviteCode}
          discussionId={discussionId}
          token={token}
          onAccept={handleAutoJoin}
          onDecline={handleDeclineInvite}
          isJoining={isJoining}
        />
      )}
    </>
  );
}

function InviteConfirmModal({ inviteCode, discussionId, token, onAccept, onDecline, isJoining }) {
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInviteInfo();
  }, []);

  const fetchInviteInfo = async () => {
    try {
      const response = await apiRequest('/api/projects/invite-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode, discussionId })
      });

      const data = await response.json();
      if (data.success) {
        setInviteInfo(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching invite info:', error);
      setLoading(false);
    }
  };

  const isDiscussionInvite = !!discussionId;
  const alreadyInProject = inviteInfo?.isMember;
  const alreadyInDiscussion = inviteInfo?.discussion?.isParticipant;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.inviteModal}>
        <div style={styles.inviteHeader}>
          <div style={styles.inviteIcon}>
            {isDiscussionInvite ? '💬' : '🎉'}
          </div>
          <h2 style={styles.inviteTitle}>
            {isDiscussionInvite ? 'Discussion Invite' : 'Project Invite'}
          </h2>
        </div>

        <div style={styles.inviteBody}>
          {loading ? (
            <div style={styles.inviteLoading}>Loading invite details...</div>
          ) : inviteInfo ? (
            <>
              <p style={styles.inviteText}>
                {isDiscussionInvite 
                  ? `You've been invited to join the discussion "${inviteInfo.discussion?.title || 'Discussion'}" in "${inviteInfo.project.title}".`
                  : `You've been invited to join "${inviteInfo.project.title}".`}
              </p>
              
              {isDiscussionInvite && (
                <div style={styles.inviteNote}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <span>
                    {alreadyInProject 
                      ? (alreadyInDiscussion ? "You're already in this discussion" : "You'll be added to this discussion")
                      : "You'll be added to the project and this discussion"}
                  </span>
                </div>
              )}

              <div style={styles.inviteDetails}>
                <div style={styles.inviteDetailItem}>
                  <span style={styles.inviteDetailLabel}>Project:</span>
                  <div style={styles.inviteDetailValue}>{inviteInfo.project.title}</div>
                </div>
                {isDiscussionInvite && inviteInfo.discussion && (
                  <div style={styles.inviteDetailItem}>
                    <span style={styles.inviteDetailLabel}>Discussion:</span>
                    <div style={styles.inviteDetailValue}>{inviteInfo.discussion.title}</div>
                  </div>
                )}
                <div style={styles.inviteDetailItem}>
                  <span style={styles.inviteDetailLabel}>Members:</span>
                  <div style={styles.inviteDetailValue}>{inviteInfo.project.memberCount} members</div>
                </div>
              </div>
            </>
          ) : (
            <div style={styles.inviteLoading}>Failed to load invite details</div>
          )}
        </div>

        <div style={styles.inviteActions}>
          <button
            onClick={onDecline}
            disabled={isJoining}
            style={styles.inviteDeclineBtn}
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={isJoining || loading || !inviteInfo}
            style={styles.inviteAcceptBtn}
          >
            {isJoining ? 'Joining...' : (alreadyInProject && alreadyInDiscussion ? 'Continue' : 'Accept & Join')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
          <ToastContainer
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
            style={{ zIndex: 99999 }}
          />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d0d',
    color: '#ececec',
    gap: '20px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #2d2d2d',
    borderTop: '4px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '16px',
    color: '#6b7280'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)'
  },
  inviteModal: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '480px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.3s ease-out'
  },
  inviteHeader: {
    padding: '24px 24px 16px',
    textAlign: 'center',
    borderBottom: '1px solid #2d2d2d'
  },
  inviteIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  inviteTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  inviteBody: {
    padding: '24px'
  },
  inviteLoading: {
    textAlign: 'center',
    color: '#b4b4b4',
    padding: '20px'
  },
  inviteText: {
    fontSize: '15px',
    color: '#b4b4b4',
    lineHeight: '1.6',
    margin: '0 0 20px 0',
    textAlign: 'center'
  },
  inviteNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#b4b4b4',
    marginBottom: '20px'
  },
  inviteDetails: {
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    padding: '16px'
  },
  inviteDetailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  inviteDetailLabel: {
    fontSize: '12px',
    color: '#8e8ea0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  inviteDetailValue: {
    fontSize: '14px',
    color: '#ececec',
    background: '#1a1a1a',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #2d2d2d',
    marginTop: '4px'
  },
  inviteActions: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #2d2d2d'
  },
  inviteDeclineBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#b4b4b4',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#1a1a1a',
      borderColor: '#3d3d3d'
    }
  },
  inviteAcceptBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  }
};


=== frontend\src\components\Auth.jsx ===

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config/index.js';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${config.apiBaseUrl}/api/auth/google`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>
        
        <h1 style={styles.title}>
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
                autoFocus={!isLogin}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              autoFocus={isLogin}
            />
          </div>

          <div style={styles.inputGroup}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Continue' : 'Sign up')}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        <button style={styles.googleButton} onClick={handleGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div style={styles.footer}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={styles.link}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d0d',
    padding: '20px'
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    padding: '48px 40px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)'
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '32px',
    textAlign: 'center',
    color: '#ececec'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d',
    background: '#0d0d0d',
    color: '#ececec',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  button: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#8b5cf6',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  error: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    fontSize: '14px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  divider: {
    position: 'relative',
    textAlign: 'center',
    margin: '24px 0',
    '::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: '1px',
      background: '#2d2d2d'
    }
  },
  dividerText: {
    position: 'relative',
    background: '#1a1a1a',
    padding: '0 12px',
    color: '#6b6b6b',
    fontSize: '13px',
    fontWeight: '500'
  },
  googleButton: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d',
    background: 'transparent',
    color: '#ececec',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    fontFamily: 'inherit',
    width: '100%',
    transition: 'all 0.2s'
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
    color: '#6b6b6b'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#a78bfa',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
    fontFamily: 'inherit'
  }
};


=== frontend\src\components\Dashboard.jsx ===

import React, { useState, useEffect } from 'react';
import apiRequest from '../utils/api.js';

export default function Dashboard({ project, onClose, token, colors }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/decisions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDecisions(data.decisions);
      }
    } catch (e) {
      console.error('Decision load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDecisions = searchQuery.trim()
    ? decisions.filter(d =>
        d.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.rationale && d.rationale.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.proposedBy?.username && d.proposedBy.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : decisions;

  return (
    <div style={{ ...styles.page, background: colors.background }}>
      <div style={{ ...styles.header, background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div style={styles.headerLeft}>
          <button onClick={onClose} style={{ ...styles.backBtn, border: `1px solid ${colors.border}`, color: colors.text }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 style={{ ...styles.title, color: colors.text }}>Project Memory</h1>
            <p style={{ ...styles.subtitle, color: colors.textSecondary }}>Decision Log for {project.title}</p>
          </div>
        </div>
        <button onClick={loadDecisions} style={{ ...styles.refreshBtn, background: `${colors.border}60`, color: colors.text }} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Refresh
        </button>
      </div>

      <div style={styles.accentLine} />

      <div style={styles.content}>
        {/* Search input */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decisions..."
            style={{
              ...styles.searchInput,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text
            }}
          />
        </div>

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={{...styles.spinner, borderTopColor: '#667eea'}} />
            <p style={{ color: colors.textSecondary }}>Loading memories...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '32px', marginBottom: '16px' }}>💭</span>
            <h3 style={{ color: colors.text, margin: '0 0 8px 0' }}>
              {searchQuery ? 'No matching decisions' : 'No memory yet'}
            </h3>
            <p style={{ color: colors.textSecondary, margin: 0 }}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Click the bookmark button on any chat message to save important project context here.'}
            </p>
          </div>
        ) : (
          <div style={styles.decisionList}>
            {filteredDecisions.map((decision) => (
              <div key={decision._id} style={{ ...styles.decisionCard, background: colors.surface, border: `1px solid ${colors.border}` }}>
                <div style={styles.decisionHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...styles.decisionBadge, background: '#10b98120', color: '#10b981' }}>Decision</div>
                    <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                      {new Date(decision.timestamp).toLocaleDateString()} at {new Date(decision.timestamp).toLocaleTimeString([], {timeStyle: 'short'})}
                    </span>
                  </div>
                  {decision.sourceMessageId && (
                    <span
                      style={{ fontSize: '12px', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
                      title="Source message ID — click to copy"
                      onClick={() => {
                        navigator.clipboard.writeText(decision.sourceMessageId);
                      }}
                    >
                      View source
                    </span>
                  )}
                </div>
                
                <h3 style={{ ...styles.decisionText, color: colors.text }}>{decision.text}</h3>
                
                {decision.rationale && (
                  <p style={{ ...styles.decisionRationale, color: colors.textSecondary }}>
                    💡 {decision.rationale}
                  </p>
                )}
                
                <div style={{ ...styles.decisionFooter, borderTop: `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.textSecondary }}>Proposed by <strong style={{ color: colors.text }}>{decision.proposedBy?.username || 'Unknown'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 32px'
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: '16px'
  },
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '36px', height: '36px', padding: 0,
    background: 'transparent', borderRadius: '8px',
    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit'
  },
  title: {
    fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '13px', margin: '2px 0 0 0'
  },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s'
  },
  accentLine: {
    height: '2px',
    background: 'linear-gradient(90deg, #667eea 0%, #8b5cf6 30%, #10b981 60%, #f59e0b 100%)',
    opacity: 0.5
  },
  content: {
    padding: '32px', maxWidth: '800px', margin: '0 auto'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '400px', gap: '16px'
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    animation: 'spin 0.8s linear infinite'
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '64px', textAlign: 'center',
    borderRadius: '12px', background: 'rgba(0,0,0,0.02)'
  },
  decisionList: {
    display: 'flex', flexDirection: 'column', gap: '16px'
  },
  decisionCard: {
    borderRadius: '12px', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  decisionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  decisionBadge: {
    fontSize: '11px', fontWeight: '600', padding: '4px 8px',
    borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  decisionText: {
    fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0', lineHeight: '1.4'
  },
  decisionRationale: {
    fontSize: '14px', margin: 0, lineHeight: '1.5'
  },
  decisionFooter: {
    paddingTop: '12px', marginTop: '4px', fontSize: '13px',
    display: 'flex', alignItems: 'center'
  }
};


=== frontend\src\components\ModelSelector.jsx ===

import React, { useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdChevronRight } from 'react-icons/md';
import apiRequest from '../utils/api.js';

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    color: '#10a37f',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3', name: 'o3' },
      { id: 'o4-mini', name: 'o4-mini' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
      </svg>
    ),
    color: '#d4a574',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
    ]
  },
  google: {
    name: 'Google',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    color: '#4285F4',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' }
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
    ),
    color: '#00a6fb',
    comingSoon: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' }
    ]
  },
  xai: {
    name: 'xAI',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: '#ffffff',
    comingSoon: true,
    models: [
      { id: 'grok-2-latest', name: 'Grok 2' }
    ]
  },
  server: {
    name: 'Server',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    ),
    color: '#8b5cf6',
    models: [
      { id: 'server', name: 'Server' }
    ]
  }
};

export default function ModelSelector({ currentModel, onModelChange, projectId, token, colors = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  border: '#2d2d2d',
  text: '#ececec',
  textSecondary: '#b4b4b4',
  textTertiary: '#6b6b6b'
} }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentProviderInfo = PROVIDERS[currentModel.provider] || PROVIDERS.server;
  const currentModelInfo = currentProviderInfo.models.find(m => m.id === currentModel.model) || currentProviderInfo.models[0];

  const handleModelSelect = async (providerId, modelId) => {
    const newModel = { provider: providerId, model: modelId };
    
    try {
      const response = await apiRequest(`/api/projects/${projectId}/llm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activeLLM: newModel })
      });

      if (response.ok) {
        onModelChange(newModel);
        setShowDropdown(false);
        setSelectedProvider(null);
      }
    } catch (error) {
      console.error('Error updating model:', error);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await apiRequest(`/api/projects/${projectId}/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          provider: apiKeyProvider,
          apiKey: apiKey.trim()
        })
      });

      if (response.ok) {
        setShowApiKeyModal(false);
        setApiKey('');
        setApiKeyProvider(null);
        alert('API key saved successfully!');
      } else {
        alert('Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Error saving API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProviders = Object.entries(PROVIDERS).filter(([id, provider]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return provider.name.toLowerCase().includes(query) ||
           provider.models.some(m => m.name.toLowerCase().includes(query));
  });

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        style={{...styles.modelSelector, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text}}
      >
        <span style={{ fontSize: '18px' }}>{currentProviderInfo.icon}</span>
        <span style={{ fontWeight: '500' }}>{currentModelInfo.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {showDropdown && (
        <>
          <div style={styles.backdrop} onClick={() => {
            setShowDropdown(false);
            setSelectedProvider(null);
          }} />
          <div style={{...styles.dropdown, background: colors.surface, border: `1px solid ${colors.border}`}}>
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{...styles.searchInput, background: colors.background, color: colors.text, borderBottom: `1px solid ${colors.border}`}}
              autoFocus
            />
            
            <div style={styles.content}>
              {!selectedProvider ? (
                // Provider list
                filteredProviders.map(([id, provider]) => (
                  <div 
                    key={id} 
                    style={{
                      ...styles.providerRow,
                      opacity: provider.comingSoon ? 0.45 : 1,
                      cursor: provider.comingSoon ? 'default' : 'pointer'
                    }}
                    onClick={() => {
                      if (provider.comingSoon) return;
                      if (id === 'server') handleModelSelect('server', 'server');
                    }}
                    onMouseEnter={(e) => { if (!provider.comingSoon) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{...styles.providerIcon, color: provider.color}}>{provider.icon}</span>
                    <span style={{...styles.providerName, color: colors.text}}>{provider.name}</span>
                    {provider.comingSoon && (
                      <span style={styles.comingSoonBadge}>soon</span>
                    )}
                    <div style={{ flex: 1 }} />
                    
                    {/* Settings icon - only for non-server, non-dummy providers */}
                    {id !== 'server' && !provider.comingSoon && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setApiKeyProvider(id);
                          setShowApiKeyModal(true);
                          setShowDropdown(false);
                        }}
                        style={styles.iconBtn}
                        title="Set API Key"
                      >
                        <IoSettingsOutline size={18} />
                      </button>
                    )}

                    {/* Arrow icon - only for non-server, non-dummy providers */}
                    {id !== 'server' && !provider.comingSoon && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProvider(id);
                        }}
                        style={styles.iconBtn}
                        title="View Models"
                      >
                        <MdChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                // Model list
                <>
                  <div style={styles.backButton} onClick={() => setSelectedProvider(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Back to providers</span>
                  </div>
                  {PROVIDERS[selectedProvider].models.map(model => (
                    <div
                      key={model.id}
                      onClick={() => handleModelSelect(selectedProvider, model.id)}
                      style={{
                        ...styles.modelRow,
                        background: currentModel.provider === selectedProvider && currentModel.model === model.id 
                          ? 'rgba(16, 163, 127, 0.1)' 
                          : 'transparent'
                      }}
                      onMouseEnter={(e) => { if (!(currentModel.provider === selectedProvider && currentModel.model === model.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={(e) => { if (!(currentModel.provider === selectedProvider && currentModel.model === model.id)) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{...styles.modelName, color: colors.text}}>{model.name}</span>
                      {currentModel.provider === selectedProvider && currentModel.model === model.id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showApiKeyModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiKeyModal(false)}>
          <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}}>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <h3 style={{...styles.modalTitle, color: colors.text}}>Set API Key for {PROVIDERS[apiKeyProvider]?.name}</h3>
              <button onClick={() => setShowApiKeyModal(false)} style={styles.closeBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <p style={{...styles.modalDesc, color: colors.textSecondary}}>
                {apiKeyProvider === 'server' 
                  ? 'Server uses the backend AI. No configuration needed.'
                  : apiKeyProvider === 'openai'
                  ? 'Get your API key from platform.openai.com. Your key is stored encrypted per project.'
                  : apiKeyProvider === 'anthropic'
                  ? 'Get your API key from console.anthropic.com. Your key is stored encrypted per project.'
                  : apiKeyProvider === 'google'
                  ? 'Get your API key from aistudio.google.com. Your key is stored encrypted per project.'
                  : `Enter your ${PROVIDERS[apiKeyProvider]?.name} API key to use their models.`
                }
              </p>
              
              {apiKeyProvider !== 'server' && (
                <>
                  <label style={{...styles.inputLabel, color: colors.text}}>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${PROVIDERS[apiKeyProvider]?.name} API key`}
                    style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
                    autoFocus
                  />
                  
                  <div style={styles.modalActions}>
                    <button onClick={() => setShowApiKeyModal(false)} style={{...styles.cancelBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
                      Cancel
                    </button>
                    <button onClick={handleApiKeySubmit} style={styles.submitBtn} disabled={!apiKey.trim() || isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Key'}
                    </button>
                  </div>
                </>
              )}
              
              {apiKeyProvider === 'server' && (
                <div style={styles.modalActions}>
                  <button onClick={() => setShowApiKeyModal(false)} style={styles.submitBtn}>
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  modelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    minWidth: '360px',
    maxHeight: '500px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    background: '#0d0d0d',
    border: 'none',
    borderBottom: '1px solid #2d2d2d',
    borderRadius: '12px 12px 0 0',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  content: {
    padding: '8px 0'
  },
  providerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  providerIcon: {
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  providerName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec'
  },
  iconBtn: {
    padding: '6px',
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s'
  },
  comingSoonBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(139,92,246,0.2)',
    color: '#8b5cf6',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    cursor: 'pointer',
    color: '#6b6b6b',
    fontSize: '14px',
    borderBottom: '1px solid #2d2d2d'
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  modelName: {
    fontSize: '14px',
    color: '#ececec'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    minWidth: '500px',
    maxWidth: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    border: '1px solid #2d2d2d'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #2d2d2d'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  modalBody: {
    padding: '24px'
  },
  modalDesc: {
    fontSize: '14px',
    color: '#b4b4b4',
    marginBottom: '20px',
    lineHeight: '1.5'
  },
  inputLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: '20px'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600'
  }
};


=== frontend\src\components\Onboarding.jsx ===

import React, { useState } from 'react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to CollabAI! 🎉",
      description: "Your AI-powered collaboration workspace where teams work smarter together.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      ),
      color: '#8b5cf6'
    },
    {
      title: "Create Projects",
      description: "Start a new project and invite your team to collaborate in real-time. Each project has its own workspace with discussions, documents, and AI assistance.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      color: '#10a37f'
    },
    {
      title: "AI-Powered Discussions",
      description: "Mention @CollabAI in any discussion to get intelligent assistance. The AI understands your project context, documents, and conversation history.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      color: '#f59e0b'
    },
    {
      title: "Smart Insights",
      description: "Get automatic summaries, track decisions, identify blockers, and receive strategic signals about your project's progress.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18"/>
          <path d="M18 17V9"/>
          <path d="M13 17V5"/>
          <path d="M8 17v-3"/>
        </svg>
      ),
      color: '#3b82f6'
    }
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('onboarding-completed', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-completed', 'true');
    onComplete();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={handleSkip} style={styles.skipButton}>
          Skip
        </button>

        <div style={{
          ...styles.iconContainer,
          color: currentStep.color
        }}>
          {currentStep.icon}
        </div>

        <h2 style={styles.title}>{currentStep.title}</h2>
        <p style={styles.description}>{currentStep.description}</p>

        <div style={styles.dots}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                ...styles.dot,
                background: index === step ? '#8b5cf6' : '#2d2d2d'
              }}
            />
          ))}
        </div>

        <button onClick={handleNext} style={styles.button}>
          {step < steps.length - 1 ? 'Next' : 'Get Started'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease-out'
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '20px',
    padding: '60px 40px 40px',
    maxWidth: '500px',
    width: '90%',
    textAlign: 'center',
    border: '1px solid #2d2d2d',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    position: 'relative',
    animation: 'slideUp 0.4s ease-out'
  },
  skipButton: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
    animation: 'scaleIn 0.5s ease-out'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '16px',
    lineHeight: '1.3'
  },
  description: {
    fontSize: '16px',
    color: '#b4b4b4',
    lineHeight: '1.7',
    marginBottom: '40px',
    maxWidth: '400px',
    margin: '0 auto 40px'
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '32px'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'all 0.3s'
  },
  button: {
    width: '100%',
    padding: '16px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  }
};


=== frontend\src\components\ProfileModal.jsx ===

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import { toast } from 'react-toastify';
import apiRequest from '../utils/api.js';

export default function ProfileModal({ onClose }) {
  const { user, token, refreshAuth } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Profile form
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiRequest('/api/user/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, email, bio })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Profile updated successfully!');
        await refreshAuth();
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(colors);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Profile Settings</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={styles.content}>
          {/* Avatar Section */}
          <div style={styles.avatarSection}>
            <div style={{
              ...styles.avatar,
              background: getAvatarColor(user?.username)
            }}>
              {getInitials(user?.username)}
            </div>
            <div style={styles.avatarInfo}>
              <h3 style={styles.avatarName}>{user?.username}</h3>
              <p style={styles.avatarEmail}>{user?.email || 'No email set'}</p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.projectCount}</div>
                <div style={styles.statLabel}>Projects</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.messageCount}</div>
                <div style={styles.statLabel}>Messages</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {new Date(stats.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
                <div style={styles.statLabel}>Joined</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                ...styles.tab,
                ...(activeTab === 'profile' ? styles.tabActive : {})
              }}
            >
              Profile
            </button>
            {user?.authProvider === 'local' && (
              <button
                onClick={() => setActiveTab('password')}
                style={{
                  ...styles.tab,
                  ...(activeTab === 'password' ? styles.tabActive : {})
                }}
              >
                Password
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                    required
                    maxLength={20}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{...styles.input, minHeight: '80px', resize: 'vertical'}}
                    maxLength={200}
                    placeholder="Tell us about yourself..."
                  />
                  <div style={styles.charCount}>{bio.length}/200</div>
                </div>

                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handleChangePassword}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    required
                    minLength={6}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const getStyles = (colors) => ({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modal: {
    background: colors.surface,
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: `1px solid ${colors.border}`
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px',
    borderBottom: `1px solid ${colors.border}`
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    margin: 0
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textTertiary,
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  content: {
    padding: '24px'
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    padding: '20px',
    background: colors.background,
    borderRadius: '12px',
    border: `1px solid ${colors.border}`
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  avatarInfo: {
    flex: 1
  },
  avatarName: {
    fontSize: '18px',
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 4px 0'
  },
  avatarEmail: {
    fontSize: '14px',
    color: colors.textSecondary,
    margin: 0
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  statCard: {
    padding: '16px',
    background: colors.background,
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    textAlign: 'center'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: '0'
  },
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: colors.textSecondary,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  tabActive: {
    color: colors.primary,
    borderBottomColor: colors.primary
  },
  tabContent: {
    minHeight: '200px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: colors.text,
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  charCount: {
    fontSize: '12px',
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: '4px'
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    background: colors.primary,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s'
  }
});


=== frontend\src\components\ProjectList.jsx ===

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import apiRequest from '../utils/api.js';

export default function ProjectList({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { token, user, logout } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await apiRequest('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  return (
    <div style={{...styles.container, background: colors.background}}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        iconBarContent={
          <>
            <button 
              onClick={() => setShowCreateModal(true)} 
              style={styles.iconBarBtn}
              title="New project"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>

            <div style={{ flex: 1 }}></div>

            <div style={{
              ...styles.iconBarUser,
              background: getAvatarColor(user?.username)
            }}>
              {getInitials(user?.username)}
            </div>
          </>
        }
        footerContent={
          <button onClick={() => setShowJoinModal(true)} style={{...styles.footerBtn, color: colors.text}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Join project
          </button>
        }
      >
        <div style={{...styles.sidebarHeader, borderBottom: `1px solid ${colors.border}`}}>
          <button onClick={() => setShowCreateModal(true)} style={{...styles.newProjectBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>New project</span>
          </button>
        </div>

        <div style={styles.projectsList}>
          {projects.map(project => (
            <div
              key={project._id}
              onClick={() => onSelectProject(project)}
              style={{...styles.projectItem, color: colors.text}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={styles.projectTitle}>{project.title}</span>
            </div>
          ))}
        </div>
      </Sidebar>

      {/* Main content */}
      <div style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px'}}>

        <div style={styles.emptyState}>
          <div style={{...styles.emptyIcon, color: colors.textTertiary}}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h2 style={{...styles.emptyTitle, color: colors.text}}>CollabAI Workspace</h2>
          <p style={{...styles.emptyText, color: colors.textSecondary}}>
            Create a project to start collaborating with your team and AI
          </p>
          <div style={styles.emptyActions}>
            <button onClick={() => setShowCreateModal(true)} style={styles.primaryBtn}>
              Create new project
            </button>
            <button onClick={() => setShowJoinModal(true)} style={{...styles.secondaryBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
              Join existing project
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal 
          token={token}
          colors={colors}
          onClose={() => setShowCreateModal(false)}
          onCreated={(project) => {
            setShowCreateModal(false);
            loadProjects();
            onSelectProject(project);
          }}
        />
      )}

      {showJoinModal && (
        <JoinProjectModal 
          token={token}
          colors={colors}
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false);
            loadProjects();
          }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({ token, colors, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdProject, setCreatedProject] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, problemStatement })
      });

      const data = await response.json();
      if (data.success) {
        setCreatedProject(data.project);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInviteEmail = async () => {
    if (!emailInput.trim()) {
      alert('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch(
        `/api/projects/${createdProject._id}/invite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: emailInput.trim() })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert(`Invitation sent to ${emailInput}!`);
        setEmailInput('');
      } else {
        alert(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDone = () => {
    onCreated(createdProject);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={createdProject ? null : onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        {!createdProject ? (
          <>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <h2 style={{...styles.modalTitle, color: colors.text}}>Create new project</h2>
              <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={{...styles.label, color: colors.text}}>Project title</label>
                <input
                  type="text"
                  placeholder="e.g., Product Launch Planning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={{...styles.label, color: colors.text}}>Problem statement</label>
                <textarea
                  placeholder="Describe what you're trying to solve..."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text, minHeight: '120px', resize: 'vertical'}}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={onClose} style={{...styles.cancelBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <div style={styles.successIcon}>✓</div>
              <h2 style={{...styles.modalTitle, color: colors.text}}>Project Created!</h2>
            </div>
            
            <div style={styles.modalForm}>
              <p style={{...styles.successMessage, color: colors.text}}>
                Your project "{createdProject.title}" has been created successfully.
              </p>

              <div style={{...styles.inviteSection, background: colors.background, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.inviteTitle, color: colors.text}}>Invite Team Members</h3>
                <p style={{...styles.inviteDesc, color: colors.textSecondary}}>
                  Share this link with your team members to collaborate:
                </p>
                
                <div style={{...styles.inviteCodeBox, background: colors.background, border: `1px solid ${colors.border}`}}>
                  <code style={styles.inviteCode}>
                    {window.location.origin}/join/{createdProject.inviteCode}
                  </code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join/${createdProject.inviteCode}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{...styles.copyBtn, border: `1px solid ${colors.border}`, color: colors.text}}
                    title="Copy invite link"
                  >
                    {copied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div style={{...styles.inviteHint, color: colors.textTertiary}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <span>Anyone with this link can join your project</span>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                  <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>
                    Or send invitation via email:
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="email"
                      placeholder="teammate@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{
                        ...styles.input,
                        background: colors.background,
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        flex: 1,
                        marginBottom: 0
                      }}
                    />
                    <button
                      onClick={handleSendInviteEmail}
                      disabled={sendingEmail || !emailInput.trim()}
                      style={{
                        ...styles.submitBtn,
                        padding: '12px 20px',
                        opacity: sendingEmail || !emailInput.trim() ? 0.5 : 1
                      }}
                    >
                      {sendingEmail ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button onClick={handleDone} style={styles.submitBtn}>
                  Start Collaborating
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JoinProjectModal({ token, colors, onClose, onJoined }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [joinedProject, setJoinedProject] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest('/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode })
      });

      const data = await response.json();
      if (data.success) {
        setJoinedProject(data.project);
        setSuccess(true);
        // Immediately reload projects in parent
        onJoined();
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to join project');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    onJoined();
    onClose();
  };

  if (success && joinedProject) {
    return (
      <div style={styles.modalOverlay} onClick={handleSuccess}>
        <div style={{
          ...styles.modal,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          textAlign: 'center',
          padding: '40px'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16, 163, 127, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10a37f',
            margin: '0 auto 24px',
            animation: 'scaleIn 0.4s ease-out'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: colors.text, marginBottom: '12px' }}>
            Welcome to the Team!
          </h2>
          <p style={{ fontSize: '16px', color: colors.textSecondary, lineHeight: '1.6', marginBottom: '32px' }}>
            You've successfully joined "{joinedProject.title}". Start collaborating with your team now!
          </p>
          <button onClick={handleSuccess} style={{
            ...styles.submitBtn,
            width: '100%',
            background: '#10a37f'
          }}>
            Start Collaborating
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h2 style={{...styles.modalTitle, color: colors.text}}>Join project</h2>
          <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <div style={styles.formGroup}>
            <label style={{...styles.label, color: colors.text}}>Invite code</label>
            <input
              type="text"
              placeholder="Enter 8-character code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
              required
              autoFocus
              maxLength={8}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={{...styles.cancelBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Joining...' : 'Join project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '48px',
    height: '100vh',
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 200,
    borderRight: '1px solid #2d2d2d'
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  iconBarUser: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  sidebar: {
    position: 'fixed',
    left: '48px',
    top: 0,
    width: '260px',
    height: '100vh',
    background: '#171717',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #2d2d2d'
  },
  sidebarHeader: {
    padding: '12px'
  },
  newProjectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  projectsList: {
    flex: 1,
    overflowY: 'auto',
    marginTop: '8px'
  },
  projectItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontSize: '14px',
    marginBottom: '2px'
  },
  projectTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sidebarFooter: {
    borderTop: '1px solid #2d2d2d',
    paddingTop: '12px',
    marginTop: '12px'
  },
  footerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
    marginBottom: '8px'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    background: 'transparent'
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    minWidth: 0
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#6b6b6b',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    transition: 'color 0.2s'
  },
  toggleBtn: {
    position: 'fixed',
    left: '16px',
    top: '16px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    padding: '8px',
    color: '#ececec',
    cursor: 'pointer',
    zIndex: 101,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'margin-left 0.3s ease',
    position: 'relative'
  },
  closeSidebarBtn: {
    position: 'absolute',
    left: '16px',
    top: '16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    color: '#ececec',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    textAlign: 'center',
    maxWidth: '600px',
    padding: '40px'
  },
  emptyIcon: {
    marginBottom: '24px'
  },
  emptyTitle: {
    fontSize: '32px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '16px',
    marginBottom: '32px',
    lineHeight: '1.6'
  },
  emptyActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  primaryBtn: {
    padding: '12px 24px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  secondaryBtn: {
    padding: '12px 24px',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600'
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalForm: {
    padding: '24px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  error: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  successIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#8b5cf6',
    margin: '0 auto 16px'
  },
  successMessage: {
    fontSize: '15px',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  inviteSection: {
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px'
  },
  inviteTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px'
  },
  inviteDesc: {
    fontSize: '14px',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  inviteCodeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '12px'
  },
  inviteCode: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '500',
    color: '#8b5cf6',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  copyBtn: {
    padding: '8px',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  inviteHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '13px',
    lineHeight: '1.4'
  }
};


=== frontend\src\components\ProjectWorkspace.jsx ===

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ModelSelector from './ModelSelector';
import Sidebar from './Sidebar';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import apiRequest, { getWsUrl } from '../utils/api.js';
import Dashboard from './Dashboard';

export default function ProjectWorkspace({ project, onBack }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [discussions, setDiscussions] = useState([]);
  const [currentDiscussion, setCurrentDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSummaries, setShowSummaries] = useState(false);
  const [showAllSummaries, setShowAllSummaries] = useState(false);
  const [showCreateDiscussion, setShowCreateDiscussion] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInviteToDiscussion, setShowInviteToDiscussion] = useState(false);
  const [inviteDiscussionId, setInviteDiscussionId] = useState(null);
  const [currentModel, setCurrentModel] = useState(project.activeLLM || { provider: 'groq', model: 'llama-3.1-8b-instant' });
  
  // State awareness
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting, connected, disconnected, reconnecting
  const [aiThinking, setAiThinking] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingTextRef = useRef('');
  
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const isOwner = project.ownerId._id === user._id;

  useEffect(() => {
    loadDiscussions();
  }, [project]);

  // Check for pending discussion ID from invite link
  useEffect(() => {
    const pendingDiscussionId = sessionStorage.getItem('pendingDiscussionId');
    if (pendingDiscussionId && discussions.length > 0) {
      const discussion = discussions.find(d => d._id === pendingDiscussionId);
      if (discussion) {
        setCurrentDiscussion(discussion);
        sessionStorage.removeItem('pendingDiscussionId');
      }
    }
  }, [discussions]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    if (currentDiscussion && ws && ws.readyState === WebSocket.OPEN) {
      console.log('Joining discussion:', currentDiscussion._id);
      ws.send(JSON.stringify({
        type: 'join-project',
        projectId: project._id,
        discussionId: currentDiscussion._id
      }));
    }
  }, [currentDiscussion, ws, ws?.readyState]);

  // Auto-scroll during streaming — only if user is near bottom, use instant to prevent jitter
  const messagesContainerRef = useRef(null);
  useEffect(() => {
    if (!isStreaming && !aiThinking) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is within 150px of bottom (not scrolled up reading history)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [streamingText, isStreaming, aiThinking]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll to bottom when returning to chat view
  useEffect(() => {
    if (!showDashboard && !showDocuments && !showSettings && !showSummaries && messages.length > 0) {
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [showDashboard, showDocuments, showSettings, showSummaries]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Check for @ mentions
  useEffect(() => {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === input.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1) {
      const afterAt = input.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionSearch(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [input]);

  const loadDiscussions = async () => {
    setIsLoadingDiscussions(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        const userDiscussions = data.discussions.filter(d => {
          if (isOwner) return true;
          if (d.isMain) return true;
          return d.participants?.some(p => p._id === user._id);
        });
        
        setDiscussions(userDiscussions);
        const main = userDiscussions.find(d => d.isMain);
        if (main && !currentDiscussion) {
          setCurrentDiscussion(main);
        }
      }
    } catch (error) {
      console.error('Error loading discussions:', error);
    } finally {
      setIsLoadingDiscussions(false);
    }
  };

  const connectWebSocket = () => {
    setWsStatus('connecting');
    const wsUrl = getWsUrl();
    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      socket.send(JSON.stringify({ type: 'auth', token }));
      
      // If we already have a current discussion, join it
      if (currentDiscussion) {
        console.log('Auto-joining discussion on connect:', currentDiscussion._id);
        socket.send(JSON.stringify({
          type: 'join-project',
          projectId: project._id,
          discussionId: currentDiscussion._id
        }));
      }
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === 'discussion-joined') {
        setMessages(data.messages);
        setIsLoadingMessages(false);
      } else if (data.type === 'project-chat') {
        setMessages(prev => prev.some(m => m._id && m._id === data.message._id) ? prev : [...prev, data.message]);
        setIsSendingMessage(false);
        if (data.message.isAI) {
          setAiThinking(false);
        }
      } else if (data.type === 'ai-stream-start') {
        setAiThinking(false);
        setIsStreaming(true);
        setStreamingText('');
        streamingTextRef.current = '';
        setIsSendingMessage(false);
      } else if (data.type === 'ai-stream-chunk') {
        streamingTextRef.current += data.chunk;
        setStreamingText(streamingTextRef.current);
      } else if (data.type === 'ai-stream-end') {
        setIsStreaming(false);
        setStreamingText('');
        streamingTextRef.current = '';
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      } else if (data.type === 'ai-error') {
        setAiThinking(false);
        setIsStreaming(false);
        setStreamingText('');
        streamingTextRef.current = '';
        setIsSendingMessage(false);
      } else if (data.type === 'error') {
        setIsSendingMessage(false);
        setAiThinking(false);
        setIsStreaming(false);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setWsStatus('disconnected');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (wsStatus !== 'connected') {
          setWsStatus('reconnecting');
          connectWebSocket();
        }
      }, 3000);
    };

    