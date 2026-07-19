const MAX_ATTRIBUTION_LENGTH = 120;
const MAX_RESET_TOKEN_LENGTH = 512;

const GOOGLE_CALLBACK_ERRORS = new Set([
  'google_cancelled',
  'google_state_mismatch',
  'google_token_failed',
  'google_no_email',
  'google_failed',
  'google_missing_params',
  'google_not_configured',
  'google_account_deleted',
]);

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanQueryValue(value, maxLength = MAX_ATTRIBUTION_LENGTH) {
  const first = firstQueryValue(value);
  if (typeof first !== 'string') return '';
  return first.trim().slice(0, maxLength);
}

/**
 * Resolve landing-page attribution before the first render so the server and
 * browser start on the same authentication screen.
 */
export function resolveLandingAuthQuery(searchParams = {}) {
  const ref = cleanQueryValue(searchParams.ref);
  const via = cleanQueryValue(searchParams.via);
  const resetToken = cleanQueryValue(searchParams.reset, MAX_RESET_TOKEN_LENGTH);
  const loginRequested = Boolean(cleanQueryValue(searchParams.login, 20));
  const signupRequested = Boolean(cleanQueryValue(searchParams.signup, 20));
  const googleError = Boolean(cleanQueryValue(searchParams.google_error, 80));
  const error = cleanQueryValue(searchParams.error, 80);

  let initialModal = null;
  if (loginRequested) initialModal = 'login';
  if (signupRequested || ref) initialModal = 'signup';
  if (googleError || GOOGLE_CALLBACK_ERRORS.has(error)) initialModal = 'login';
  if (error === 'disposable_email') initialModal = 'signup';
  if (resetToken) initialModal = 'reset';

  return {
    ref,
    via,
    resetToken,
    initialModal,
    initialHeroAuth: via ? 'signup' : 'login',
  };
}
