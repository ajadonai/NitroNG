// Network-safe fetch — handles failures gracefully
// Use for user-facing form submissions

/**
 * Fetch with automatic retry on network failure
 * @param {string} url
 * @param {object} options - fetch options
 * @param {object} config - { retries, retryDelay }
 * @returns {Promise<Response>}
 */
export async function safeFetch(url, options = {}, config = {}) {
  const { retries = 1, retryDelay = 1000 } = config;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(30000), // 30s timeout
      });
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
        continue;
      }
      // Final attempt failed
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        throw new Error('Request timed out. Check your connection and try again.');
      }
      throw new Error('Network error. Check your internet connection and try again.');
    }
  }
}

/**
 * Get a user-friendly error message from a failed response or error
 * @param {Error|Response} err
 * @param {string} fallback
 * @returns {string}
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return fallback;
}

/**
 * Save form state to sessionStorage for recovery
 * @param {string} key
 * @param {object} data
 */
export function saveFormDraft(key, data) {
  try { sessionStorage.setItem(`nitro_draft_${key}`, JSON.stringify(data)); } catch {}
}

/**
 * Load form state from sessionStorage
 * @param {string} key
 * @returns {object|null}
 */
export function loadFormDraft(key) {
  try {
    const saved = sessionStorage.getItem(`nitro_draft_${key}`);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

/**
 * Clear form draft from sessionStorage
 * @param {string} key
 */
export function clearFormDraft(key) {
  try { sessionStorage.removeItem(`nitro_draft_${key}`); } catch {}
}
