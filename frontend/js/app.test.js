/**
 * sealed.fyi - App Module Tests
 * 
 * Run with: npx vitest run app.test.js
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// =============================================================================
// Mock DOM
// =============================================================================

// Create a minimal DOM mock
const mockElements = {};
const mockDocument = {
  getElementById: vi.fn((id) => mockElements[id] || null),
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn(() => null),
  createElement: vi.fn((tag) => ({
    value: '',
    style: {},
    select: vi.fn(),
    remove: vi.fn()
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  readyState: 'complete',
  addEventListener: vi.fn()
};

// Set up global DOM mocks
globalThis.document = mockDocument;
globalThis.window = {
  location: {
    hash: '',
    origin: 'https://sealed.fyi',
    pathname: '/',
    search: ''
  },
  history: {
    replaceState: vi.fn()
  },
  addEventListener: vi.fn()
};
globalThis.navigator = {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
};
globalThis.setTimeout = vi.fn((fn) => fn());

// =============================================================================
// Mock Dependencies
// =============================================================================

// Mock crypto functions
globalThis.encryptSecret = vi.fn(() => Promise.resolve({
  payload: {
    ciphertext: 'mockCiphertext',
    iv: 'mockIv',
    salt: null
  },
  urlFragment: 'mockUrlFragment'
}));

globalThis.decryptSecret = vi.fn(() => Promise.resolve('Decrypted secret'));

// Mock PoW
globalThis.solveChallenge = vi.fn(() => Promise.resolve('mockPowSolution'));

// Mock API functions
globalThis.getToken = vi.fn(() => Promise.resolve({
  token: 'mockToken',
  nonce: 'mockNonce',
  powChallenge: { difficulty: 18, prefix: 'sealed:' },
  expiresAt: Date.now() + 300000
}));

globalThis.createSecret = vi.fn(() => Promise.resolve({
  id: 'mockSecretId',
  burnToken: 'mockBurnToken',
  expiresAt: Date.now() + 86400000
}));

globalThis.getSecret = vi.fn(() => Promise.resolve({
  ciphertext: 'mockCiphertext',
  iv: 'mockIv',
  salt: null,
  passphraseProtected: false,
  accessToken: 'mockAccessToken'
}));

globalThis.burnSecret = vi.fn(() => Promise.resolve());

// Mock storage functions
globalThis.getPreferences = vi.fn(() => ({
  ttl: 86400,
  maxViews: 1,
  usePassphrase: false,
  autoCopyLink: false,
  autoHideSeconds: 0
}));

globalThis.setPreferences = vi.fn();
globalThis.getPreference = vi.fn(() => false);

// Mock error classes
globalThis.InvalidTokenError = class extends Error { constructor(m) { super(m); this.name = 'InvalidTokenError'; } };
globalThis.InvalidPowError = class extends Error { constructor(m) { super(m); this.name = 'InvalidPowError'; } };
globalThis.ValidationError = class extends Error { constructor(m) { super(m); this.name = 'ValidationError'; } };
globalThis.NotAvailableError = class extends Error { constructor(m) { super(m); this.name = 'NotAvailableError'; } };
globalThis.NetworkError = class extends Error { constructor(m) { super(m); this.name = 'NetworkError'; } };

// =============================================================================
// Import App Module (after mocks are set up)
// =============================================================================

const app = await import('./app.js');
const {
  state,
  VIEW_IDS,
  hideAllViews,
  showView,
  getCurrentView,
  showError,
  clearError,
  parseUrlFragment,
  buildSecretUrl,
  clearUrlFragment,
  handleCreateNew,
  copyToClipboard
} = app;

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset state
  state.currentView = 'create';
  state.secret = null;
  state.secretId = null;
  state.burnToken = null;
  state.urlFragment = null;
  state.error = null;
  state.loading = false;
  state.accessToken = null;
  
  // Reset location
  window.location.hash = '';
  
  // Reset mock elements
  Object.keys(mockElements).forEach(key => delete mockElements[key]);
});

// =============================================================================
// URL Fragment Handling Tests
// =============================================================================

describe('URL Fragment Handling', () => {
  describe('parseUrlFragment', () => {
    test('parses valid fragment with secretId and key', () => {
      window.location.hash = '#secretId123:base64urlKey456';
      
      const result = parseUrlFragment();
      
      expect(result).toEqual({
        secretId: 'secretId123',
        urlFragment: 'base64urlKey456'
      });
    });
    
    test('returns null for empty hash', () => {
      window.location.hash = '';
      
      const result = parseUrlFragment();
      
      expect(result).toBeNull();
    });
    
    test('returns null for hash without colon', () => {
      window.location.hash = '#noColonHere';
      
      const result = parseUrlFragment();
      
      expect(result).toBeNull();
    });
    
    test('returns null for hash with colon at start', () => {
      window.location.hash = '#:onlyKey';
      
      const result = parseUrlFragment();
      
      expect(result).toBeNull();
    });
    
    test('returns null for hash with colon at end', () => {
      window.location.hash = '#onlyId:';
      
      const result = parseUrlFragment();
      
      expect(result).toBeNull();
    });
    
    test('handles multiple colons (key contains colon)', () => {
      window.location.hash = '#secretId:key:with:colons';
      
      const result = parseUrlFragment();
      
      expect(result).toEqual({
        secretId: 'secretId',
        urlFragment: 'key:with:colons'
      });
    });
  });
  
  describe('buildSecretUrl', () => {
    test('builds correct URL with fragment', () => {
      const url = buildSecretUrl('secretId123', 'urlFragment456');
      
      expect(url).toBe('https://sealed.fyi/#secretId123:urlFragment456');
    });
  });
  
  describe('clearUrlFragment', () => {
    test('calls history.replaceState to clear fragment', () => {
      window.location.hash = '#test';
      
      clearUrlFragment();
      
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/'
      );
    });
  });
});

// =============================================================================
// View Management Tests
// =============================================================================

describe('View Management', () => {
  beforeEach(() => {
    // Set up mock view elements
    VIEW_IDS.forEach(id => {
      mockElements[id] = {
        hidden: false,
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        querySelector: vi.fn(() => null)
      };
    });
  });
  
  describe('hideAllViews', () => {
    test('hides all view elements', () => {
      hideAllViews();
      
      VIEW_IDS.forEach(id => {
        const element = mockElements[id];
        expect(element.hidden).toBe(true);
        expect(element.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
      });
    });
  });
  
  describe('showView', () => {
    test('shows specified view and hides others', () => {
      showView('link');
      
      expect(mockElements['view-link'].hidden).toBe(false);
      expect(mockElements['view-link'].removeAttribute).toHaveBeenCalledWith('aria-hidden');
    });
    
    test('updates state.currentView', () => {
      showView('reveal');
      
      expect(state.currentView).toBe('reveal');
    });
    
    test('accepts view ID with or without prefix', () => {
      showView('view-secret');
      expect(state.currentView).toBe('secret');
      
      showView('error');
      expect(state.currentView).toBe('error');
    });
  });
  
  describe('getCurrentView', () => {
    test('returns current view', () => {
      state.currentView = 'passphrase';
      
      expect(getCurrentView()).toBe('passphrase');
    });
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  beforeEach(() => {
    mockElements['error-message'] = { textContent: '' };
    mockElements['error-retry'] = { hidden: true };
    mockElements['view-error'] = {
      hidden: true,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      querySelector: vi.fn(() => null)
    };
    
    VIEW_IDS.forEach(id => {
      if (!mockElements[id]) {
        mockElements[id] = {
          hidden: false,
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
          querySelector: vi.fn(() => null)
        };
      }
    });
  });
  
  describe('showError', () => {
    test('sets error message text', () => {
      showError('Test error message');
      
      expect(mockElements['error-message'].textContent).toBe('Test error message');
    });
    
    test('updates state.error', () => {
      showError('Test error');
      
      expect(state.error).toBe('Test error');
    });
    
    test('shows retry button when canRetry is true', () => {
      showError('Retryable error', true);
      
      expect(mockElements['error-retry'].hidden).toBe(false);
    });
    
    test('hides retry button when canRetry is false', () => {
      showError('Non-retryable error', false);
      
      expect(mockElements['error-retry'].hidden).toBe(true);
    });
    
    test('shows error view', () => {
      showError('Test error');
      
      expect(state.currentView).toBe('error');
    });
  });
  
  describe('clearError', () => {
    test('clears state.error', () => {
      state.error = 'Some error';
      clearError();
      
      expect(state.error).toBeNull();
    });
  });
});

// =============================================================================
// Utility Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('copyToClipboard', () => {
    test('uses clipboard API when available', async () => {
      const result = await copyToClipboard('test text');
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });
    
    test('returns false when clipboard API fails', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Failed'));
      
      // Mock execCommand for fallback
      document.execCommand = vi.fn(() => false);
      
      const result = await copyToClipboard('test text');
      
      expect(result).toBe(false);
    });
  });
  
  describe('handleCreateNew', () => {
    test('resets state', () => {
      state.secret = 'test';
      state.secretId = 'id';
      state.burnToken = 'token';
      state.urlFragment = 'fragment';
      state.error = 'error';
      state.accessToken = 'access';
      
      // Set up required mock elements
      VIEW_IDS.forEach(id => {
        mockElements[id] = {
          hidden: false,
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
          querySelector: vi.fn(() => null)
        };
      });
      
      handleCreateNew();
      
      expect(state.secret).toBeNull();
      expect(state.secretId).toBeNull();
      expect(state.burnToken).toBeNull();
      expect(state.urlFragment).toBeNull();
      expect(state.error).toBeNull();
      expect(state.accessToken).toBeNull();
    });
    
    test('clears URL fragment', () => {
      VIEW_IDS.forEach(id => {
        mockElements[id] = {
          hidden: false,
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
          querySelector: vi.fn(() => null)
        };
      });
      
      handleCreateNew();
      
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// State Tests
// =============================================================================

describe('Application State', () => {
  test('initial state has expected properties', () => {
    expect(state).toHaveProperty('currentView');
    expect(state).toHaveProperty('secret');
    expect(state).toHaveProperty('secretId');
    expect(state).toHaveProperty('burnToken');
    expect(state).toHaveProperty('urlFragment');
    expect(state).toHaveProperty('error');
    expect(state).toHaveProperty('loading');
    expect(state).toHaveProperty('accessToken');
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  test('VIEW_IDS contains all expected views', () => {
    expect(VIEW_IDS).toContain('view-create');
    expect(VIEW_IDS).toContain('view-creating');
    expect(VIEW_IDS).toContain('view-link');
    expect(VIEW_IDS).toContain('view-reveal');
    expect(VIEW_IDS).toContain('view-passphrase');
    expect(VIEW_IDS).toContain('view-secret');
    expect(VIEW_IDS).toContain('view-error');
  });
});
