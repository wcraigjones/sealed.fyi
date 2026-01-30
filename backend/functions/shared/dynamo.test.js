import { jest } from '@jest/globals';

// Mock the AWS SDK before importing the module
jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send: mockSend }))
    },
    GetCommand: jest.fn(),
    PutCommand: jest.fn(),
    DeleteCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    __mockSend: mockSend
  };
});

// Import after mocking
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, UpdateCommand, __mockSend: mockSend } = await import('@aws-sdk/lib-dynamodb');
const { getSecret, putSecret, deleteSecret, decrementViews, conditionalDelete, updateAccessToken, resetClient } = await import('./dynamo.js');

describe('DynamoDB helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClient();
    process.env.DYNAMODB_TABLE = 'test-table';
  });

  describe('getSecret', () => {
    test('returns secret for valid id', async () => {
      const mockSecret = {
        id: 'test-secret-id-12345',
        ciphertext: 'encrypted-data',
        iv: 'test-iv-base64',
        remainingViews: 1
      };
      
      mockSend.mockResolvedValueOnce({ Item: mockSecret });
      
      const result = await getSecret('test-secret-id-12345');
      
      expect(result).toEqual(mockSecret);
      expect(GetCommand).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-secret-id-12345' }
      });
    });

    test('returns null for missing id', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      
      const result = await getSecret('nonexistent-id');
      
      expect(result).toBeNull();
    });
  });

  describe('putSecret', () => {
    test('stores secret', async () => {
      const secret = {
        id: 'new-secret-id-12345',
        ciphertext: 'encrypted-data',
        iv: 'test-iv-base64',
        salt: null,
        passphraseProtected: false,
        remainingViews: 1,
        burnToken: 'burn-token-hex',
        createdAt: 1706745600,
        expiresAt: 1706832000
      };
      
      mockSend.mockResolvedValueOnce({});
      
      await putSecret(secret);
      
      expect(PutCommand).toHaveBeenCalledWith({
        TableName: 'test-table',
        Item: secret,
        ConditionExpression: 'attribute_not_exists(id)'
      });
    });

    test('fails on duplicate id', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);
      
      await expect(putSecret({ id: 'duplicate-id' })).rejects.toThrow();
    });
  });

  describe('deleteSecret', () => {
    test('removes secret', async () => {
      mockSend.mockResolvedValueOnce({});
      
      await deleteSecret('test-id-to-delete');
      
      expect(DeleteCommand).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-id-to-delete' }
      });
    });

    test('succeeds for missing id', async () => {
      mockSend.mockResolvedValueOnce({});
      
      await expect(deleteSecret('nonexistent-id')).resolves.not.toThrow();
    });
  });

  describe('decrementViews', () => {
    test('decrements and returns new value', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { remainingViews: 2 }
      });
      
      const result = await decrementViews('test-id');
      
      expect(result).toEqual({ remaining: 2, deleted: false });
      expect(UpdateCommand).toHaveBeenCalled();
    });

    test('deletes when reaching 0', async () => {
      mockSend
        .mockResolvedValueOnce({ Attributes: { remainingViews: 0 } })
        .mockResolvedValueOnce({}); // For the delete call
      
      const result = await decrementViews('test-id');
      
      expect(result).toEqual({ remaining: 0, deleted: true });
      expect(DeleteCommand).toHaveBeenCalled();
    });

    test('fails when no remaining views', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);
      
      await expect(decrementViews('test-id')).rejects.toThrow();
    });
  });

  describe('conditionalDelete', () => {
    test('deletes with matching token', async () => {
      mockSend.mockResolvedValueOnce({});
      
      const result = await conditionalDelete('test-id', 'valid-burn-token');
      
      expect(result).toBe(true);
      expect(DeleteCommand).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-id' },
        ConditionExpression: 'burnToken = :token',
        ExpressionAttributeValues: { ':token': 'valid-burn-token' }
      });
    });

    test('fails with wrong token', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);
      
      const result = await conditionalDelete('test-id', 'wrong-token');
      
      expect(result).toBe(false);
    });
  });

  describe('updateAccessToken', () => {
    test('updates access token and timestamp', async () => {
      mockSend.mockResolvedValueOnce({});
      
      await updateAccessToken('test-id', 'new-access-token', 1706745600);
      
      expect(UpdateCommand).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-id' },
        UpdateExpression: 'SET lastAccessToken = :token, lastAccessAt = :time',
        ExpressionAttributeValues: {
          ':token': 'new-access-token',
          ':time': 1706745600
        }
      });
    });
  });
});
