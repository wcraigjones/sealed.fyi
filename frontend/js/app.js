/**
 * sealed.fyi - Main Application Module
 * 
 * Handles view routing, state management, and orchestrates the create/reveal flows.
 * This module ties together crypto.js, api.js, pow.js (if available), and storage.js.
 */

// =============================================================================
// Application State
// =============================================================================

const state = {
  currentView: 'create',
  secret: null,           // Decrypted secret content
  secretId: null,         // ID from URL or creation
  burnToken: null,        // Burn token from creation
  urlFragment: null,      // Key material from URL fragment
  error: null,            // Current error message
  loading: false,         // Loading state
  accessToken: null       // Idempotency token for re-fetch
};

// =============================================================================
// View Management
// =============================================================================

// All available view IDs
const VIEW_IDS = [
  'view-create',
  'view-creating',
  'view-link',
  'view-reveal',
  'view-passphrase',
  'view-secret',
  'view-error'
];

/**
 * Hide all view sections.
 */
function hideAllViews() {
  VIEW_IDS.forEach(viewId => {
    const element = document.getElementById(viewId);
    if (element) {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    }
  });
}

/**
 * Show a specific view section.
 * @param {string} viewId - The ID of the view to show (without 'view-' prefix)
 */
function showView(viewId) {
  const fullId = viewId.startsWith('view-') ? viewId : `view-${viewId}`;
  
  hideAllViews();
  
  const element = document.getElementById(fullId);
  if (element) {
    element.hidden = false;
    element.removeAttribute('aria-hidden');
    state.currentView = viewId.replace('view-', '');
    
    // Focus management for accessibility
    const focusTarget = element.querySelector('[autofocus], h1, h2, input, button');
    if (focusTarget) {
      // Delay focus to allow screen readers to announce view change
      setTimeout(() => focusTarget.focus(), 100);
    }
  } else {
    console.warn(`View not found: ${fullId}`);
  }
}

/**
 * Get the current view ID.
 * @returns {string}
 */
function getCurrentView() {
  return state.currentView;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Show an error view with a message.
 * @param {string} message - Error message to display
 * @param {boolean} [canRetry=false] - Whether to show retry button
 */
function showError(message, canRetry = false) {
  state.error = message;
  
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  
  const retryButton = document.getElementById('error-retry');
  if (retryButton) {
    retryButton.hidden = !canRetry;
  }
  
  showView('error');
}

/**
 * Clear the current error state.
 */
function clearError() {
  state.error = null;
}

// =============================================================================
// URL Fragment Handling
// =============================================================================

/**
 * Parse the URL fragment for secret ID and key.
 * Format: #<secretId>:<base64urlKey>
 * 
 * @returns {{secretId: string, urlFragment: string}|null}
 */
function parseUrlFragment() {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) {
    return null;
  }
  
  // Remove the leading #
  const fragment = hash.substring(1);
  
  // Find the separator
  const separatorIndex = fragment.indexOf(':');
  if (separatorIndex === -1 || separatorIndex === 0 || separatorIndex === fragment.length - 1) {
    return null;
  }
  
  const secretId = fragment.substring(0, separatorIndex);
  const urlFragment = fragment.substring(separatorIndex + 1);
  
  // Basic validation
  if (!secretId || !urlFragment) {
    return null;
  }
  
  return { secretId, urlFragment };
}

/**
 * Build a full URL with fragment for sharing.
 * @param {string} secretId 
 * @param {string} urlFragment 
 * @returns {string}
 */
function buildSecretUrl(secretId, urlFragment) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#${secretId}:${urlFragment}`;
}

/**
 * Clear the URL fragment without triggering navigation.
 */
function clearUrlFragment() {
  // Use replaceState to avoid adding history entry
  const url = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', url);
}

// =============================================================================
// Create Flow
// =============================================================================

/**
 * Handle the secret creation form submission.
 * @param {Event} event 
 */
