// Fetch with timeout and exponential backoff retry

/**
 * Fetch with a timeout
 * @param {string} url
 * @param {object} options - fetch options
 * @param {number} timeoutMs - timeout in milliseconds (default 15s)
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with retry + exponential backoff
 * @param {string} url
 * @param {object} options - fetch options
 * @param {object} config - { maxRetries, timeoutMs, backoffMs }
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
  const { maxRetries = 3, timeoutMs = 15000, backoffMs = 1000 } = config;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);

      // Don't retry on client errors (4xx) — only on server errors (5xx) or network failures
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;

      // Don't retry if aborted intentionally (not timeout)
      if (err.name === 'AbortError' && attempt === 0) {
        throw new Error('Request timed out');
      }
    }

    // Wait before retry with exponential backoff + jitter
    if (attempt < maxRetries) {
      const delay = backoffMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('All retries failed');
}
