import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);