async function handleCreate(event) {
  event.preventDefault();
  
  // Get form values
  const form = event.target;
  const secretInput = form.querySelector('#secret-input');
  const ttlSelect = form.querySelector('#ttl-select');
  const maxViewsSelect = form.querySelector('#max-views-select');
  const passphraseInput = form.querySelector('#passphrase-input');
  const passphraseCheckbox = form.querySelector('#use-passphrase');
  
  const secretText = secretInput?.value?.trim();
  if (!secretText) {
    showError('Please enter a secret to encrypt.');
    return;
  }
  
  const ttl = parseInt(ttlSelect?.value, 10) || 86400;
  const maxViews = parseInt(maxViewsSelect?.value, 10) || 1;
  const usePassphrase = passphraseCheckbox?.checked || false;
  const passphrase = usePassphrase ? passphraseInput?.value : null;
  
  if (usePassphrase && !passphrase) {
    showError('Please enter a passphrase or uncheck the passphrase option.');
    return;
  }
  
  // Show creating view
  showView('creating');
  state.loading = true;
  
  try {
    // Save preferences for next time
    if (typeof setPreferences === 'function') {
      setPreferences({ ttl, maxViews, usePassphrase });
    }
    
    // Step 1: Get token from API
    updateCreatingStatus('Requesting authorization...');
    const tokenResponse = await getToken();
    
    // Step 2: Solve proof-of-work
    updateCreatingStatus('Solving proof-of-work...');
    let pow;
    if (typeof solveChallenge === 'function') {
      pow = await solveChallenge(tokenResponse.nonce, tokenResponse.powChallenge);
    } else {
      // If pow.js not loaded, use placeholder (for testing without PoW)
      console.warn('PoW module not loaded, using placeholder');
      pow = '0';
    }
    
    // Step 3: Encrypt secret
    updateCreatingStatus('Encrypting secret...');
    let encryptResult;
    if (typeof encryptSecret === 'function') {
      encryptResult = await encryptSecret(secretText, passphrase);
    } else {
      throw new Error('Crypto module not loaded');
    }
    
    // Step 4: Submit to API
    updateCreatingStatus('Storing encrypted secret...');
    const createResponse = await createSecret(tokenResponse.token, {
      ciphertext: encryptResult.payload.ciphertext,
      iv: encryptResult.payload.iv,
      salt: encryptResult.payload.salt,
      nonce: tokenResponse.nonce,
      pow: pow,
      ttl: ttl,
      maxViews: maxViews,
      passphraseProtected: !!passphrase
    });
    
    // Step 5: Generate full URL with fragment
    const secretUrl = buildSecretUrl(createResponse.id, encryptResult.urlFragment);
    
    // Store state
    state.secretId = createResponse.id;
    state.burnToken = createResponse.burnToken;
    state.urlFragment = encryptResult.urlFragment;
    
    // Step 6: Show link view
    displayGeneratedLink(secretUrl, createResponse.burnToken, createResponse.expiresAt);
    showView('link');
    
    // Clear the form
    secretInput.value = '';
    if (passphraseInput) passphraseInput.value = '';
    
  } catch (error) {
    console.error('Create error:', error);
    
    let message = 'Failed to create secret.';
    let canRetry = true;
    
    if (error instanceof InvalidTokenError) {
      message = 'Authorization failed. Please try again.';
    } else if (error instanceof InvalidPowError) {
      message = 'Proof-of-work verification failed. Please try again.';
    } else if (error instanceof ValidationError) {
      message = error.message || 'Invalid request. Please check your input.';
      canRetry = false;
    } else if (error instanceof NetworkError) {
      message = 'Network error. Please check your connection and try again.';
    } else if (error.message) {
      message = error.message;
    }
    
    showError(message, canRetry);
  } finally {
    state.loading = false;
  }
}

/**
 * Update the status message in the creating view.
 * @param {string} message 
 */
