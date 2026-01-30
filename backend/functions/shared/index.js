/**
 * Shared utilities for sealed.fyi Lambda functions.
 * Re-exports all modules for convenient import.
 */

// DynamoDB client helpers
export {
  getSecret,
  putSecret,
  deleteSecret,
  decrementViews,
  conditionalDelete,
  updateAccessToken,
  resetClient
} from './dynamo.js';

// Token utilities
export {
  generateToken,
  validateToken,
  generateNonce,
  generateSecretId,
  generateBurnToken,
  generateAccessToken
} from './token.js';

// Proof-of-Work utilities
export {
  generateChallenge,
  verifyPow
} from './pow.js';

// Response builders
export {
  success,
  created,
  notAvailable,
  noContent,
  badRequest,
  unauthorized,
  forbidden
} from './responses.js';

// Input validators
export {
  validateTTL,
  validateMaxViews,
  validateCiphertext,
  validateIV,
  validateSalt,
  validateNonce,
  validateSecretId,
  validateBurnToken
} from './validation.js';

// Default exports for namespace imports
import dynamo from './dynamo.js';
import token from './token.js';
import pow from './pow.js';
import responses from './responses.js';
import validation from './validation.js';

export { dynamo, token, pow, responses, validation };
