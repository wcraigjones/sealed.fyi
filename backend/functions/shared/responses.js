/**
 * Uniform HTTP response builders for sealed.fyi Lambda functions.
 * Ensures consistent response format across all endpoints.
 * 
 * CRITICAL: All error responses must be uniform to prevent oracle attacks.
 */

/**
 * Common headers for all responses
 */
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

/**
 * Build a successful response
 * @param {Object} body - Response body object
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {Object} API Gateway response object
 */
export function success(body, statusCode = 200) {
  return {
    statusCode,
    headers: BASE_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Build a 201 Created response
 * @param {Object} body - Response body object
 * @returns {Object} API Gateway response object
 */
export function created(body) {
  return {
    statusCode: 201,
    headers: BASE_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Build a 404 Not Available response
 * CRITICAL: This response must be IDENTICAL for all "not found" scenarios:
 * - Secret doesn't exist
 * - Secret is expired
 * - Secret is consumed
 * - Secret was burned
 * - Malformed ID
 * 
 * This prevents oracle attacks that could reveal secret state.
 * @returns {Object} API Gateway response object
 */
export function notAvailable() {
  return {
    statusCode: 404,
    headers: BASE_HEADERS,
    body: JSON.stringify({ error: 'not_available' })
  };
}

/**
 * Build a 204 No Content response
 * Used for successful deletions (burn secret).
 * @returns {Object} API Gateway response object
 */
export function noContent() {
  return {
    statusCode: 204,
    headers: {
      'Cache-Control': 'no-store'
    },
    body: ''
  };
}

/**
 * Build a 400 Bad Request response
 * @param {string} message - Error message describing the validation failure
 * @returns {Object} API Gateway response object
 */
export function badRequest(message) {
  return {
    statusCode: 400,
    headers: BASE_HEADERS,
    body: JSON.stringify({
      error: 'invalid_request',
      message: message
    })
  };
}

/**
 * Build a 401 Unauthorized response
 * Used when authorization token is missing, invalid, or expired.
 * @returns {Object} API Gateway response object
 */
export function unauthorized() {
  return {
    statusCode: 401,
    headers: BASE_HEADERS,
    body: JSON.stringify({ error: 'invalid_token' })
  };
}

/**
 * Build a 403 Forbidden response
 * Used when proof-of-work verification fails.
 * @returns {Object} API Gateway response object
 */
export function forbidden() {
  return {
    statusCode: 403,
    headers: BASE_HEADERS,
    body: JSON.stringify({ error: 'invalid_pow' })
  };
}

export default {
  success,
  created,
  notAvailable,
  noContent,
  badRequest,
  unauthorized,
  forbidden
};
