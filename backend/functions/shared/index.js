'use strict';

/**
 * Shared utilities for sealed.fyi Lambda functions
 * 
 * This module re-exports all shared utilities for convenient importing:
 * 
 * @example
 * const { dynamo, token, pow, responses, validation } = require('./shared');
 * 
 * @example
 * const { getSecret, putSecret } = require('./shared').dynamo;
 */

const dynamo = require('./dynamo');
const token = require('./token');
const pow = require('./pow');
const responses = require('./responses');
const validation = require('./validation');

module.exports = {
  // Namespaced exports
  dynamo,
  token,
  pow,
  responses,
  validation,
  
  // Direct re-exports for convenience
  
  // dynamo
  getSecret: dynamo.getSecret,
  putSecret: dynamo.putSecret,
  deleteSecret: dynamo.deleteSecret,
  decrementViews: dynamo.decrementViews,
  conditionalDelete: dynamo.conditionalDelete,
  updateAccessToken: dynamo.updateAccessToken,
  isWithinIdempotencyWindow: dynamo.isWithinIdempotencyWindow,
  isExpired: dynamo.isExpired,
  
  // token
  generateToken: token.generateToken,
  validateToken: token.validateToken,
  generateNonce: token.generateNonce,
  generateSecretId: token.generateSecretId,
  generateBurnToken: token.generateBurnToken,
  generateAccessToken: token.generateAccessToken,
  generateChallenge: token.generateChallenge,
  extractBearerToken: token.extractBearerToken,
  
  // pow
  verifyPow: pow.verifyPow,
  
  // responses
  success: responses.success,
  created: responses.created,
  notAvailable: responses.notAvailable,
  noContent: responses.noContent,
  badRequest: responses.badRequest,
  unauthorized: responses.unauthorized,
  forbidden: responses.forbidden,
  internalError: responses.internalError,
  
  // validation
  validateTTL: validation.validateTTL,
  validateMaxViews: validation.validateMaxViews,
  validateCiphertext: validation.validateCiphertext,
  validateIV: validation.validateIV,
  validateSalt: validation.validateSalt,
  validateNonce: validation.validateNonce,
  validateSecretId: validation.validateSecretId,
  validateBurnToken: validation.validateBurnToken,
  validateAccessToken: validation.validateAccessToken,
  validateCreateSecretRequest: validation.validateCreateSecretRequest
};
