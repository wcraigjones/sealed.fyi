'use strict';

const {
  success,
  created,
  notAvailable,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  internalError,
  _internal
} = require('./responses');

describe('responses.js', () => {
  describe('success', () => {
    it('should return 200 with body', () => {
      const body = { data: 'test' };
      const response = success(body);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(body);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    it('should allow custom status code', () => {
      const response = success({ data: 'test' }, 202);
      
      expect(response.statusCode).toBe(202);
    });
  });

  describe('created', () => {
    it('should return 201 with body', () => {
      const body = { id: 'abc123', burnToken: 'xyz789' };
      const response = created(body);
      
      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual(body);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('notAvailable', () => {
    it('should return 404 with uniform error body', () => {
      const response = notAvailable();
      
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ error: 'not_available' });
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    it('should always return identical response (anti-oracle)', () => {
      // Call multiple times to verify consistency
      const response1 = notAvailable();
      const response2 = notAvailable();
      const response3 = notAvailable();
      
      expect(response1).toEqual(response2);
      expect(response2).toEqual(response3);
    });
  });

  describe('noContent', () => {
    it('should return 204 with empty body', () => {
      const response = noContent();
      
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    it('should not have Content-Type header', () => {
      // 204 responses typically don't have Content-Type
      const response = noContent();
      
      expect(response.headers['Content-Type']).toBeUndefined();
    });
  });

  describe('badRequest', () => {
    it('should return 400 with error details', () => {
      const message = 'Invalid TTL value';
      const response = badRequest(message);
      
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'invalid_request',
        message: 'Invalid TTL value'
      });
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('unauthorized', () => {
    it('should return 401 with error body', () => {
      const response = unauthorized();
      
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'invalid_token' });
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('forbidden', () => {
    it('should return 403 with error body', () => {
      const response = forbidden();
      
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({ error: 'invalid_pow' });
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('internalError', () => {
    it('should return 500 with error body', () => {
      const response = internalError();
      
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({ error: 'internal_error' });
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('_internal.buildResponse', () => {
    it('should build response with additional headers', () => {
      const response = _internal.buildResponse(200, { test: true }, { 'X-Custom': 'value' });
      
      expect(response.headers['X-Custom']).toBe('value');
      expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('should handle null body', () => {
      const response = _internal.buildResponse(204, null);
      
      expect(response.body).toBe('');
    });
  });

  describe('BASE_HEADERS', () => {
    it('should include required security headers', () => {
      expect(_internal.BASE_HEADERS['Content-Type']).toBe('application/json');
      expect(_internal.BASE_HEADERS['Cache-Control']).toBe('no-store');
    });
  });

  describe('response structure consistency', () => {
    it('all error responses should have consistent structure', () => {
      const responses = [
        notAvailable(),
        unauthorized(),
        forbidden(),
        internalError()
      ];
      
      responses.forEach(response => {
        expect(response).toHaveProperty('statusCode');
        expect(response).toHaveProperty('headers');
        expect(response).toHaveProperty('body');
        expect(typeof response.statusCode).toBe('number');
        expect(typeof response.headers).toBe('object');
        expect(typeof response.body).toBe('string');
      });
    });
  });
});
