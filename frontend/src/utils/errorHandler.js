/**
 * Error Handler Utility
 * Provides user-friendly error messages and error classification
 */

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error) {
  // Network errors
  if (error.code === 'NETWORK_ERROR') {
    return 'Unable to connect. Please check your internet connection.';
  }

  // Authentication errors
  if (error.code === 'AUTHENTICATION_ERROR' || error.statusCode === 401) {
    return 'Your session has expired. Please log in again.';
  }

  // Authorization errors
  if (error.code === 'AUTHORIZATION_ERROR' || error.statusCode === 403) {
    return 'You don\'t have permission to perform this action.';
  }

  // Validation errors
  if (error.code === 'VALIDATION_ERROR' || error.statusCode === 400) {
    if (error.details && Array.isArray(error.details)) {
      return error.details.join(', ');
    }
    return error.message || 'Invalid input. Please check your data.';
  }

  // Not found errors
  if (error.code === 'NOT_FOUND' || error.statusCode === 404) {
    return 'The requested resource was not found.';
  }

  // Conflict errors
  if (error.code === 'CONFLICT' || error.statusCode === 409) {
    return error.message || 'This resource already exists.';
  }

  // Rate limit errors
  if (error.code === 'RATE_LIMIT_EXCEEDED' || error.statusCode === 429) {
    return 'Too many requests. Please slow down and try again.';
  }

  // AI service errors
  if (error.code === 'AI_SERVICE_ERROR' || error.statusCode === 503) {
    return 'AI service is temporarily unavailable. Please try again.';
  }

  // Server errors
  if (error.statusCode >= 500) {
    return 'Server error. Our team has been notified.';
  }

  // Default message
  return error.message || 'Something went wrong. Please try again.';
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error) {
  const recoverableCodes = [
    'NETWORK_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'AI_SERVICE_ERROR'
  ];

  const recoverableStatusCodes = [408, 429, 503, 504];

  return (
    recoverableCodes.includes(error.code) ||
    recoverableStatusCodes.includes(error.statusCode)
  );
}

/**
 * Check if error requires re-authentication
 */
export function requiresReauth(error) {
  return (
    error.code === 'AUTHENTICATION_ERROR' ||
    error.statusCode === 401 ||
    error.message?.includes('token') ||
    error.message?.includes('expired')
  );
}

/**
 * Log error for debugging
 */
export function logError(error, context = {}) {
  if (import.meta.env.MODE === 'development') {
    console.error('Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      context,
      stack: error.stack
    });
  }
}

/**
 * Handle API error with user feedback
 */
export function handleAPIError(error, showToast) {
  const message = getUserFriendlyMessage(error);
  logError(error);

  if (showToast) {
    showToast(message, 'error');
  }

  // Check if requires re-authentication
  if (requiresReauth(error)) {
    // Trigger logout
    localStorage.removeItem('collab-ai-token');
    window.location.reload();
  }

  return message;
}
