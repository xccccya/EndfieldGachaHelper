import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  return child;
}

function resolveTscBin() {
  // Resolve TypeScript from workspace root (npm workspaces may hoist deps).
  const require = createRequire(import.meta.url);
  return require.resolve('typescript/bin/tsc');
}

// 1) Build once so dist/ exists (node --watch needs an entrypoint).
const tscBin = resolveTscBin();
const build = spawnSync(process.execPath, [tscBin, '-b'], { stdio: 'inherit' });
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// 2) Start TypeScript incremental watch + Node watcher in parallel.
const tscWatch = run(process.execPath, [tscBin, '-b', '-w']);
const nodeWatch = run(process.execPath, ['--watch', 'dist/main.js']);

const shutdown = (signal) => {
  // Best-effort terminate both processes.
  for (const child of [tscWatch, nodeWatch]) {
    if (!child?.pid) continue;
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// If one process exits, exit with the same code and stop the other.
for (const child of [tscWatch, nodeWatch]) {
  child.on('exit', (code) => {
    shutdown('SIGTERM');
    process.exit(code ?? 0);
  });
}

