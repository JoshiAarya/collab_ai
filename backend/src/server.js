import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/index.js";
import logger from "./utils/logger.js";
import connectDB from "./config/database.js";
import connectionManager from "./services/connectionManager.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { sanitize } from "./middleware/validation.js";

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
        }
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
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // 404 handler for development
  app.use(notFoundHandler);
}

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

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    connectionManager.shutdown();
    process.exit(0);
  });
});

logger.info('CollabAI Server ready', {
  version: '1.0.0',
  environment: config.nodeEnv
});

