'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

// Configuration
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'sealed-secrets';
const IDEMPOTENCY_WINDOW_SECONDS = 30;

/**
 * Create DynamoDB client with optional local endpoint
 * @returns {DynamoDBDocumentClient}
 */
function createClient() {
  const config = {
    region: process.env.AWS_REGION || 'us-east-1'
  };

  // Support local DynamoDB for development
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

/**
 * Get the DynamoDB document client (singleton)
 * @returns {DynamoDBDocumentClient}
 */
function getClient() {
  if (!docClient) {
    docClient = createClient();
  }
  return docClient;
}

/**
 * Reset the client (useful for testing)
 */
function resetClient() {
  docClient = null;
}

/**
 * Get a secret by ID
 * @param {string} id - Secret identifier
 * @returns {Promise<object|null>} Secret object or null if not found
 */
async function getSecret(id) {
  const client = getClient();
  
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id }
  }));

  return result.Item || null;
}

/**
 * Store a new secret
 * @param {object} secret - Secret object to store
 * @param {string} secret.id - Secret identifier
 * @param {string} secret.ciphertext - Base64-encoded encrypted payload
 * @param {string} secret.iv - Base64-encoded initialization vector
 * @param {string|null} secret.salt - Base64-encoded salt or null
 * @param {boolean} secret.passphraseProtected - Whether passphrase is required
 * @param {number} secret.remainingViews - Number of views remaining
 * @param {string} secret.burnToken - Token for early deletion
 * @param {number} secret.createdAt - Unix timestamp
 * @param {number} secret.expiresAt - Unix timestamp for TTL
 * @returns {Promise<void>}
 * @throws {Error} If secret with same ID already exists
 */
async function putSecret(secret) {
  const client = getClient();

  const item = {
    id: secret.id,
    ciphertext: secret.ciphertext,
    iv: secret.iv,
    passphraseProtected: secret.passphraseProtected,
    remainingViews: secret.remainingViews,
    burnToken: secret.burnToken,
    createdAt: secret.createdAt,
    expiresAt: secret.expiresAt
  };

  // Only include salt if present (passphrase-protected secrets)
  if (secret.salt) {
    item.salt = secret.salt;
  }

  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(id)'
  }));
}

/**
 * Delete a secret by ID
 * @param {string} id - Secret identifier
 * @returns {Promise<void>}
 */
async function deleteSecret(id) {
  const client = getClient();

  await client.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { id }
  }));
}

/**
 * Decrement remaining views and optionally update access tracking
 * @param {string} id - Secret identifier
 * @param {string} [accessToken] - Optional access token for idempotency tracking
 * @returns {Promise<{remaining: number, deleted: boolean}>}
 * @throws {Error} If secret doesn't exist or is expired
 */
async function decrementViews(id, accessToken) {
  const client = getClient();
  const now = Math.floor(Date.now() / 1000);

  // Build update expression based on whether accessToken is provided
  const updateExpression = accessToken
    ? 'SET remainingViews = remainingViews - :one, lastAccessAt = :now, lastAccessToken = :token'
    : 'SET remainingViews = remainingViews - :one';

  const expressionAttributeValues = {
    ':one': 1,
    ':zero': 0,
    ':now': now
  };

  // Only include token in expression values if provided
  if (accessToken) {
    expressionAttributeValues[':token'] = accessToken;
  }

  try {
    const result = await client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: updateExpression,
      ConditionExpression: 'remainingViews > :zero AND expiresAt > :now',
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    const remaining = result.Attributes.remainingViews;
    let deleted = false;

    // If no views remaining, delete the secret
    if (remaining <= 0) {
      await deleteSecret(id);
      deleted = true;
    }

    return { remaining, deleted };
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Secret doesn't exist, is expired, or has no remaining views
      throw new Error('Secret not available');
    }
    throw error;
  }
}

/**
 * Conditionally delete a secret if burn token matches
 * @param {string} id - Secret identifier
 * @param {string} burnToken - Burn token to validate
 * @returns {Promise<boolean>} True if deleted, false if token didn't match or secret not found
 */
async function conditionalDelete(id, burnToken) {
  const client = getClient();

  try {
    await client.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
      ConditionExpression: 'burnToken = :token',
      ExpressionAttributeValues: {
        ':token': burnToken
      }
    }));
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Token didn't match or secret doesn't exist - that's fine for burn
      return false;
    }
    throw error;
  }
}

/**
 * Update access token and timestamp (for idempotent access)
 * @param {string} id - Secret identifier
 * @param {string} accessToken - New access token
 * @param {number} accessTime - Unix timestamp of access
 * @returns {Promise<void>}
 */
async function updateAccessToken(id, accessToken, accessTime) {
  const client = getClient();

  await client.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET lastAccessAt = :accessTime, lastAccessToken = :token',
    ExpressionAttributeValues: {
      ':accessTime': accessTime,
      ':token': accessToken
    }
  }));
}

/**
 * Check if request is within idempotency window
 * @param {object} secret - Secret object with lastAccessAt and lastAccessToken
 * @param {string} providedToken - Token provided by client
 * @returns {boolean} True if within idempotency window with matching token
 */
function isWithinIdempotencyWindow(secret, providedToken) {
  if (!secret.lastAccessToken || !secret.lastAccessAt || !providedToken) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeSinceAccess = now - secret.lastAccessAt;

  return (
    secret.lastAccessToken === providedToken &&
    timeSinceAccess < IDEMPOTENCY_WINDOW_SECONDS
  );
}

/**
 * Check if a secret is expired
 * @param {object} secret - Secret object with expiresAt
 * @returns {boolean} True if secret is expired
 */
function isExpired(secret) {
  const now = Math.floor(Date.now() / 1000);
  return secret.expiresAt <= now;
}

module.exports = {
  getSecret,
  putSecret,
  deleteSecret,
  decrementViews,
  conditionalDelete,
  updateAccessToken,
  isWithinIdempotencyWindow,
  isExpired,
  // For testing
  _internal: {
    createClient,
    getClient,
    resetClient,
    TABLE_NAME,
    IDEMPOTENCY_WINDOW_SECONDS
  }
};
