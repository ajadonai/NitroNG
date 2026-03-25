// Validates required environment variables at startup
// Import this in your root layout or instrumentation file

const required = [
  'DATABASE_URL',
];

const recommended = [
  'JWT_SECRET',
  'JWT_ADMIN_SECRET',
  'BREVO_API_KEY',
];

export function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nAdd them to your .env file.`
    );
  }

  const defaults = recommended.filter(key => !process.env[key]);
  if (defaults.length > 0) {
    console.warn(
      `⚠️  Using default values for: ${defaults.join(', ')}. Set these in .env for production.`
    );
  }
}
