import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const production = process.env.VERCEL_ENV === 'production'
  || process.env.NITRO_VALIDATE_PRODUCTION_ENV === '1';

function run(script) {
  console.log(`\n[deployment-gate] npm run ${script}`);
  const result = spawnSync(npmCommand, ['run', script], {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('migrations:check');

if (production) {
  run('env:validate:production');
  run('db:deploy');
  run('db:status');
  run('migrations:verify:applied');
} else {
  console.log('\n[deployment-gate] Preview/local build: production environment and database status checks skipped.');
}

run('build');
