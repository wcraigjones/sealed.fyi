'use strict';

// Standard headers for all responses
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

/**
 * Build an API Gateway response object
 * @param {number} statusCode - HTTP status code
 * @param {object|null} body - Response body (will be JSON stringified)
 * @param {object} [additionalHeaders={}] - Additional headers to include
 * @returns {object} API Gateway response object
 */
function buildResponse(statusCode, body, additionalHeaders = {}) {
  const response = {
    statusCode,
    headers: {
      ...BASE_HEADERS,
      ...additionalHeaders
    }
  };

  if (body !== null) {
    response.body = JSON.stringify(body);
  } else {
    response.body = '';
  }

  return response;
}

/**
 * Success response (200 OK)
 * @param {object} body - Response body
 * @param {number} [statusCode=200] - Optional status code override
 * @returns {object} API Gateway response
 */
function success(body, statusCode = 200) {
  return buildResponse(statusCode, body);
}

/**
 * Created response (201 Created)
 * @param {object} body - Response body
 * @returns {object} API Gateway response
 */
function created(body) {
  return buildResponse(201, body);
}

/**
 * Not available response (404 Not Found)
 * Used for missing, expired, and consumed secrets - MUST be identical in all cases
 * @returns {object} API Gateway response
 */
function notAvailable() {
  return buildResponse(404, { error: 'not_available' });
}

/**
 * No content response (204 No Content)
 * Used for successful burn operations
 * @returns {object} API Gateway response
 */
function noContent() {
  return {
    statusCode: 204,
    headers: {
      'Cache-Control': 'no-store'
    },
    body: ''
  };
}

/**
 * Bad request response (400 Bad Request)
 * @param {string} message - Error message describing the validation failure
 * @returns {object} API Gateway response
 */
function badRequest(message) {
  return buildResponse(400, {
    error: 'invalid_request',
    message: message
  });
}

/**
 * Unauthorized response (401 Unauthorized)
 * Used when token is missing, expired, or invalid
 * @returns {object} API Gateway response
 */
function unauthorized() {
  return buildResponse(401, { error: 'invalid_token' });
}

/**
 * Forbidden response (403 Forbidden)
 * Used when proof-of-work is invalid
 * @returns {object} API Gateway response
 */
function forbidden() {
  return buildResponse(403, { error: 'invalid_pow' });
}

/**
 * Internal server error response (500 Internal Server Error)
 * @returns {object} API Gateway response
 */
function internalError() {
  return buildResponse(500, { error: 'internal_error' });
}

module.exports = {
  success,
  created,
  notAvailable,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  internalError,
  // For testing
  _internal: {
    buildResponse,
    BASE_HEADERS
  }
};
