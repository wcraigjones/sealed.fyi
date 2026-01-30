/**
 * sealed.fyi - API Client Tests
 * 
 * Run with: npx vitest run api.test.js
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import the API module
const {
  setApiBase,
  getApiBase,
  ApiError,
  InvalidTokenError,
  InvalidPowError,
  ValidationError,
  NotAvailableError,
  NetworkError,
  apiRequest,
  getToken,
  createSecret,
  getSecret,
  burnSecret
} = await import('./api.js');

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  setApiBase('/api'); // Reset to default
});

// =============================================================================
// Helper Functions
// =============================================================================

function mockJsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  });
}

function mockNoContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('No content'))
  });
}

function mockNetworkError() {
  const error = new TypeError('Failed to fetch');
  return Promise.reject(error);
}

// =============================================================================
// Configuration Tests
// =============================================================================

describe('Configuration', () => {
  test('default API base is /api', () => {
    expect(getApiBase()).toBe('/api');
  });
  
  test('setApiBase changes the base URL', () => {
    setApiBase('https://api.example.com');
    expect(getApiBase()).toBe('https://api.example.com');
  });
});

// =============================================================================
// Error Classes Tests
// =============================================================================

describe('Error Classes', () => {
  test('ApiError has correct properties', () => {
    const error = new ApiError('Test message', 400, 'test_error');
    
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('test_error');
    expect(error.name).toBe('ApiError');
  });
  
  test('InvalidTokenError has correct defaults', () => {
    const error = new InvalidTokenError();
    
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('invalid_token');
    expect(error.name).toBe('InvalidTokenError');
  });
  
  test('InvalidPowError has correct defaults', () => {
    const error = new InvalidPowError();
    
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe('invalid_pow');
    expect(error.name).toBe('InvalidPowError');
  });
  
  test('ValidationError has correct defaults', () => {
    const error = new ValidationError();
    
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('invalid_request');
    expect(error.name).toBe('ValidationError');
  });
  
  test('NotAvailableError has correct defaults', () => {
    const error = new NotAvailableError();
    
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('not_available');
    expect(error.name).toBe('NotAvailableError');
  });
  
  test('NetworkError has correct name', () => {
    const error = new NetworkError('Connection failed');
    
    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('Connection failed');
  });
});

// =============================================================================
// apiRequest Tests
// =============================================================================

describe('apiRequest', () => {
  test('makes request to correct URL', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ success: true }));
    
    await apiRequest('/test-endpoint');
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test-endpoint',
      expect.any(Object)
    );
  });
  
  test('adds Content-Type header for POST with body', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ success: true }));
    
    await apiRequest('/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' })
    });
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });
  
  test('returns parsed JSON response', async () => {
    const responseData = { id: '123', value: 'test' };
    mockFetch.mockReturnValueOnce(mockJsonResponse(responseData));
    
    const result = await apiRequest('/test');
    
    expect(result).toEqual(responseData);
  });
  
  test('returns null for 204 No Content', async () => {
    mockFetch.mockReturnValueOnce(mockNoContentResponse());
    
    const result = await apiRequest('/test');
    
    expect(result).toBeNull();
  });
  
  test('throws ValidationError for 400 response', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'invalid_request', message: 'Bad input' },
      400
    ));
    
    await expect(apiRequest('/test')).rejects.toThrow(ValidationError);
  });
  
  test('throws InvalidTokenError for 401 response', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'invalid_token' },
      401
    ));
    
    await expect(apiRequest('/test')).rejects.toThrow(InvalidTokenError);
  });
  
  test('throws InvalidPowError for 403 response', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'invalid_pow' },
      403
    ));
    
    await expect(apiRequest('/test')).rejects.toThrow(InvalidPowError);
  });
  
  test('throws NotAvailableError for 404 response', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'not_available' },
      404
    ));
    
    await expect(apiRequest('/test')).rejects.toThrow(NotAvailableError);
  });
  
  test('throws NetworkError for fetch failures', async () => {
    mockFetch.mockReturnValueOnce(mockNetworkError());
    
    await expect(apiRequest('/test')).rejects.toThrow(NetworkError);
  });
});

// =============================================================================
// getToken Tests
// =============================================================================

describe('getToken', () => {
  test('makes POST request to /token', async () => {
    const tokenResponse = {
      token: 'jwt-token',
      nonce: 'abc123',
      powChallenge: { difficulty: 18, prefix: 'sealed:' },
      expiresAt: 1706745600
    };
    mockFetch.mockReturnValueOnce(mockJsonResponse(tokenResponse));
    
    const result = await getToken();
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual(tokenResponse);
  });
});

// =============================================================================
// createSecret Tests
// =============================================================================

describe('createSecret', () => {
  const validRequest = {
    ciphertext: 'base64ciphertext',
    iv: 'base64iv',
    salt: null,
    nonce: 'abc123',
    pow: '12345',
    ttl: 86400,
    maxViews: 1,
    passphraseProtected: false
  };
  
  test('makes POST request to /secrets with auth header', async () => {
    const createResponse = {
      id: 'secretId123',
      burnToken: 'burnToken456',
      expiresAt: 1706832000
    };
    mockFetch.mockReturnValueOnce(mockJsonResponse(createResponse, 201));
    
    const result = await createSecret('jwt-token', validRequest);
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/secrets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer jwt-token'
        }),
        body: JSON.stringify(validRequest)
      })
    );
    expect(result).toEqual(createResponse);
  });
  
  test('throws InvalidTokenError on 401', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'invalid_token' },
      401
    ));
    
    await expect(createSecret('bad-token', validRequest))
      .rejects.toThrow(InvalidTokenError);
  });
  
  test('throws InvalidPowError on 403', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'invalid_pow' },
      403
    ));
    
    await expect(createSecret('jwt-token', validRequest))
      .rejects.toThrow(InvalidPowError);
  });
});

// =============================================================================
// getSecret Tests
// =============================================================================

describe('getSecret', () => {
  test('makes GET request to /secrets/{id}', async () => {
    const secretResponse = {
      ciphertext: 'base64ciphertext',
      iv: 'base64iv',
      salt: null,
      passphraseProtected: false,
      accessToken: 'accessToken123'
    };
    mockFetch.mockReturnValueOnce(mockJsonResponse(secretResponse));
    
    const result = await getSecret('secretId123');
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/secrets/secretId123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(secretResponse);
  });
  
  test('includes accessToken in query params', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ ciphertext: 'test' }));
    
    await getSecret('secretId123', 'accessToken456');
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/secrets/secretId123?accessToken=accessToken456',
      expect.any(Object)
    );
  });
  
  test('URL-encodes special characters in id', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ ciphertext: 'test' }));
    
    await getSecret('secret/with/slashes');
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/secrets/secret%2Fwith%2Fslashes',
      expect.any(Object)
    );
  });
  
  test('throws NotAvailableError on 404', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(
      { error: 'not_available' },
      404
    ));
    
    await expect(getSecret('nonexistent'))
      .rejects.toThrow(NotAvailableError);
  });
});

// =============================================================================
// burnSecret Tests
// =============================================================================

describe('burnSecret', () => {
  test('makes DELETE request with X-Burn-Token header', async () => {
    mockFetch.mockReturnValueOnce(mockNoContentResponse());
    
    await burnSecret('secretId123', 'burnToken456');
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/secrets/secretId123',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'X-Burn-Token': 'burnToken456'
        })
      })
    );
  });
  
  test('returns undefined on success (204)', async () => {
    mockFetch.mockReturnValueOnce(mockNoContentResponse());
    
    const result = await burnSecret('secretId123', 'burnToken456');
    
    expect(result).toBeUndefined();
  });
  
  test('throws NetworkError on network failure', async () => {
    mockFetch.mockReturnValueOnce(mockNetworkError());
    
    await expect(burnSecret('secretId123', 'burnToken456'))
      .rejects.toThrow(NetworkError);
  });
});
