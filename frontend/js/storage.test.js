/**
 * sealed.fyi - Storage Module Tests
 * 
 * Run with: npx vitest run storage.test.js
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

// Set up global localStorage mock
globalThis.localStorage = localStorageMock;

// Import the storage module
const {
  STORAGE_KEY,
  DEFAULT_PREFERENCES,
  isStorageAvailable,
  getPreferences,
  setPreferences,
  clearPreferences,
  getPreference,
  setPreference
} = await import('./storage.js');

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  test('STORAGE_KEY is defined', () => {
    expect(STORAGE_KEY).toBe('sealed_preferences');
  });
  
  test('DEFAULT_PREFERENCES has expected values', () => {
    expect(DEFAULT_PREFERENCES.ttl).toBe(86400);
    expect(DEFAULT_PREFERENCES.maxViews).toBe(1);
    expect(DEFAULT_PREFERENCES.usePassphrase).toBe(false);
    expect(DEFAULT_PREFERENCES.autoCopyLink).toBe(false);
    expect(DEFAULT_PREFERENCES.autoHideSeconds).toBe(0);
  });
});

// =============================================================================
// isStorageAvailable Tests
// =============================================================================

describe('isStorageAvailable', () => {
  test('returns true when localStorage works', () => {
    expect(isStorageAvailable()).toBe(true);
  });
  
  test('returns false when localStorage throws', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('Storage full');
    });
    
    expect(isStorageAvailable()).toBe(false);
  });
});

// =============================================================================
// getPreferences Tests
// =============================================================================

describe('getPreferences', () => {
  test('returns defaults when nothing stored', () => {
    const prefs = getPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });
  
  test('returns stored values', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
      ttl: 3600,
      maxViews: 3
    }));
    
    const prefs = getPreferences();
    expect(prefs.ttl).toBe(3600);
    expect(prefs.maxViews).toBe(3);
  });
  
  test('merges with defaults for missing fields', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
      ttl: 3600
    }));
    
    const prefs = getPreferences();
    expect(prefs.ttl).toBe(3600);
    expect(prefs.maxViews).toBe(DEFAULT_PREFERENCES.maxViews);
    expect(prefs.usePassphrase).toBe(DEFAULT_PREFERENCES.usePassphrase);
  });
  
  test('returns defaults on invalid JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json');
    
    const prefs = getPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });
  
  test('returns copy of defaults (not reference)', () => {
    const prefs1 = getPreferences();
    const prefs2 = getPreferences();
    
    prefs1.ttl = 999;
    expect(prefs2.ttl).toBe(DEFAULT_PREFERENCES.ttl);
  });
});

// =============================================================================
// setPreferences Tests
// =============================================================================

describe('setPreferences', () => {
  test('stores preferences in localStorage', () => {
    setPreferences({ ttl: 7200 });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );
  });
  
  test('merges with existing preferences', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      ttl: 3600,
      maxViews: 2
    }));
    
    setPreferences({ maxViews: 5 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.ttl).toBe(3600);
    expect(stored.maxViews).toBe(5);
  });
  
  test('validates ttl bounds (min)', () => {
    setPreferences({ ttl: 100 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.ttl).toBe(900); // Minimum
  });
  
  test('validates ttl bounds (max)', () => {
    setPreferences({ ttl: 10000000 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.ttl).toBe(7776000); // Maximum
  });
  
  test('validates maxViews bounds (min)', () => {
    setPreferences({ maxViews: 0 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.maxViews).toBe(1); // Minimum
  });
  
  test('validates maxViews bounds (max)', () => {
    setPreferences({ maxViews: 100 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.maxViews).toBe(5); // Maximum
  });
  
  test('validates autoHideSeconds bounds', () => {
    setPreferences({ autoHideSeconds: 500 });
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.autoHideSeconds).toBe(300); // Maximum
  });
});

// =============================================================================
// clearPreferences Tests
// =============================================================================

describe('clearPreferences', () => {
  test('removes preferences from localStorage', () => {
    clearPreferences();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});

// =============================================================================
// getPreference Tests
// =============================================================================

describe('getPreference', () => {
  test('returns specific preference value', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      ttl: 3600
    }));
    
    expect(getPreference('ttl')).toBe(3600);
  });
  
  test('returns default for missing preference', () => {
    expect(getPreference('maxViews')).toBe(DEFAULT_PREFERENCES.maxViews);
  });
});

// =============================================================================
// setPreference Tests
// =============================================================================

describe('setPreference', () => {
  test('sets single preference value', () => {
    setPreference('ttl', 7200);
    
    // Find the call that stores preferences (not the test call)
    const prefCalls = localStorageMock.setItem.mock.calls.filter(
      call => call[0] === STORAGE_KEY
    );
    const storedCall = prefCalls[prefCalls.length - 1];
    const stored = JSON.parse(storedCall[1]);
    
    expect(stored.ttl).toBe(7200);
  });
});
