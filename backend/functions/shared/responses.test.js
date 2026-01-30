import {
  success,
  created,
  notAvailable,
  noContent,
  badRequest,
  unauthorized,
  forbidden
} from './responses.js';

describe('Response builders', () => {
  describe('success', () => {
    test('returns 200 by default', () => {
      const response = success({ data: 'test' });
      
      expect(response.statusCode).toBe(200);
    });

    test('returns custom status code', () => {
      const response = success({ data: 'test' }, 202);
      
      expect(response.statusCode).toBe(202);
    });

    test('includes correct headers', () => {
      const response = success({ data: 'test' });
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    test('serializes body as JSON', () => {
      const body = { data: 'test', nested: { value: 123 } };
      const response = success(body);
      
      expect(response.body).toBe(JSON.stringify(body));
    });
  });

  describe('created', () => {
    test('returns 201', () => {
      const response = created({ id: 'new-id' });
      
      expect(response.statusCode).toBe(201);
    });

    test('includes correct headers', () => {
      const response = created({ id: 'new-id' });
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    test('serializes body as JSON', () => {
      const body = { id: 'new-id', burnToken: 'token' };
      const response = created(body);
      
      expect(response.body).toBe(JSON.stringify(body));
    });
  });

  describe('notAvailable', () => {
    test('returns 404', () => {
      const response = notAvailable();
      
      expect(response.statusCode).toBe(404);
    });

    test('returns uniform error body', () => {
      const response = notAvailable();
      
      expect(JSON.parse(response.body)).toEqual({ error: 'not_available' });
    });

    test('includes correct headers', () => {
      const response = notAvailable();
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    test('response is always identical (anti-oracle)', () => {
      const response1 = notAvailable();
      const response2 = notAvailable();
      const response3 = notAvailable();
      
      expect(response1).toEqual(response2);
      expect(response2).toEqual(response3);
    });
  });

  describe('noContent', () => {
    test('returns 204', () => {
      const response = noContent();
      
      expect(response.statusCode).toBe(204);
    });

    test('has empty body', () => {
      const response = noContent();
      
      expect(response.body).toBe('');
    });

    test('includes Cache-Control header', () => {
      const response = noContent();
      
      expect(response.headers['Cache-Control']).toBe('no-store');
    });

    test('does not include Content-Type header', () => {
      const response = noContent();
      
      expect(response.headers['Content-Type']).toBeUndefined();
    });
  });

  describe('badRequest', () => {
    test('returns 400', () => {
      const response = badRequest('Invalid input');
      
      expect(response.statusCode).toBe(400);
    });

    test('includes error and message', () => {
      const response = badRequest('TTL must be between 900 and 7776000');
      const body = JSON.parse(response.body);
      
      expect(body.error).toBe('invalid_request');
      expect(body.message).toBe('TTL must be between 900 and 7776000');
    });

    test('includes correct headers', () => {
      const response = badRequest('Error');
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('unauthorized', () => {
    test('returns 401', () => {
      const response = unauthorized();
      
      expect(response.statusCode).toBe(401);
    });

    test('returns invalid_token error', () => {
      const response = unauthorized();
      
      expect(JSON.parse(response.body)).toEqual({ error: 'invalid_token' });
    });

    test('includes correct headers', () => {
      const response = unauthorized();
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('forbidden', () => {
    test('returns 403', () => {
      const response = forbidden();
      
      expect(response.statusCode).toBe(403);
    });

    test('returns invalid_pow error', () => {
      const response = forbidden();
      
      expect(JSON.parse(response.body)).toEqual({ error: 'invalid_pow' });
    });

    test('includes correct headers', () => {
      const response = forbidden();
      
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('response shape consistency', () => {
    test('all responses have statusCode, headers, and body', () => {
      const responses = [
        success({ test: true }),
        created({ test: true }),
        notAvailable(),
        noContent(),
        badRequest('error'),
        unauthorized(),
        forbidden()
      ];
      
      for (const response of responses) {
        expect(response).toHaveProperty('statusCode');
        expect(response).toHaveProperty('headers');
        expect(response).toHaveProperty('body');
      }
    });

    test('all responses with body have Cache-Control no-store', () => {
      const responses = [
        success({ test: true }),
        created({ test: true }),
        notAvailable(),
        noContent(),
        badRequest('error'),
        unauthorized(),
        forbidden()
      ];
      
      for (const response of responses) {
        expect(response.headers['Cache-Control']).toBe('no-store');
      }
    });
  });
});
