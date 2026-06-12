import express from 'express';
import authRoutes from '../../src/routes/auth.js';
import projectRoutes from '../../src/routes/projects.js';
import userRoutes from '../../src/routes/user.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { sanitize } from '../../src/middleware/validation.js';

/**
 * Express app wired exactly like src/server.js minus the listeners,
 * WebSocket server, Swagger, and static serving — for supertest.
 */
export function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(sanitize);
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/user', userRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
