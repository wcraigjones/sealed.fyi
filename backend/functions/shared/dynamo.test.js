'use strict';

const {
  getSecret,
  putSecret,
  deleteSecret,
  decrementViews,
  conditionalDelete,
  updateAccessToken,
  isWithinIdempotencyWindow,
  isExpired,
  _internal
} = require('./dynamo');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: mockSend
      })
    },
    GetCommand: jest.fn().mockImplementation((params) => ({ type: 'Get', params })),
    PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
    DeleteCommand: jest.fn().mockImplementation((params) => ({ type: 'Delete', params })),
    UpdateCommand: jest.fn().mockImplementation((params) => ({ type: 'Update', params })),
    __mockSend: mockSend
  };
});

const { __mockSend } = require('@aws-sdk/lib-dynamodb');

describe('dynamo.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _internal.resetClient();
  });

  describe('getSecret', () => {
    it('should return secret when found', async () => {
      const mockSecret = {
        id: 'test-id-123456789012',
        ciphertext: 'encrypted-data',
        iv: 'test-iv-12345678',
        passphraseProtected: false,
        remainingViews: 3,
        burnToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        createdAt: 1706745600,
        expiresAt: 1706832000
      };

      __mockSend.mockResolvedValueOnce({ Item: mockSecret });

      const result = await getSecret('test-id-123456789012');

      expect(result).toEqual(mockSecret);
      expect(__mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return null when secret not found', async () => {
      __mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getSecret('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('putSecret', () => {
    it('should store a secret without salt', async () => {
      __mockSend.mockResolvedValueOnce({});

      const secret = {
        id: 'test-id-123456789012',
        ciphertext: 'encrypted-data',
        iv: 'test-iv-12345678',
        salt: null,
        passphraseProtected: false,
        remainingViews: 1,
        burnToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        createdAt: 1706745600,
        expiresAt: 1706832000
      };

      await putSecret(secret);

      expect(__mockSend).toHaveBeenCalledTimes(1);
      const call = __mockSend.mock.calls[0][0];
      expect(call.params.Item.salt).toBeUndefined();
    });

    it('should store a secret with salt', async () => {
      __mockSend.mockResolvedValueOnce({});

      const secret = {
        id: 'test-id-123456789012',
        ciphertext: 'encrypted-data',
        iv: 'test-iv-12345678',
        salt: 'test-salt-1234567890',
        passphraseProtected: true,
        remainingViews: 1,
        burnToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        createdAt: 1706745600,
        expiresAt: 1706832000
      };

      await putSecret(secret);

      expect(__mockSend).toHaveBeenCalledTimes(1);
      const call = __mockSend.mock.calls[0][0];
      expect(call.params.Item.salt).toBe('test-salt-1234567890');
    });

    it('should use condition to prevent overwrites', async () => {
      __mockSend.mockResolvedValueOnce({});

      const secret = {
        id: 'test-id',
        ciphertext: 'data',
        iv: 'iv',
        passphraseProtected: false,
        remainingViews: 1,
        burnToken: 'token',
        createdAt: 1706745600,
        expiresAt: 1706832000
      };

      await putSecret(secret);

      const call = __mockSend.mock.calls[0][0];
      expect(call.params.ConditionExpression).toBe('attribute_not_exists(id)');
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret by ID', async () => {
      __mockSend.mockResolvedValueOnce({});

      await deleteSecret('test-id-123456789012');

      expect(__mockSend).toHaveBeenCalledTimes(1);
      const call = __mockSend.mock.calls[0][0];
      expect(call.params.Key.id).toBe('test-id-123456789012');
    });
  });

  describe('decrementViews', () => {
    it('should decrement views and return new count', async () => {
      __mockSend.mockResolvedValueOnce({
        Attributes: { remainingViews: 2 }
      });

      const result = await decrementViews('test-id', 'access-token');

      expect(result).toEqual({ remaining: 2, deleted: false });
    });

    it('should work without accessToken parameter (API contract compliance)', async () => {
      __mockSend.mockResolvedValueOnce({
        Attributes: { remainingViews: 2 }
      });

      const result = await decrementViews('test-id');

      expect(result).toEqual({ remaining: 2, deleted: false });
      // Verify the update expression doesn't include token fields
      const call = __mockSend.mock.calls[0][0];
      expect(call.params.UpdateExpression).toBe('SET remainingViews = remainingViews - :one');
      expect(call.params.ExpressionAttributeValues[':token']).toBeUndefined();
    });

    it('should include access tracking when accessToken is provided', async () => {
      __mockSend.mockResolvedValueOnce({
        Attributes: { remainingViews: 2 }
      });

      await decrementViews('test-id', 'my-access-token');

      const call = __mockSend.mock.calls[0][0];
      expect(call.params.UpdateExpression).toBe('SET remainingViews = remainingViews - :one, lastAccessAt = :now, lastAccessToken = :token');
      expect(call.params.ExpressionAttributeValues[':token']).toBe('my-access-token');
    });

    it('should delete secret when views reach 0', async () => {
      __mockSend
        .mockResolvedValueOnce({ Attributes: { remainingViews: 0 } })
        .mockResolvedValueOnce({}); // delete call

      const result = await decrementViews('test-id', 'access-token');

      expect(result).toEqual({ remaining: 0, deleted: true });
      expect(__mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw error when secret not available', async () => {
      const error = new Error();
      error.name = 'ConditionalCheckFailedException';
      __mockSend.mockRejectedValueOnce(error);

      await expect(decrementViews('test-id', 'access-token'))
        .rejects.toThrow('Secret not available');
    });
  });

  describe('conditionalDelete', () => {
    it('should return true when delete succeeds', async () => {
      __mockSend.mockResolvedValueOnce({});

      const result = await conditionalDelete('test-id', 'valid-burn-token');

      expect(result).toBe(true);
    });

    it('should return false when token does not match', async () => {
      const error = new Error();
      error.name = 'ConditionalCheckFailedException';
      __mockSend.mockRejectedValueOnce(error);

      const result = await conditionalDelete('test-id', 'wrong-token');

      expect(result).toBe(false);
    });

    it('should rethrow other errors', async () => {
      const error = new Error('Network error');
      __mockSend.mockRejectedValueOnce(error);

      await expect(conditionalDelete('test-id', 'token'))
        .rejects.toThrow('Network error');
    });
  });

  describe('updateAccessToken', () => {
    it('should update access token and timestamp', async () => {
      __mockSend.mockResolvedValueOnce({});

      await updateAccessToken('test-id', 'new-token', 1706745700);

      expect(__mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('isWithinIdempotencyWindow', () => {
    it('should return true when within window with matching token', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = {
        lastAccessToken: 'matching-token',
        lastAccessAt: now - 10 // 10 seconds ago
      };

      expect(isWithinIdempotencyWindow(secret, 'matching-token')).toBe(true);
    });

    it('should return false when token does not match', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = {
        lastAccessToken: 'original-token',
        lastAccessAt: now - 10
      };

      expect(isWithinIdempotencyWindow(secret, 'different-token')).toBe(false);
    });

    it('should return false when outside window', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = {
        lastAccessToken: 'matching-token',
        lastAccessAt: now - 60 // 60 seconds ago (outside 30s window)
      };

      expect(isWithinIdempotencyWindow(secret, 'matching-token')).toBe(false);
    });

    it('should return false when no previous access', () => {
      const secret = {};

      expect(isWithinIdempotencyWindow(secret, 'token')).toBe(false);
    });

    it('should return false when no provided token', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = {
        lastAccessToken: 'token',
        lastAccessAt: now - 10
      };

      expect(isWithinIdempotencyWindow(secret, null)).toBe(false);
      expect(isWithinIdempotencyWindow(secret, undefined)).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return true when secret is expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = { expiresAt: now - 100 };

      expect(isExpired(secret)).toBe(true);
    });

    it('should return false when secret is not expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = { expiresAt: now + 100 };

      expect(isExpired(secret)).toBe(false);
    });

    it('should return true when expiresAt equals now', () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = { expiresAt: now };

      expect(isExpired(secret)).toBe(true);
    });
  });

  describe('constants', () => {
    it('should have correct table name', () => {
      expect(_internal.TABLE_NAME).toBe('sealed-secrets');
    });

    it('should have correct idempotency window', () => {
      expect(_internal.IDEMPOTENCY_WINDOW_SECONDS).toBe(30);
    });
  });
});
