const SIGNAL_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;
const REASON_PATTERN = /^[a-z0-9_.:-]{1,96}$/;

/**
 * Emit a stable, secret-free failure marker for CI/Vercel log alerts. GitHub
 * Actions also turns the annotation into a visible workflow error.
 */
export function reportCliOperationalFailure({
  signal,
  reason = 'unknown',
  data = {},
  logger = console,
  env = process.env,
} = {}) {
  if (typeof signal !== 'string' || !SIGNAL_PATTERN.test(signal)) return false;
  const safeReason = typeof reason === 'string' && REASON_PATTERN.test(reason)
    ? reason
    : 'invalid_reason';
  const safeData = Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => (
        /^[a-z][a-zA-Z0-9]{0,31}$/.test(key)
        && (typeof value === 'boolean' || Number.isFinite(value))
      ))
      .slice(0, 10),
  );
  const marker = JSON.stringify({
    level: 'error',
    context: 'Migration',
    signal,
    reason: safeReason,
    ...safeData,
  });

  logger.error(`[operational-alert] ${marker}`);
  if (env.GITHUB_ACTIONS === 'true') {
    logger.error(`::error title=Migration gate failure::${signal} (${safeReason})`);
  }
  return true;
}
