// Structured logger for production
// Outputs JSON in production, pretty in development

const isDev = process.env.NODE_ENV !== 'production';

function formatLog(level, context, message, data = {}) {
  if (isDev) {
    const prefix = { info: 'ℹ', warn: '⚠', error: '✖' }[level] || '•';
    const extra = Object.keys(data).length ? ` ${JSON.stringify(data)}` : '';
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${prefix} [${context}] ${message}${extra}`
    );
    return;
  }

  // Production: structured JSON
  const entry = {
    level,
    context,
    message,
    ...data,
    timestamp: new Date().toISOString(),
  };
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify(entry)
  );
}

export const log = {
  info: (context, message, data) => formatLog('info', context, message, data),
  warn: (context, message, data) => formatLog('warn', context, message, data),
  error: (context, message, data) => formatLog('error', context, message, data),
};
