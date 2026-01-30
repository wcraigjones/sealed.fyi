/**
 * sealed.fyi - LocalStorage Wrapper Module
 * 
 * Manages client-side preferences using localStorage.
 * Provides a simple API for storing and retrieving user preferences.
 */

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'sealed_preferences';

const DEFAULT_PREFERENCES = {
  ttl: 86400,           // 1 day in seconds
  maxViews: 1,          // Single view by default
  usePassphrase: false, // No passphrase by default
  autoCopyLink: false,  // Don't auto-copy link
  autoHideSeconds: 0    // Don't auto-hide (0 = disabled)
};

// =============================================================================
// Storage Functions
// =============================================================================

/**
 * Check if localStorage is available.
 * @returns {boolean}
 */
function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get all preferences, with defaults for any missing values.
 * @returns {{ttl: number, maxViews: number, usePassphrase: boolean, autoCopyLink: boolean, autoHideSeconds: number}}
 */
function getPreferences() {
  if (!isStorageAvailable()) {
    return { ...DEFAULT_PREFERENCES };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_PREFERENCES };
    }
    
    const parsed = JSON.parse(stored);
    
    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed
    };
  } catch (e) {
    // If parsing fails, return defaults
    console.warn('Failed to parse stored preferences, using defaults:', e);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Set preferences, merging with existing values.
 * @param {Partial<{ttl: number, maxViews: number, usePassphrase: boolean, autoCopyLink: boolean, autoHideSeconds: number}>} prefs
 */
function setPreferences(prefs) {
  if (!isStorageAvailable()) {
    console.warn('localStorage not available, preferences not saved');
    return;
  }
  
  try {
    const current = getPreferences();
    const updated = { ...current, ...prefs };
    
    // Validate values before storing
    if (typeof updated.ttl === 'number') {
      updated.ttl = Math.max(900, Math.min(7776000, updated.ttl));
    }
    if (typeof updated.maxViews === 'number') {
      updated.maxViews = Math.max(1, Math.min(5, updated.maxViews));
    }
    if (typeof updated.autoHideSeconds === 'number') {
      updated.autoHideSeconds = Math.max(0, Math.min(300, updated.autoHideSeconds));
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save preferences:', e);
  }
}

/**
 * Clear all stored preferences, reverting to defaults.
 */
function clearPreferences() {
  if (!isStorageAvailable()) {
    return;
  }
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear preferences:', e);
  }
}

/**
 * Get a single preference value.
 * @param {string} key - Preference key
 * @returns {*} Preference value or default
 */
function getPreference(key) {
  const prefs = getPreferences();
  return prefs[key];
}

/**
 * Set a single preference value.
 * @param {string} key - Preference key
 * @param {*} value - Preference value
 */
function setPreference(key, value) {
  setPreferences({ [key]: value });
}

// =============================================================================
// Exports (for both browser and testing)
// =============================================================================

// Check if running in Node.js environment (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    DEFAULT_PREFERENCES,
    isStorageAvailable,
    getPreferences,
    setPreferences,
    clearPreferences,
    getPreference,
    setPreference
  };
}