function updateCreatingStatus(message) {
  const statusElement = document.getElementById('creating-status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Display the generated link in the link view.
 * @param {string} url 
 * @param {string} burnToken 
 * @param {number} expiresAt 
 */
function displayGeneratedLink(url, burnToken, expiresAt) {
  const linkInput = document.getElementById('generated-link');
  if (linkInput) {
    linkInput.value = url;
  }
  
  const burnTokenDisplay = document.getElementById('burn-token-display');
  if (burnTokenDisplay) {
    burnTokenDisplay.textContent = burnToken;
  }
  
  const expiresDisplay = document.getElementById('expires-at-display');
  if (expiresDisplay) {
    const expiresDate = new Date(expiresAt * 1000);
    expiresDisplay.textContent = expiresDate.toLocaleString();
  }
  
  // Auto-copy if preference is set
  if (typeof getPreference === 'function' && getPreference('autoCopyLink')) {
    copyToClipboard(url);
  }
}

// =============================================================================
// Reveal Flow
// =============================================================================

/**
 * Handle the reveal button click.
 * Fetches and decrypts the secret.
 */
async function handleReveal() {
  const parsed = parseUrlFragment();
  if (!parsed) {
    showError('Invalid secret URL.');
    return;
  }
  
  state.secretId = parsed.secretId;
  state.urlFragment = parsed.urlFragment;
  
  showView('reveal');
  state.loading = true;
  
  try {
    // Fetch the encrypted secret
    updateRevealStatus('Fetching encrypted secret...');
    const secretResponse = await getSecret(parsed.secretId, state.accessToken);
    
    // Store access token for potential re-fetch
    state.accessToken = secretResponse.accessToken;
    
    // Check if passphrase is required
    if (secretResponse.passphraseProtected) {
      state.loading = false;
      showView('passphrase');
      return;
    }
    
    // Decrypt without passphrase
    await decryptAndDisplaySecret(secretResponse, parsed.urlFragment, null);
    
  } catch (error) {
    console.error('Reveal error:', error);
    
    let message = 'Failed to retrieve secret.';
    
    if (error instanceof NotAvailableError) {
      message = 'This secret is no longer available. It may have expired, been viewed the maximum number of times, or been deleted.';
    } else if (error instanceof NetworkError) {
      message = 'Network error. Please check your connection and try again.';
    } else if (error.message) {
      message = error.message;
    }
    
    showError(message, error instanceof NetworkError);
  } finally {
    state.loading = false;
  }
}

/**
 * Handle passphrase form submission.
 * @param {Event} event 
 */
async function handlePassphrase(event) {
  event.preventDefault();
  
  const form = event.target;
  const passphraseInput = form.querySelector('#reveal-passphrase-input');
  const passphrase = passphraseInput?.value;
  
  if (!passphrase) {
    showError('Please enter the passphrase.');
    return;
  }
  
  state.loading = true;
  
  try {
    // Fetch the encrypted secret again (use access token for idempotency)
    updateRevealStatus('Decrypting secret...');
    const secretResponse = await getSecret(state.secretId, state.accessToken);
    
    // Decrypt with passphrase
    await decryptAndDisplaySecret(secretResponse, state.urlFragment, passphrase);
    
    // Clear passphrase input
    passphraseInput.value = '';
    
  } catch (error) {
    console.error('Passphrase decrypt error:', error);
    
    let message = 'Failed to decrypt secret.';
    
    if (error.name === 'OperationError' || error.message?.includes('decrypt')) {
      message = 'Incorrect passphrase. Please try again.';
      // Show passphrase view again
      showView('passphrase');
      return;
    } else if (error instanceof NotAvailableError) {
      message = 'This secret is no longer available.';
    } else if (error instanceof NetworkError) {
      message = 'Network error. Please check your connection and try again.';
    }
    
    showError(message, error instanceof NetworkError);
  } finally {
    state.loading = false;
  }
}

/**
 * Decrypt the secret and display it.
 * @param {{ciphertext: string, iv: string, salt: string|null, passphraseProtected: boolean}} secretResponse 
 * @param {string} urlFragment 
 * @param {string|null} passphrase 
 */
async function decryptAndDisplaySecret(secretResponse, urlFragment, passphrase) {
  updateRevealStatus('Decrypting secret...');
  
  let plaintext;
  if (typeof decryptSecret === 'function') {
    plaintext = await decryptSecret(
      {
        ciphertext: secretResponse.ciphertext,
        iv: secretResponse.iv,
        salt: secretResponse.salt
      },
      urlFragment,
      passphrase
    );
  } else {
    throw new Error('Crypto module not loaded');
  }
  
  // Store and display
  state.secret = plaintext;
  displayDecryptedSecret(plaintext);
  showView('secret');
  
  // Clear URL fragment for security (optional - user preference)
  // clearUrlFragment();
  
  // Set up auto-hide if preference is set
  if (typeof getPreference === 'function') {
    const autoHideSeconds = getPreference('autoHideSeconds');
    if (autoHideSeconds > 0) {
      setTimeout(() => {
        hideSecret();
      }, autoHideSeconds * 1000);
    }
  }
}

/**
 * Update the status message in the reveal view.
 * @param {string} message 
 */
function updateRevealStatus(message) {
  const statusElement = document.getElementById('reveal-status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Display the decrypted secret.
 * @param {string} plaintext 
 */
function displayDecryptedSecret(plaintext) {
  const secretDisplay = document.getElementById('secret-display');
  if (secretDisplay) {
    secretDisplay.textContent = plaintext;
  }
}

/**
 * Hide the displayed secret (for auto-hide feature).
 */
function hideSecret() {
  const secretDisplay = document.getElementById('secret-display');
  if (secretDisplay) {
    secretDisplay.textContent = '[Hidden]';
  }
  state.secret = null;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Copy text to clipboard.
 * @param {string} text 
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (e2) {
      console.warn('Failed to copy to clipboard:', e2);
      return false;
    }
  }
}

/**
 * Handle copy link button click.
 */
async function handleCopyLink() {
  const linkInput = document.getElementById('generated-link');
  if (linkInput) {
    const success = await copyToClipboard(linkInput.value);
    
    // Visual feedback
    const copyButton = document.getElementById('copy-link-button');
    if (copyButton) {
      const originalText = copyButton.textContent;
      copyButton.textContent = success ? 'Copied!' : 'Failed';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }
  }
}

/**
 * Handle copy secret button click.
 */
async function handleCopySecret() {
  if (state.secret) {
    const success = await copyToClipboard(state.secret);
    
    // Visual feedback
    const copyButton = document.getElementById('copy-secret-button');
    if (copyButton) {
      const originalText = copyButton.textContent;
      copyButton.textContent = success ? 'Copied!' : 'Failed';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }
  }
}

/**
 * Handle burn button click.
 */
async function handleBurn() {
  if (!state.secretId || !state.burnToken) {
    console.warn('Cannot burn: missing secretId or burnToken');
    return;
  }
  
  try {
    await burnSecret(state.secretId, state.burnToken);
    
    // Visual feedback
    const burnButton = document.getElementById('burn-button');
    if (burnButton) {
      burnButton.textContent = 'Burned!';
      burnButton.disabled = true;
    }
  } catch (error) {
    console.error('Burn error:', error);
    // Burn always returns 204, so errors are network-related
    showError('Failed to burn secret. Please check your connection.');
  }
}

/**
 * Handle create new button click (from link/secret/error views).
 */
function handleCreateNew() {
  // Reset state
  state.secret = null;
  state.secretId = null;
  state.burnToken = null;
  state.urlFragment = null;
  state.error = null;
  state.accessToken = null;
  
  // Clear URL fragment
  clearUrlFragment();
  
  // Show create view
  showView('create');
}

/**
 * Handle retry button click.
 */
function handleRetry() {
  // Determine what to retry based on state
  if (state.urlFragment) {
    // Was in reveal flow
    handleReveal();
  } else {
    // Go back to create view
    handleCreateNew();
  }
}

// =============================================================================
// Form Helpers
// =============================================================================

/**
 * Toggle passphrase input visibility based on checkbox.
 */
function togglePassphraseInput() {
  const checkbox = document.getElementById('use-passphrase');
  const container = document.getElementById('passphrase-container');
  
  if (container) {
    container.hidden = !checkbox?.checked;
  }
}

/**
 * Load saved preferences into form.
 */
function loadPreferencesIntoForm() {
  if (typeof getPreferences !== 'function') {
    return;
  }
  
  const prefs = getPreferences();
  
  const ttlSelect = document.getElementById('ttl-select');
  if (ttlSelect) {
    ttlSelect.value = prefs.ttl.toString();
  }
  
  const maxViewsSelect = document.getElementById('max-views-select');
  if (maxViewsSelect) {
    maxViewsSelect.value = prefs.maxViews.toString();
  }
  
  const passphraseCheckbox = document.getElementById('use-passphrase');
  if (passphraseCheckbox) {
    passphraseCheckbox.checked = prefs.usePassphrase;
    togglePassphraseInput();
  }
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the application.
 * Called when DOM is ready.
 */
function init() {
  // Check URL for secret ID
  const parsed = parseUrlFragment();
  
  if (parsed) {
    // URL contains secret - show reveal view
    state.secretId = parsed.secretId;
    state.urlFragment = parsed.urlFragment;
    showView('reveal');
  } else {
    // No secret in URL - show create view
    loadPreferencesIntoForm();
    showView('create');
  }
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Set up all event listeners.
 */
function setupEventListeners() {
  // Create form
  const createForm = document.getElementById('create-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreate);
  }
  
  // Passphrase checkbox toggle
  const passphraseCheckbox = document.getElementById('use-passphrase');
  if (passphraseCheckbox) {
    passphraseCheckbox.addEventListener('change', togglePassphraseInput);
  }
  
  // Reveal button
  const revealButton = document.getElementById('reveal-button');
  if (revealButton) {
    revealButton.addEventListener('click', handleReveal);
  }
  
  // Passphrase form
  const passphraseForm = document.getElementById('passphrase-form');
  if (passphraseForm) {
    passphraseForm.addEventListener('submit', handlePassphrase);
  }
  
  // Copy link button
  const copyLinkButton = document.getElementById('copy-link-button');
  if (copyLinkButton) {
    copyLinkButton.addEventListener('click', handleCopyLink);
  }
  
  // Copy secret button
  const copySecretButton = document.getElementById('copy-secret-button');
  if (copySecretButton) {
    copySecretButton.addEventListener('click', handleCopySecret);
  }
  
  // Burn button
  const burnButton = document.getElementById('burn-button');
  if (burnButton) {
    burnButton.addEventListener('click', handleBurn);
  }
  
  // Create new buttons (multiple views may have this)
  document.querySelectorAll('.create-new-button').forEach(button => {
    button.addEventListener('click', handleCreateNew);
  });
  
  // Retry button
  const retryButton = document.getElementById('error-retry');
  if (retryButton) {
    retryButton.addEventListener('click', handleRetry);
  }
  
  // URL hash change (for browser back/forward)
  window.addEventListener('hashchange', () => {
    const parsed = parseUrlFragment();
    if (parsed) {
      state.secretId = parsed.secretId;
      state.urlFragment = parsed.urlFragment;
      showView('reveal');
    } else if (state.currentView !== 'create') {
      handleCreateNew();
    }
  });
}

// =============================================================================
// Auto-initialization
// =============================================================================

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// =============================================================================
// Exports (for both browser and testing)
// =============================================================================

// Check if running in Node.js environment (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // State (for testing)
    state,
    
    // View management
    VIEW_IDS,
    hideAllViews,
    showView,
    getCurrentView,
    
    // Error handling
    showError,
    clearError,
    
    // URL handling
    parseUrlFragment,
    buildSecretUrl,
    clearUrlFragment,
    
    // Create flow
    handleCreate,
    updateCreatingStatus,
    displayGeneratedLink,
    
    // Reveal flow
    handleReveal,
    handlePassphrase,
    decryptAndDisplaySecret,
    updateRevealStatus,
    displayDecryptedSecret,
    hideSecret,
    
    // Utilities
    copyToClipboard,
    handleCopyLink,
    handleCopySecret,
    handleBurn,
    handleCreateNew,
    handleRetry,
    
    // Form helpers
    togglePassphraseInput,
    loadPreferencesIntoForm,
    
    // Initialization
    init,
    setupEventListeners
  };
}
