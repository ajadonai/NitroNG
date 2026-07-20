import { validateProductionEnv } from '../lib/env.js';

try {
  validateProductionEnv(process.env, { phase: 'build' });
  console.log('Production environment validation passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production environment validation failed.');
  process.exitCode = 1;
}
