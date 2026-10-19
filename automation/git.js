const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function git(args) {
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -oBatchMode=yes -oConnectTimeout=15' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
module.exports = { git, root };
