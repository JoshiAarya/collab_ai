/**
 * Request Validation Middleware
 * Validates and sanitizes incoming requests
 */

import { ValidationError } from './errorHandler.js';

// Simple validation helpers (can be replaced with Joi/Zod later)
export const validators = {
  isEmail(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  isString(value, minLength = 0, maxLength = Infinity) {
    return (
      typeof value === 'string' &&
      value.trim().length >= minLength &&
      value.trim().length <= maxLength
    );
  },

  isObjectId(value) {
    return /^[0-9a-fA-F]{24}$/.test(value);
  },

  isEnum(value, allowedValues) {
    return allowedValues.includes(value);
  },

  isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
};

// Validation schemas
export const schemas = {
  // Auth schemas
  register: {
    username: { type: 'string', required: true, min: 2, max: 50 },
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6, max: 100 }
  },

  login: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true }
  },

  // Project schemas
  createProject: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    problemStatement: { type: 'string', required: true, min: 1, max: 5000 }
  },

  updateProject: {
    title: { type: 'string', required: false, min: 1, max: 200 },
    description: { type: 'string', required: false, max: 5000 },
    stage: { 
      type: 'enum', 
      required: false, 
      values: ['ideation', 'design', 'discussion', 'blocked', 'completed'] 
    }
  },

  joinProject: {
    inviteCode: { type: 'string', required: true, min: 8, max: 8 }
  },

  updateLLM: {
    activeLLM: { type: 'object', required: true }
  },

  // Discussion schemas
  createDiscussion: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    description: { type: 'string', required: false, max: 1000 },
    parentDiscussionId: { type: 'objectId', required: false }
  },

  // Document schemas
  uploadDocument: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    content: { type: 'string', required: true, min: 1, max: 1000000 },
    fileType: { type: 'string', required: false, max: 100 }
  },

  // Message schemas
  sendMessage: {
    text: { type: 'string', required: true, min: 1, max: 10000 }
  }
};

// Validate function
function validateField(fieldName, value, rules) {
  const errors = [];

  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip further validation if not required and empty
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  switch (rules.type) {
    case 'string':
      if (!validators.isString(value, rules.min, rules.max)) {
        if (rules.min && rules.max) {
          errors.push(`${fieldName} must be between ${rules.min} and ${rules.max} characters`);
        } else if (rules.min) {
          errors.push(`${fieldName} must be at least ${rules.min} characters`);
        } else if (rules.max) {
          errors.push(`${fieldName} must be at most ${rules.max} characters`);
        } else {
          errors.push(`${fieldName} must be a string`);
        }
      }
      break;

    case 'email':
      if (!validators.isEmail(value)) {
        errors.push(`${fieldName} must be a valid email`);
      }
      break;

    case 'objectId':
      if (!validators.isObjectId(value)) {
        errors.push(`${fieldName} must be a valid ID`);
      }
      break;

    case 'enum':
      if (!validators.isEnum(value, rules.values)) {
        errors.push(`${fieldName} must be one of: ${rules.values.join(', ')}`);
      }
      break;

    case 'object':
      if (!validators.isObject(value)) {
        errors.push(`${fieldName} must be an object`);
      }
      break;
  }

  return errors;
}

// Validation middleware factory
export function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    // Body takes precedence — query params must never shadow validated body fields
    const data = { ...req.query, ...req.params, ...req.body };
    const errors = [];

    // Validate each field
    for (const [fieldName, rules] of Object.entries(schema)) {
      const fieldErrors = validateField(fieldName, data[fieldName], rules);
      errors.push(...fieldErrors);
    }

    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
}

// Sanitize input
export function sanitize(req, res, next) {
  // Trim strings in body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
}
