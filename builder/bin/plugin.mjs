#!/usr/bin/env node

try {
  const { runCli } = await import('../dist/cli.js');
  process.exitCode = await runCli(process.argv.slice(2));
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
    process.stderr.write('The builder has not been compiled. Run `pnpm builder:build` first.\n');
    process.exitCode = 1;
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
