// Validates required environment variables at startup
// Import this in your root layout or instrumentation file

const required = [
  'DATABASE_URL',
];

const requiredInProd = [
  'JWT_SECRET',
  'JWT_ADMIN_SECRET',
];

const recommended = [
  'BREVO_API_KEY',
  'FLUTTERWAVE_SECRET_KEY',
  'FLUTTERWAVE_PUBLIC_KEY',
  'MTP_API_KEY',
  'MTP_API_URL',
  'JAP_API_KEY',
  'JAP_API_URL',
  'DAOSMM_API_KEY',
  'DAOSMM_API_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CRON_SECRET',
];

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nAdd them to your .env file.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const missingProd = requiredInProd.filter(key => !process.env[key]);
    if (missingProd.length > 0) {
      throw new Error(
        `Missing required production env vars:\n${missingProd.map(k => `  - ${k}`).join('\n')}`
      );
    }
  }

  const defaults = recommended.filter(key => !process.env[key]);
  if (defaults.length > 0) {
    console.warn(
      `⚠️  Using default values for: ${defaults.join(', ')}. Set these in .env for production.`
    );
  }
}
