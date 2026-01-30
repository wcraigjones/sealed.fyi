/**
 * sealed.fyi - API Client Module
 * 
 * Handles all communication with the sealed.fyi backend API.
 * Implements the REST API contract defined in docs/API.md.
 */

// =============================================================================
// Configuration
// =============================================================================

// API base URL - can be overridden for testing or different environments
let API_BASE = '/api';

/**
 * Set the API base URL.
 * @param {string} baseUrl
 */
function setApiBase(baseUrl) {
  API_BASE = baseUrl;
}

/**
 * Get the current API base URL.
 * @returns {string}
 */
function getApiBase() {
  return API_BASE;
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base class for API errors.
 */
class ApiError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Error for invalid or expired tokens.
 */
class InvalidTokenError extends ApiError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401, 'invalid_token');
    this.name = 'InvalidTokenError';
  }
}

/**
 * Error for invalid proof-of-work.
 */
class InvalidPowError extends ApiError {
  constructor(message = 'Invalid proof-of-work') {
    super(message, 403, 'invalid_pow');
    this.name = 'InvalidPowError';
  }
}

/**
 * Error for validation failures.
 */
class ValidationError extends ApiError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'invalid_request');
    this.name = 'ValidationError';
  }
}

/**
 * Error when secret is not available.
 */
class NotAvailableError extends ApiError {
  constructor(message = 'Secret not available') {
    super(message, 404, 'not_available');
    this.name = 'NotAvailableError';
  }
}

/**
 * Error for network failures.
 */
class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message);
    this.name = 'NetworkError';
  }
}

// =============================================================================
// Request Helper
// =============================================================================

/**
 * Make an API request with error handling.
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {ApiError|NetworkError}
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Set default headers
  const headers = {
    ...options.headers
  };
  
  // Add Content-Type for requests with body
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle 204 No Content (burn endpoint)
    if (response.status === 204) {
      return null;
    }
    
    // Parse JSON response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If JSON parsing fails on error response, create generic error
      if (!response.ok) {
        throw new ApiError('Request failed', response.status, 'unknown');
      }
      throw new ApiError('Invalid response format', response.status, 'parse_error');
    }
    
    // Handle error responses
    if (!response.ok) {
      const errorCode = data.error || 'unknown';
      const message = data.message || data.error || 'Request failed';
      
      switch (response.status) {
        case 400:
          throw new ValidationError(message);
        case 401:
          throw new InvalidTokenError(message);
        case 403:
          throw new InvalidPowError(message);
        case 404:
          throw new NotAvailableError(message);
        default:
          throw new ApiError(message, response.status, errorCode);
      }
    }
    
    return data;
  } catch (error) {
    // Re-throw API errors
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Wrap network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError('Failed to connect to server');
    }
    
    // Wrap other errors
    throw new NetworkError(error.message || 'Network error');
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Request an authorization token for creating a secret.
 * POST /token
 * 
 * @returns {Promise<{token: string, nonce: string, powChallenge: {difficulty: number, prefix: string}, expiresAt: number}>}
 * @throws {ApiError|NetworkError}
 */
async function getToken() {
  return apiRequest('/token', {
    method: 'POST'
  });
}

/**
 * Create a new encrypted secret.
 * POST /secrets
 * 
 * @param {string} token - Authorization token from getToken()
 * @param {{ciphertext: string, iv: string, salt: string|null, nonce: string, pow: string, ttl: number, maxViews: number, passphraseProtected: boolean}} request
 * @returns {Promise<{id: string, burnToken: string, expiresAt: number}>}
 * @throws {ApiError|NetworkError}
 */
async function createSecret(token, request) {
  return apiRequest('/secrets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(request)
  });
}

/**
 * Retrieve an encrypted secret.
 * GET /secrets/{id}
 * 
 * @param {string} id - Secret identifier
 * @param {string} [accessToken] - Optional idempotency token from previous access
 * @returns {Promise<{ciphertext: string, iv: string, salt: string|null, passphraseProtected: boolean, accessToken: string}>}
 * @throws {ApiError|NetworkError}
 */
async function getSecret(id, accessToken) {
  let endpoint = `/secrets/${encodeURIComponent(id)}`;
  
  if (accessToken) {
    endpoint += `?accessToken=${encodeURIComponent(accessToken)}`;
  }
  
  return apiRequest(endpoint, {
    method: 'GET'
  });
}

/**
 * Burn (delete) a secret early.
 * DELETE /secrets/{id}
 * 
 * @param {string} id - Secret identifier
 * @param {string} burnToken - Burn token received at creation
 * @returns {Promise<void>}
 * @throws {NetworkError} Only network errors - burn always returns 204
 */
async function burnSecret(id, burnToken) {
  await apiRequest(`/secrets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'X-Burn-Token': burnToken
    }
  });
}

// =============================================================================
// Exports (for both browser and testing)
// =============================================================================

// Check if running in Node.js environment (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Configuration
    setApiBase,
    getApiBase,
    
    // Error classes
    ApiError,
    InvalidTokenError,
    InvalidPowError,
    ValidationError,
    NotAvailableError,
    NetworkError,
    
    // API functions
    apiRequest,
    getToken,
    createSecret,
    getSecret,
    burnSecret
  };
}
