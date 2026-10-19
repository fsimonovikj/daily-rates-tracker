const fs = require('node:fs');
const path = require('node:path');
const { git } = require('./git');
const { updateRates } = require('../scripts/fetch');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--dry-run', '--heartbeat'].includes(arg))) throw new Error('Usage: node automation/runner.js [--dry-run] [--heartbeat]');
  const dryRun = args.includes('--dry-run');
  const heartbeat = args.includes('--heartbeat');
  // Dry run only reads Git and the API; it never writes files or contacts the Git remote.
  if (dryRun) {
    log('Dry run: no pull, file writes, commit, or push');
    log(JSON.stringify(await updateRates({ dryRun: true })));
    if (heartbeat) log('Would create an automated heartbeat commit if rates are unchanged');
    return;
  }
  const lock = path.resolve(git(['rev-parse', '--absolute-git-dir']), 'daily-rates.lock');
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another run is active, or a stale lock exists: ${lock}`);
    throw error;
  }
  try {
    if (git(['branch', '--show-current']) !== 'main') throw new Error('Automation requires the main branch');
    if (git(['status', '--porcelain', '--untracked-files=all'])) throw new Error('Working tree must be clean before automation runs');
    git(['pull', '--ff-only', 'origin', 'main']);
    const result = await updateRates();
    if (result.changed) {
      git(['add', '--', 'data/rates.json']);
      git(['commit', '-m', `data: automated exchange rates update ${result.date}`]);
      log(`Committed rates for ${result.date}`);
    } else if (heartbeat) {
      git(['commit', '--allow-empty', '-m', `chore: automated scheduler heartbeat ${new Date().toISOString()}`]);
      log('Created automated scheduler heartbeat');
    } else log(`No new data for ${result.date}`);
    // Also retries a previous successful commit whose push failed.
    git(['push', 'origin', 'HEAD:refs/heads/main']);
    log('Remote main is up to date');
  } finally { fs.rmdirSync(lock); }
}
main().catch(error => { console.error(`[${new Date().toISOString()}] Automation failed: ${error.message}`); process.exitCode = 1; });
