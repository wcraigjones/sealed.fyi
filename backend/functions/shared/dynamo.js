import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB client helpers for sealed.fyi secrets storage.
 * Supports local DynamoDB via DYNAMODB_ENDPOINT environment variable.
 */

/**
 * Get table name from environment (evaluated at call time for testability)
 */
function getTableName() {
  return process.env.DYNAMODB_TABLE || 'sealed-secrets';
}

/**
 * Create DynamoDB document client with optional local endpoint
 */
function createClient() {
  const config = {};
  
  if (process.env.DYNAMODB_ENDPOINT) {
    config.endpoint = process.env.DYNAMODB_ENDPOINT;
  }
  
  const client = new DynamoDBClient(config);
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true
    }
  });
}

// Singleton client instance
let docClient = null;

function getClient() {
  if (!docClient) {
    docClient = createClient();
  }
  return docClient;
}

/**
 * Reset client (useful for testing)
 */
export function resetClient() {
  docClient = null;
}

/**
 * Get a secret by ID
 * @param {string} id - Secret identifier (22 chars base64url)
 * @returns {Promise<Object|null>} Secret object or null if not found
 */
export async function getSecret(id) {
  const client = getClient();
  
  const command = new GetCommand({
    TableName: getTableName(),
    Key: { id }
  });
  
  const response = await client.send(command);
  return response.Item || null;
}

/**
 * Store a new secret
 * @param {Object} secret - Secret object to store
 * @param {string} secret.id - Secret identifier
 * @param {string} secret.ciphertext - Base64-encoded encrypted payload
 * @param {string} secret.iv - Base64-encoded initialization vector
 * @param {string|null} secret.salt - Base64-encoded salt or null
 * @param {boolean} secret.passphraseProtected - Whether passphrase is required
 * @param {number} secret.remainingViews - Number of views remaining
 * @param {string} secret.burnToken - Token for early deletion
 * @param {number} secret.createdAt - Unix timestamp of creation
 * @param {number} secret.expiresAt - Unix timestamp of expiration (TTL)
 * @throws {Error} If secret with same ID already exists
 */
export async function putSecret(secret) {
  const client = getClient();
  
  const command = new PutCommand({
    TableName: getTableName(),
    Item: secret,
    ConditionExpression: 'attribute_not_exists(id)'
  });
  
  await client.send(command);
}

/**
 * Delete a secret by ID
 * @param {string} id - Secret identifier
 */
export async function deleteSecret(id) {
  const client = getClient();
  
  const command = new DeleteCommand({
    TableName: getTableName(),
    Key: { id }
  });
  
  await client.send(command);
}

/**
 * Decrement remaining views and update access token
 * @param {string} id - Secret identifier
 * @returns {Promise<{remaining: number, deleted: boolean}>} Updated view count and deletion status
 * @throws {Error} If secret doesn't exist, is expired, or has no remaining views
 */
export async function decrementViews(id) {
  const client = getClient();
  const now = Math.floor(Date.now() / 1000);
  
  const command = new UpdateCommand({
    TableName: getTableName(),
    Key: { id },
    UpdateExpression: 'SET remainingViews = remainingViews - :one',
    ConditionExpression: 'remainingViews > :zero AND expiresAt > :now',
    ExpressionAttributeValues: {
      ':one': 1,
      ':zero': 0,
      ':now': now
    },
    ReturnValues: 'ALL_NEW'
  });
  
  const response = await client.send(command);
  const remaining = response.Attributes.remainingViews;
  
  // If remaining views is 0, delete the secret
  if (remaining === 0) {
    await deleteSecret(id);
    return { remaining: 0, deleted: true };
  }
  
  return { remaining, deleted: false };
}

/**
 * Conditionally delete a secret if burn token matches
 * @param {string} id - Secret identifier
 * @param {string} burnToken - Burn token to validate
 * @returns {Promise<boolean>} True if deleted, false if token didn't match
 */
export async function conditionalDelete(id, burnToken) {
  const client = getClient();
  
  const command = new DeleteCommand({
    TableName: getTableName(),
    Key: { id },
    ConditionExpression: 'burnToken = :token',
    ExpressionAttributeValues: {
      ':token': burnToken
    }
  });
  
  try {
    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw error;
  }
}

/**
 * Update access token and timestamp for idempotency
 * @param {string} id - Secret identifier
 * @param {string} accessToken - New access token
 * @param {number} accessTime - Unix timestamp of access
 */
export async function updateAccessToken(id, accessToken, accessTime) {
  const client = getClient();
  
  const command = new UpdateCommand({
    TableName: getTableName(),
    Key: { id },
    UpdateExpression: 'SET lastAccessToken = :token, lastAccessAt = :time',
    ExpressionAttributeValues: {
      ':token': accessToken,
      ':time': accessTime
    }
  });
  
  await client.send(command);
}

export default {
  getSecret,
  putSecret,
  deleteSecret,
  decrementViews,
  conditionalDelete,
  updateAccessToken,
  resetClient
};
