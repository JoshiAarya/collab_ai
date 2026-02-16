/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and logging
 */

import logger from '../utils/logger.js';
import config from '../config/index.js';

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'AI service unavailable', details = null) {
    super(message, 503, 'AI_SERVICE_ERROR', details);
  }
}

// Error handler middleware
export function errorHandler(err, req, res, next) {
  let error = err;

  // Convert non-AppError errors
  if (!(error instanceof AppError)) {
    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      error = new ValidationError('Validation failed', details);
    }
    // Mongoose cast errors
    else if (error.name === 'CastError') {
      error = new ValidationError(`Invalid ${error.path}: ${error.value}`);
    }
    // Mongoose duplicate key errors
    else if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      error = new ConflictError(`${field} already exists`);
    }
    // JWT errors
    else if (error.name === 'JsonWebTokenError') {
      error = new AuthenticationError('Invalid token');
    }
    else if (error.name === 'TokenExpiredError') {
      error = new AuthenticationError('Token expired');
    }
    // Generic errors
    else {
      error = new AppError(
        config.isDevelopment ? error.message : 'Internal server error',
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  // Log error
  logger.error(error.message, {
    code: error.code,
    statusCode: error.statusCode,
    stack: config.isDevelopment ? error.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    details: error.details
  });

  // Send response
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code
    }
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (config.isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
}

// Async handler wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req, res, next) {
  next(new NotFoundError('Route'));
}
